import { Hono } from "hono";
import { eq, and, desc, sql } from "drizzle-orm";
import { createDb } from "../db";
import { files, shareLinks } from "../schema";
import { requireAuth } from "../middleware";
import { generateFileId } from "../utils";
import { parseLimits, getUsage, checkUploadAllowed } from "../usage";
import {
  extensionAllowed,
  normalizeExtensions,
  parseExpiresIn,
} from "../share";
import { shortenWithPika, pikaEnabled } from "../pika";
import type { Env, UserInfo } from "../types";

type AdminEnv = {
  Bindings: Env;
  Variables: { user: UserInfo };
};

type PublicEnv = {
  Bindings: Env;
};

// ─────────────────────────────────────────────────────────────────────
// Owner (auth-required) routes — mounted at /api/share-links
// ─────────────────────────────────────────────────────────────────────
const adminApp = new Hono<AdminEnv>();

// List the current user's share links, with file count + bytes used.
adminApp.get("/", requireAuth, async (c) => {
  const user = c.get("user");
  const db = createDb(c.env.DATABASE_URL);

  const links = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.ownerUserId, user.id))
    .orderBy(desc(shareLinks.createdAt));

  // Aggregate file stats per link in one query.
  const stats = await db
    .select({
      shareLinkId: files.shareLinkId,
      count: sql<number>`COUNT(*)::int`,
      bytes: sql<number>`COALESCE(SUM(size), 0)::bigint`,
    })
    .from(files)
    .where(eq(files.userId, user.id))
    .groupBy(files.shareLinkId);

  const statMap = new Map<string, { count: number; bytes: number }>();
  for (const row of stats) {
    if (!row.shareLinkId) continue;
    statMap.set(row.shareLinkId, {
      count: Number(row.count),
      bytes: Number(row.bytes),
    });
  }

  return c.json(
    links.map((l) => ({
      id: l.id,
      label: l.label,
      maxFiles: l.maxFiles,
      maxTotalBytes: l.maxTotalBytes,
      allowedExtensions: l.allowedExtensions,
      status: l.status,
      shortUrl: l.shortUrl,
      expiresAt: l.expiresAt?.toISOString() ?? null,
      confirmedAt: l.confirmedAt?.toISOString() ?? null,
      createdAt: l.createdAt.toISOString(),
      url: `/u/${l.id}`,
      fileCount: statMap.get(l.id)?.count ?? 0,
      bytesUsed: statMap.get(l.id)?.bytes ?? 0,
    }))
  );
});

// Create a new share link.
adminApp.post("/", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    label?: string;
    maxFiles?: number | null;
    maxTotalBytes?: number | null;
    allowedExtensions?: string[];
    expiresIn?: string;
  }>();

  const allowedExtensions = normalizeExtensions(body.allowedExtensions);
  const maxFiles =
    typeof body.maxFiles === "number" && body.maxFiles > 0
      ? Math.floor(body.maxFiles)
      : null;
  const maxTotalBytes =
    typeof body.maxTotalBytes === "number" && body.maxTotalBytes > 0
      ? Math.floor(body.maxTotalBytes)
      : null;
  const expiresAt = parseExpiresIn(body.expiresIn ?? null);
  const label = (body.label ?? "").trim().slice(0, 200) || null;

  const id = generateFileId();
  const db = createDb(c.env.DATABASE_URL);
  await db.insert(shareLinks).values({
    id,
    ownerUserId: user.id,
    label,
    maxFiles,
    maxTotalBytes,
    allowedExtensions,
    status: "open",
    expiresAt,
  });

  return c.json({
    id,
    label,
    maxFiles,
    maxTotalBytes,
    allowedExtensions,
    status: "open",
    shortUrl: null,
    expiresAt: expiresAt?.toISOString() ?? null,
    confirmedAt: null,
    createdAt: new Date().toISOString(),
    url: `/u/${id}`,
    fileCount: 0,
    bytesUsed: 0,
  });
});

// Get a share link with its files (owner view).
adminApp.get("/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const db = createDb(c.env.DATABASE_URL);

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.id, id))
    .limit(1);

  if (!link) return c.json({ error: "Share link not found" }, 404);
  if (link.ownerUserId !== user.id && !user.isAdmin) {
    return c.json({ error: "Not authorized" }, 403);
  }

  const linkFiles = await db
    .select()
    .from(files)
    .where(eq(files.shareLinkId, id))
    .orderBy(desc(files.createdAt));

  return c.json({
    id: link.id,
    label: link.label,
    maxFiles: link.maxFiles,
    maxTotalBytes: link.maxTotalBytes,
    allowedExtensions: link.allowedExtensions,
    status: link.status,
    shortUrl: link.shortUrl,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    confirmedAt: link.confirmedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
    url: `/u/${link.id}`,
    files: linkFiles.map((f) => ({
      id: f.id,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      createdAt: f.createdAt.toISOString(),
    })),
  });
});

// Delete a share link, plus all files uploaded into it.
adminApp.delete("/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const db = createDb(c.env.DATABASE_URL);

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.id, id))
    .limit(1);

  if (!link) return c.json({ error: "Share link not found" }, 404);
  if (link.ownerUserId !== user.id && !user.isAdmin) {
    return c.json({ error: "Not authorized" }, 403);
  }

  const linkFiles = await db
    .select({ id: files.id, r2Key: files.r2Key })
    .from(files)
    .where(eq(files.shareLinkId, id));

  for (const f of linkFiles) {
    try {
      await c.env.R2_BUCKET.delete(f.r2Key);
    } catch (err) {
      console.warn("R2 delete failed for", f.r2Key, err);
    }
  }
  await db.delete(files).where(eq(files.shareLinkId, id));
  await db.delete(shareLinks).where(eq(shareLinks.id, id));

  return c.json({ ok: true });
});

// Shorten this share link's URL via Pika and persist the result.
adminApp.post("/:id/shorten", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  if (!pikaEnabled(c.env)) {
    return c.json({ error: "Shortener is not configured" }, 501);
  }

  const db = createDb(c.env.DATABASE_URL);
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.id, id))
    .limit(1);
  if (!link) return c.json({ error: "Share link not found" }, 404);
  if (link.ownerUserId !== user.id && !user.isAdmin) {
    return c.json({ error: "Not authorized" }, 403);
  }
  if (link.shortUrl) return c.json({ shortUrl: link.shortUrl });

  const longUrl = `${new URL(c.req.url).origin}/u/${id}`;
  try {
    const { shortUrl } = await shortenWithPika(c.env, longUrl);
    await db
      .update(shareLinks)
      .set({ shortUrl })
      .where(eq(shareLinks.id, id));
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

// ─────────────────────────────────────────────────────────────────────
// Public (anon) routes — mounted at /api/u
// ─────────────────────────────────────────────────────────────────────
const publicApp = new Hono<PublicEnv>();

function isLinkExpired(expiresAt: Date | null | undefined): boolean {
  return !!expiresAt && new Date() > expiresAt;
}

// Public link metadata + (post-confirm) file list for download.
publicApp.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env.DATABASE_URL);

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.id, id))
    .limit(1);
  if (!link) return c.json({ error: "Share link not found" }, 404);

  const expired = isLinkExpired(link.expiresAt);
  const linkFiles = await db
    .select()
    .from(files)
    .where(eq(files.shareLinkId, id))
    .orderBy(desc(files.createdAt));

  const totalBytes = linkFiles.reduce((acc, f) => acc + f.size, 0);

  return c.json({
    id: link.id,
    label: link.label,
    status: expired && link.status === "open" ? "expired" : link.status,
    maxFiles: link.maxFiles,
    maxTotalBytes: link.maxTotalBytes,
    allowedExtensions: link.allowedExtensions,
    shortUrl: link.shortUrl ?? null,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    confirmedAt: link.confirmedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
    fileCount: linkFiles.length,
    bytesUsed: totalBytes,
    files: linkFiles.map((f) => ({
      id: f.id,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      createdAt: f.createdAt.toISOString(),
    })),
  });
});

// Anonymous upload into an open share link.
publicApp.post("/:id/upload", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env.DATABASE_URL);

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.id, id))
    .limit(1);
  if (!link) return c.json({ error: "Share link not found" }, 404);
  if (link.status !== "open") {
    return c.json(
      { error: "This link is no longer accepting uploads" },
      409
    );
  }
  if (isLinkExpired(link.expiresAt)) {
    return c.json({ error: "This link has expired" }, 410);
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return c.json({ error: "No file provided" }, 400);

  // Per-file size cap (server-wide).
  const limits = parseLimits(c.env);
  const usage = await getUsage(db);
  const denial = checkUploadAllowed(usage, limits, file.size);
  if (denial) {
    return c.json(
      { error: denial.message, code: denial.code },
      denial.code === "upload_size" ? 413 : 507
    );
  }

  // Per-link extension allow-list.
  if (!extensionAllowed(link.allowedExtensions, file.name)) {
    return c.json(
      {
        error: `File type not allowed. Accepted: ${link.allowedExtensions.join(", ")}`,
        code: "extension_not_allowed",
      },
      415
    );
  }

  // Per-link aggregate constraints (count + total bytes).
  const linkFiles = await db
    .select({ size: files.size })
    .from(files)
    .where(eq(files.shareLinkId, id));
  const currentCount = linkFiles.length;
  const currentBytes = linkFiles.reduce((a, b) => a + b.size, 0);

  if (
    typeof link.maxFiles === "number" &&
    link.maxFiles !== null &&
    currentCount + 1 > link.maxFiles
  ) {
    return c.json(
      {
        error: `File count limit reached (${link.maxFiles})`,
        code: "max_files",
      },
      409
    );
  }
  if (
    typeof link.maxTotalBytes === "number" &&
    link.maxTotalBytes !== null &&
    currentBytes + file.size > link.maxTotalBytes
  ) {
    return c.json(
      {
        error: "Total size limit for this link reached",
        code: "max_total_bytes",
      },
      409
    );
  }

  const fileId = generateFileId();
  const r2Key = `share/${id}/${fileId}/${file.name}`;
  await c.env.R2_BUCKET.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
    customMetadata: {
      originalName: file.name,
      shareLinkId: id,
    },
  });

  await db.insert(files).values({
    id: fileId,
    userId: link.ownerUserId,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    r2Key,
    shareLinkId: id,
  });

  return c.json({
    id: fileId,
    originalName: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    createdAt: new Date().toISOString(),
  });
});

// Anonymous: remove an in-progress (still pre-confirm) file the uploader
// just added. Useful for "undo" before confirming. Allowed only while
// the link is still open.
publicApp.delete("/:id/files/:fileId", async (c) => {
  const id = c.req.param("id");
  const fileId = c.req.param("fileId");
  const db = createDb(c.env.DATABASE_URL);

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.id, id))
    .limit(1);
  if (!link) return c.json({ error: "Share link not found" }, 404);
  if (link.status !== "open") {
    return c.json({ error: "Link is locked" }, 409);
  }

  const [f] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.shareLinkId, id)))
    .limit(1);
  if (!f) return c.json({ error: "File not found" }, 404);

  try {
    await c.env.R2_BUCKET.delete(f.r2Key);
  } catch (err) {
    console.warn("R2 delete failed:", err);
  }
  await db.delete(files).where(eq(files.id, fileId));
  return c.json({ ok: true });
});

// Anonymous confirm — seals the link so no further uploads are accepted
// and the page flips into view-only mode.
publicApp.post("/:id/confirm", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env.DATABASE_URL);

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.id, id))
    .limit(1);
  if (!link) return c.json({ error: "Share link not found" }, 404);
  if (link.status !== "open") {
    return c.json({ error: "Link is already confirmed" }, 409);
  }
  if (isLinkExpired(link.expiresAt)) {
    return c.json({ error: "This link has expired" }, 410);
  }

  const linkFiles = await db
    .select({ id: files.id })
    .from(files)
    .where(eq(files.shareLinkId, id));
  if (linkFiles.length === 0) {
    return c.json(
      { error: "Upload at least one file before confirming" },
      400
    );
  }

  await db
    .update(shareLinks)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(eq(shareLinks.id, id));

  return c.json({ ok: true, status: "confirmed" });
});

// Anonymous direct download (post-confirm only).
publicApp.get("/:id/files/:fileId/raw", async (c) => {
  const id = c.req.param("id");
  const fileId = c.req.param("fileId");
  const db = createDb(c.env.DATABASE_URL);

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.id, id))
    .limit(1);
  if (!link) return c.json({ error: "Share link not found" }, 404);
  if (link.status !== "confirmed") {
    return c.json({ error: "Link is not yet confirmed" }, 409);
  }

  const [f] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.shareLinkId, id)))
    .limit(1);
  if (!f) return c.json({ error: "File not found" }, 404);

  const object = await c.env.R2_BUCKET.get(f.r2Key);
  if (!object) return c.json({ error: "File not found in storage" }, 404);

  await db
    .update(files)
    .set({ accessCount: f.accessCount + 1 })
    .where(eq(files.id, fileId));

  const headers = new Headers();
  headers.set("Content-Type", f.mimeType || "application/octet-stream");
  headers.set("Content-Length", f.size.toString());
  headers.set(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(f.originalName)}"`
  );
  headers.set("Cache-Control", "public, max-age=3600");
  return new Response(object.body, { headers });
});

export { adminApp as shareLinkAdminRoutes, publicApp as shareLinkPublicRoutes };
