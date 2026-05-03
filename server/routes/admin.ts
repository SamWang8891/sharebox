import { Hono } from "hono";
import { eq, isNull } from "drizzle-orm";
import { createDb } from "../db";
import { allowedUsers, usersSync } from "../schema";
import { requireAuth, requireAdmin } from "../middleware";
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

// ── List all registered users (from Neon Auth sync table) ───────────
app.get("/all-users", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  // Only non-deleted Stack Auth users
  const users = await db
    .select()
    .from(usersSync)
    .where(isNull(usersSync.deletedAt));

  const adminEmails = c.env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const allowed = await db.select().from(allowedUsers);
  const allowedEmails = new Set(allowed.map((a) => a.email));

  return c.json(
    users.map((u) => {
      const email = u.email ?? "";
      const lower = email.toLowerCase();
      return {
        id: u.id,
        name: u.name,
        email,
        createdAt: u.createdAt?.toISOString() ?? null,
        isAdmin: adminEmails.includes(lower),
        isAllowed:
          adminEmails.includes(lower) || allowedEmails.has(lower),
      };
    })
  );
});

export { app as adminRoutes };
