import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb } from "../db";
import { allowedUsers } from "../schema";
import { requireAuth, requireAdmin } from "../middleware";
import { parseLimits, getUsage } from "../usage";
import type { Env, UserInfo } from "../types";

type AdminEnv = {
  Bindings: Env;
  Variables: { user: UserInfo };
};

const app = new Hono<AdminEnv>();

app.use("*", requireAuth, requireAdmin);

// ── List allowed users ──────────────────────────────────────────────
app.get("/users", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const users = await db.select().from(allowedUsers);
  const adminEmails = c.env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return c.json({
    admins: adminEmails,
    allowedUsers: users.map((u) => ({
      email: u.email,
      addedBy: u.addedBy,
      createdAt: u.createdAt.toISOString(),
    })),
  });
});

// ── Add allowed user ────────────────────────────────────────────────
app.post("/users", async (c) => {
  const admin = c.get("user");
  const { email } = await c.req.json<{ email: string }>();

  if (!email?.trim()) {
    return c.json({ error: "Email required" }, 400);
  }

  const db = createDb(c.env.DATABASE_URL);
  await db
    .insert(allowedUsers)
    .values({
      email: email.trim().toLowerCase(),
      addedBy: admin.id,
    })
    .onConflictDoNothing();

  return c.json({ ok: true, email: email.trim().toLowerCase() });
});

// ── Remove allowed user ─────────────────────────────────────────────
app.delete("/users/:email", async (c) => {
  const email = decodeURIComponent(c.req.param("email")).toLowerCase();
  const db = createDb(c.env.DATABASE_URL);
  await db.delete(allowedUsers).where(eq(allowedUsers.email, email));
  return c.json({ ok: true });
});

// ── Usage / quotas ──────────────────────────────────────────────────
app.get("/usage", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const [usage, limits] = await Promise.all([
    getUsage(db),
    Promise.resolve(parseLimits(c.env)),
  ]);
  return c.json({ usage, limits });
});

export { app as adminRoutes };
