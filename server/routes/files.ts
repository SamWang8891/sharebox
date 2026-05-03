import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { createDb } from "../db";
import { files } from "../schema";
import { requireAuth } from "../middleware";
import {
  generateFileId,
  generateSalt,
  hashPassword,
  verifyPassword,
  createAccessToken,
  verifyAccessToken,
  getFileTokenSecret,
} from "../utils";
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
    }))
  );
});

// ── Upload file ─────────────────────────────────────────────────────
app.post("/", requireAuth, async (c) => {
  const user = c.get("user");
  const maxSize = parseInt(c.env.MAX_UPLOAD_SIZE ?? "83886080", 10); // 80MB

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const password = formData.get("password") as string | null;
  const expiresIn = formData.get("expiresIn") as string | null; // hours, or "never"

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }

  if (file.size > maxSize) {
    return c.json(
      { error: `File too large. Max ${Math.round(maxSize / 1024 / 1024)}MB` },
      413
    );
  }

  const fileId = generateFileId();
  const r2Key = `files/${fileId}/${file.name}`;

  // Upload to R2
  await c.env.R2_BUCKET.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
    customMetadata: {
      originalName: file.name,
      uploadedBy: user.id,
    },
  });

  // Hash password if provided
  let passwordHash: string | null = null;
  let salt: string | null = null;
  if (password && password.trim()) {
    salt = generateSalt();
    passwordHash = await hashPassword(password.trim(), salt);
  }

  // Calculate expiry
  let expiresAt: Date | null = null;
  if (expiresIn && expiresIn !== "never") {
    const hours = parseInt(expiresIn, 10);
    if (!isNaN(hours) && hours > 0) {
      expiresAt = new Date(Date.now() + hours * 3600 * 1000);
    }
  }

  // Insert into DB
  const db = createDb(c.env.DATABASE_URL);
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

  // Check expiry
  if (file.expiresAt && new Date() > file.expiresAt) {
    return c.json({ error: "File has expired" }, 410);
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
  });
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

  // Password check
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

  // Fetch from R2
  const object = await c.env.R2_BUCKET.get(file.r2Key);
  if (!object) return c.json({ error: "File not found in storage" }, 404);

  // Increment access count
  await db
    .update(files)
    .set({ accessCount: file.accessCount + 1 })
    .where(eq(files.id, fileId));

  const headers = new Headers();
  headers.set(
    "Content-Type",
    file.mimeType || "application/octet-stream"
  );
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

  // Delete from R2 and DB
  await c.env.R2_BUCKET.delete(file.r2Key);
  await db.delete(files).where(eq(files.id, fileId));

  return c.json({ ok: true });
});

export { app as fileRoutes };
