import { Hono } from "hono";
import { cors } from "hono/cors";
import { eq } from "drizzle-orm";
import { fileRoutes } from "./routes/files";
import { adminRoutes } from "./routes/admin";
import { createDb } from "./db";
import { allowedUsers } from "./schema";
import { verifyClerkToken, extractBearerToken } from "./clerk-auth";
import type { Env, UserInfo } from "./types";

type AppEnv = {
  Bindings: Env;
  Variables: { user: UserInfo };
};

const app = new Hono<AppEnv>();

app.use("/api/*", cors());

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

app.route("/api/files", fileRoutes);
app.route("/api/admin", adminRoutes);

export { app };
