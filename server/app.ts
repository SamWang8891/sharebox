import { Hono } from "hono";
import { cors } from "hono/cors";
import { eq } from "drizzle-orm";
import { fileRoutes } from "./routes/files";
import { adminRoutes } from "./routes/admin";
import { createDb } from "./db";
import { allowedUsers } from "./schema";
import { verifyStackToken, extractBearerToken } from "./stack-auth";
import type { Env, UserInfo } from "./types";

type AppEnv = {
  Bindings: Env;
  Variables: { user: UserInfo };
};

const app = new Hono<AppEnv>();

app.use("/api/*", cors());

// ── Current user info (includes approval status) ────────────────────
// Returns { user: null } if no/invalid token, { user: {...} } otherwise.
// Approval status is computed server-side from ADMIN_EMAILS + allowed_users.
app.get("/api/me", async (c) => {
  const token = extractBearerToken(c.req.raw.headers);
  if (!token) return c.json({ user: null });

  const stackUser = await verifyStackToken(c.env, token);
  if (!stackUser) return c.json({ user: null });

  const adminEmails = c.env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = adminEmails.includes(stackUser.email.toLowerCase());

  let isApproved = isAdmin;
  if (!isAdmin) {
    const db = createDb(c.env.DATABASE_URL);
    const allowed = await db
      .select()
      .from(allowedUsers)
      .where(eq(allowedUsers.email, stackUser.email.toLowerCase()));
    isApproved = allowed.length > 0;
  }

  return c.json({
    user: { ...stackUser, isAdmin, isApproved },
  });
});

app.route("/api/files", fileRoutes);
app.route("/api/admin", adminRoutes);

export { app };
