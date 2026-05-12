import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { createDb } from "../db";
import { files } from "../schema";
import { requireAuth } from "../middleware";
import { extractBearerToken, verifyClerkToken } from "../clerk-auth";
import {
  generateFileId,
  generateSalt,
  hashPassword,
  verifyPassword,
  createAccessToken,
  verifyAccessToken,
  getFileTokenSecret,
} from "../utils";
import {
  parseLimits,
  getUsage,
  checkUploadAllowed,
  checkDownloadAllowed,
} from "../usage";
import {
  isEditableExtension,
  getExtension,
  getEditActionUrl,
  createWopiToken,
} from "../wopi";
import { pikaEnabled, shortenWithPika } from "../pika";
import type { Env, UserInfo } from "../types";

type FilesEnv = {
  Bindings: Env;
  Variables: { user: UserInfo };
};

const app = new Hono<FilesEnv>();

// ── List current user's files ───────────────────────────────────────
app.get("/", requireAuth, async (c) => {
  const user = c.get("user");
  const db = createDb(c.env.DATABASE_URL);
  const userFiles = await db
    .select()
    .from(files)
    .where(eq(files.userId, user.id))
    .orderBy(desc(files.createdAt));

  return c.json(
    userFiles.map((f) => ({
      id: f.id,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      hasPassword: !!f.passwordHash,
      expiresAt: f.expiresAt?.toISOString() ?? null,
      createdAt: f.createdAt.toISOString(),
      accessCount: f.accessCount,
      url: `/f/${f.id}`,
      shortUrl: f.shortUrl,
    }))
  );
});

// ── Upload file ─────────────────────────────────────────────────────
app.post("/", requireAuth, async (c) => {
  const user = c.get("user");
  const limits = parseLimits(c.env);

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const password = formData.get("password") as string | null;
  const expiresIn = formData.get("expiresIn") as string | null;

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }

  const db = createDb(c.env.DATABASE_URL);
  const usage = await getUsage(db);
  const denial = checkUploadAllowed(usage, limits, file.size);
  if (denial) {
    return c.json(
      { error: denial.message, code: denial.code },
      denial.code === "upload_size" ? 413 : 507
    );
  }

  const fileId = generateFileId();
  const r2Key = `files/${fileId}/${file.name}`;

  await c.env.R2_BUCKET.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
    customMetadata: {
      originalName: file.name,
      uploadedBy: user.id,
    },
  });

  let passwordHash: string | null = null;
  let salt: string | null = null;
  if (password && password.trim()) {
    salt = generateSalt();
    passwordHash = await hashPassword(password.trim(), salt);
  }

  let expiresAt: Date | null = null;
  if (expiresIn && expiresIn !== "never") {
    const hours = parseInt(expiresIn, 10);
    if (!isNaN(hours) && hours > 0) {
      expiresAt = new Date(Date.now() + hours * 3600 * 1000);
    }
  }

  await db.insert(files).values({
    id: fileId,
    userId: user.id,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    r2Key,
    passwordHash,
    salt,
    expiresAt,
  });

  return c.json({
    id: fileId,
    url: `/f/${fileId}`,
    originalName: file.name,
    size: file.size,
    hasPassword: !!passwordHash,
    expiresAt: expiresAt?.toISOString() ?? null,
    accessCount: 0,
    createdAt: new Date().toISOString(),
    mimeType: file.type || "application/octet-stream",
    shortUrl: null,
  });
});

// ── Get file metadata (public) ──────────────────────────────────────
app.get("/:id", async (c) => {
  const fileId = c.req.param("id");
  const db = createDb(c.env.DATABASE_URL);
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    return c.json({ error: "File not found" }, 404);
  }

  if (file.expiresAt && new Date() > file.expiresAt) {
    return c.json({ error: "File has expired" }, 410);
  }

  // Best-effort owner check — file metadata is public, but if the caller
  // happens to be signed in we tag isOwner so the UI can show owner-only
  // controls (e.g. Edit). No error if not signed in.
  let isOwner = false;
  const token = extractBearerToken(c.req.raw.headers);
  if (token) {
    const u = await verifyClerkToken(c.env, token);
    if (u && u.id === file.userId) isOwner = true;
  }

  return c.json({
    id: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    hasPassword: !!file.passwordHash,
    expiresAt: file.expiresAt?.toISOString() ?? null,
    createdAt: file.createdAt.toISOString(),
    accessCount: file.accessCount,
    canEdit:
      !!c.env.COLLABORA_URL &&
      !file.passwordHash &&
      isEditableExtension(file.originalName),
    isOwner,
    shortUrl: file.shortUrl,
  });
});

// ── Shorten this file's public URL via Pika (owner-only) ───────────
app.post("/:id/shorten", requireAuth, async (c) => {
  const user = c.get("user");
  const fileId = c.req.param("id");
  if (!pikaEnabled(c.env)) {
    return c.json({ error: "Shortener is not configured" }, 501);
  }

  const db = createDb(c.env.DATABASE_URL);
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);
  if (!file) return c.json({ error: "File not found" }, 404);
  if (file.userId !== user.id && !user.isAdmin) {
    return c.json({ error: "Not authorized" }, 403);
  }
  if (file.shortUrl) return c.json({ shortUrl: file.shortUrl });

  const longUrl = `${new URL(c.req.url).origin}/f/${fileId}`;
  try {
    const { shortUrl } = await shortenWithPika(c.env, longUrl);
    await db
      .update(files)
      .set({ shortUrl })
      .where(eq(files.id, fileId));
    return c.json({ shortUrl });
  } catch (err) {
    console.error("Pika shorten failed:", err);
    return c.json(
      {
        error: "Shortener failed",
        message: err instanceof Error ? err.message : String(err),
      },
      502
    );
  }
});

// ── Start an edit session (owner-only) ──────────────────────────────
// Returns the iframe URL the frontend should embed and the WOPI access
// token Collabora will use to call back into our /wopi/* endpoints.
app.get("/:id/edit", requireAuth, async (c) => {
  try {
    const user = c.get("user");
    const fileId = c.req.param("id");

    if (!c.env.COLLABORA_URL) {
      return c.json({ error: "Edit feature is not configured" }, 501);
    }

    const db = createDb(c.env.DATABASE_URL);
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);
    if (!file) return c.json({ error: "File not found" }, 404);
    if (file.userId !== user.id && !user.isAdmin) {
      return c.json({ error: "Only the owner can edit this file" }, 403);
    }
    if (file.passwordHash) {
      return c.json(
        { error: "Password-protected files cannot be edited" },
        400
      );
    }

    const ext = getExtension(file.originalName);
    if (!isEditableExtension(file.originalName)) {
      return c.json({ error: "This file type is not editable" }, 400);
    }

    const actionUrl = await getEditActionUrl(c.env, ext);
    if (!actionUrl) {
      return c.json(
        {
          error:
            "Collabora discovery failed or this file type isn't in discovery. Check that the worker can reach " +
            c.env.COLLABORA_URL +
            "/hosting/discovery",
        },
        502
      );
    }

    const { token, exp } = await createWopiToken(c.env, {
      fileId,
      userId: user.id,
      write: true,
    });

    const origin = new URL(c.req.url).origin;
    const wopiSrc = `${origin}/wopi/files/${fileId}`;

    return c.json({
      actionUrl,
      wopiSrc,
      accessToken: token,
      accessTokenTtl: exp * 1000,
    });
  } catch (err) {
    console.error("/:id/edit handler threw:", err);
    return c.json(
      {
        error: "Edit setup failed",
        message: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});

// ── Verify password & get access token ──────────────────────────────
app.post("/:id/verify", async (c) => {
  const fileId = c.req.param("id");
  const { password } = await c.req.json<{ password: string }>();

  const db = createDb(c.env.DATABASE_URL);
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) return c.json({ error: "File not found" }, 404);
  if (file.expiresAt && new Date() > file.expiresAt)
    return c.json({ error: "File has expired" }, 410);
  if (!file.passwordHash || !file.salt)
    return c.json({ error: "File is not password protected" }, 400);

  const valid = await verifyPassword(password, file.salt, file.passwordHash);
  if (!valid) return c.json({ error: "Incorrect password" }, 401);

  const { token, expires } = await createAccessToken(
    fileId,
    getFileTokenSecret(c.env)
  );
  return c.json({ token, expires });
});

// ── Serve raw file ──────────────────────────────────────────────────
app.get("/:id/raw", async (c) => {
  const fileId = c.req.param("id");
  const db = createDb(c.env.DATABASE_URL);
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) return c.json({ error: "File not found" }, 404);
  if (file.expiresAt && new Date() > file.expiresAt)
    return c.json({ error: "File has expired" }, 410);

  if (file.passwordHash) {
    const token = c.req.query("token");
    if (!token) return c.json({ error: "Access token required" }, 401);
    const valid = await verifyAccessToken(
      fileId,
      token,
      getFileTokenSecret(c.env)
    );
    if (!valid) return c.json({ error: "Invalid or expired token" }, 401);
  }

  // Quota check before serving
  const limits = parseLimits(c.env);
  if (
    limits.maxDownloads !== null ||
    limits.maxBandwidthBytes !== null
  ) {
    const usage = await getUsage(db);
    const denial = checkDownloadAllowed(usage, limits, file.size);
    if (denial) {
      return c.json({ error: denial.message, code: denial.code }, 503);
    }
  }

  const object = await c.env.R2_BUCKET.get(file.r2Key);
  if (!object) return c.json({ error: "File not found in storage" }, 404);

  await db
    .update(files)
    .set({ accessCount: file.accessCount + 1 })
    .where(eq(files.id, fileId));

  const headers = new Headers();
  headers.set("Content-Type", file.mimeType || "application/octet-stream");
  headers.set("Content-Length", file.size.toString());
  headers.set(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(file.originalName)}"`
  );
  headers.set("Cache-Control", "public, max-age=3600");

  return new Response(object.body, { headers });
});

// ── Delete file ─────────────────────────────────────────────────────
app.delete("/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const fileId = c.req.param("id");
  const db = createDb(c.env.DATABASE_URL);

  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) return c.json({ error: "File not found" }, 404);
  if (file.userId !== user.id && !user.isAdmin) {
    return c.json({ error: "Not authorized" }, 403);
  }

  await c.env.R2_BUCKET.delete(file.r2Key);
  await db.delete(files).where(eq(files.id, fileId));

  return c.json({ ok: true });
});

export { app as fileRoutes };
