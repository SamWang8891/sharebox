import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb } from "../db";
import { files } from "../schema";
import { verifyWopiToken } from "../wopi";
import type { Env } from "../types";

type WopiEnv = { Bindings: Env };

const app = new Hono<WopiEnv>();

/**
 * WOPI host endpoints — Collabora calls these on our backend.
 * Auth is by `?access_token=<wopi-token>` (NOT Clerk session).
 *
 * Spec: https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/online/
 */

async function authWopi(c: any) {
  const token = c.req.query("access_token");
  if (!token) return null;
  return verifyWopiToken(c.env, token);
}

// ── CheckFileInfo ───────────────────────────────────────────────────
app.get("/files/:id", async (c) => {
  const claims = await authWopi(c);
  if (!claims) return c.text("Unauthorized", 401);
  const fileId = c.req.param("id");
  if (claims.fileId !== fileId) return c.text("Forbidden", 403);

  const db = createDb(c.env.DATABASE_URL);
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);
  if (!file) return c.text("Not Found", 404);

  return c.json({
    BaseFileName: file.originalName,
    Size: file.size,
    OwnerId: file.userId,
    UserId: claims.userId,
    UserFriendlyName: "User",
    UserCanWrite: claims.write,
    Version: `${file.size}-${file.createdAt.getTime()}`,
    SupportsUpdate: claims.write,
    SupportsLocks: false,
    DisablePrint: false,
    DisableExport: false,
    DisableCopy: false,
    LastModifiedTime: file.createdAt.toISOString(),
  });
});

// ── GetFile ─────────────────────────────────────────────────────────
app.get("/files/:id/contents", async (c) => {
  const claims = await authWopi(c);
  if (!claims) return c.text("Unauthorized", 401);
  const fileId = c.req.param("id");
  if (claims.fileId !== fileId) return c.text("Forbidden", 403);

  const db = createDb(c.env.DATABASE_URL);
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);
  if (!file) return c.text("Not Found", 404);

  const object = await c.env.R2_BUCKET.get(file.r2Key);
  if (!object) return c.text("Not Found", 404);

  return new Response(object.body, {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": file.size.toString(),
    },
  });
});

// ── PutFile (save) ──────────────────────────────────────────────────
app.post("/files/:id/contents", async (c) => {
  const claims = await authWopi(c);
  if (!claims) return c.text("Unauthorized", 401);
  if (!claims.write) return c.text("Forbidden", 403);
  const fileId = c.req.param("id");
  if (claims.fileId !== fileId) return c.text("Forbidden", 403);

  const db = createDb(c.env.DATABASE_URL);
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);
  if (!file) return c.text("Not Found", 404);

  // Replace the R2 object with the new contents.
  const body = await c.req.arrayBuffer();
  await c.env.R2_BUCKET.put(file.r2Key, body, {
    httpMetadata: {
      contentType: file.mimeType || "application/octet-stream",
    },
    customMetadata: {
      originalName: file.originalName,
      uploadedBy: file.userId,
    },
  });

  // Update size in DB so usage accounting stays accurate.
  await db
    .update(files)
    .set({ size: body.byteLength })
    .where(eq(files.id, fileId));

  return c.json({ LastModifiedTime: new Date().toISOString() });
});

export { app as wopiRoutes };
