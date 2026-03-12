import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";
import { fileRoutes } from "./routes/files";
import { adminRoutes } from "./routes/admin";
import { createDb } from "./db";
import { allowedUsers } from "./schema";
import { eq } from "drizzle-orm";
import type { Env, UserInfo } from "./types";

type AppEnv = {
  Bindings: Env;
  Variables: { user: UserInfo };
};

const app = new Hono<AppEnv>();

// CORS for development
app.use("/api/*", cors());

// ── Better Auth routes ──────────────────────────────────────────────
app.on(["GET", "POST"], "/api/auth/*", (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

// ── Current user info (includes approval status) ────────────────────
app.get("/api/me", async (c) => {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json({ user: null });
  }

  const adminEmails = c.env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = adminEmails.includes(session.user.email.toLowerCase());

  let isApproved = isAdmin;
  if (!isAdmin) {
    const db = createDb(c.env.DATABASE_URL);
    const allowed = await db
      .select()
      .from(allowedUsers)
      .where(eq(allowedUsers.email, session.user.email.toLowerCase()));
    isApproved = allowed.length > 0;
  }

  return c.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      isAdmin,
      isApproved,
    },
  });
});

// ── File routes ─────────────────────────────────────────────────────
app.route("/api/files", fileRoutes);

// ── Admin routes ────────────────────────────────────────────────────
app.route("/api/admin", adminRoutes);

export { app };
