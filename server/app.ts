import { Hono } from "hono";
import { cors } from "hono/cors";
import { eq } from "drizzle-orm";
import { fileRoutes } from "./routes/files";
import { adminRoutes } from "./routes/admin";
import { wopiRoutes } from "./routes/wopi";
import {
  shareLinkAdminRoutes,
  shareLinkPublicRoutes,
} from "./routes/shareLinks";
import { createDb } from "./db";
import { allowedUsers } from "./schema";
import { verifyClerkToken, extractBearerToken } from "./clerk-auth";
import { parseLimits } from "./usage";
import { pikaEnabled, shortenWithPika } from "./pika";
import { requireAuth } from "./middleware";
import type { Env, UserInfo } from "./types";

type AppEnv = {
  Bindings: Env;
  Variables: { user: UserInfo };
};

const app = new Hono<AppEnv>();

// Top-level error handler — surface the actual error as JSON instead of
// letting Cloudflare return a generic 502 HTML page.
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      error: "Internal server error",
      message: err instanceof Error ? err.message : String(err),
    },
    500
  );
});

app.use("/api/*", cors());

// ── Public config (no auth) ─────────────────────────────────────────
app.get("/api/config", (c) => {
  const limits = parseLimits(c.env);
  return c.json({
    pikaEnabled: pikaEnabled(c.env),
    maxUploadSize: limits.maxUploadSize,
  });
});

// ── Current user info (includes approval status) ────────────────────
app.get("/api/me", async (c) => {
  const token = extractBearerToken(c.req.raw.headers);
  if (!token) return c.json({ user: null });

  const clerkUser = await verifyClerkToken(c.env, token);
  if (!clerkUser) return c.json({ user: null });

  const adminEmails = c.env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = adminEmails.includes(clerkUser.email.toLowerCase());

  let isApproved = isAdmin;
  if (!isAdmin) {
    const db = createDb(c.env.DATABASE_URL);
    const allowed = await db
      .select()
      .from(allowedUsers)
      .where(eq(allowedUsers.email, clerkUser.email.toLowerCase()));
    isApproved = allowed.length > 0;
  }

  return c.json({
    user: { ...clerkUser, isAdmin, isApproved },
  });
});

// ── Generic URL shortener (auth, used by file links etc.) ───────────
app.post("/api/shorten", requireAuth, async (c) => {
  if (!pikaEnabled(c.env)) {
    return c.json({ error: "Shortener is not configured" }, 501);
  }
  const { url, expiresIn } = await c.req.json<{
    url: string;
    expiresIn?: "1h" | "12h" | "1d" | "7d" | "never";
  }>();
  if (!url || typeof url !== "string") {
    return c.json({ error: "Missing url" }, 400);
  }
  try {
    const result = await shortenWithPika(c.env, url, expiresIn ?? "never");
    return c.json(result);
  } catch (err) {
    console.error("Shortener proxy failed:", err);
    return c.json(
      {
        error: "Shortener failed",
        message: err instanceof Error ? err.message : String(err),
      },
      502
    );
  }
});

app.route("/api/files", fileRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/share-links", shareLinkAdminRoutes);
app.route("/api/u", shareLinkPublicRoutes);
app.route("/wopi", wopiRoutes);

export { app };
