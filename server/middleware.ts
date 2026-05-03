import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { createDb } from "./db";
import { allowedUsers } from "./schema";
import { verifyClerkToken, extractBearerToken } from "./clerk-auth";
import type { Env, UserInfo } from "./types";

type AuthEnv = {
  Bindings: Env;
  Variables: { user: UserInfo };
};

function adminEmailsFromEnv(env: Env): string[] {
  return env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Require authenticated, approved user — sets c.var.user */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = extractBearerToken(c.req.raw.headers);
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const clerkUser = await verifyClerkToken(c.env, token);
  if (!clerkUser) {
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  const adminEmails = adminEmailsFromEnv(c.env);
  const isAdmin = adminEmails.includes(clerkUser.email.toLowerCase());

  if (!isAdmin) {
    const db = createDb(c.env.DATABASE_URL);
    const allowed = await db
      .select()
      .from(allowedUsers)
      .where(eq(allowedUsers.email, clerkUser.email.toLowerCase()));
    if (allowed.length === 0) {
      return c.json(
        { error: "Access denied. Contact admin for approval.", approved: false },
        403
      );
    }
  }

  c.set("user", { ...clerkUser, isAdmin });
  await next();
});

/** Require admin role */
export const requireAdmin = createMiddleware<AuthEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user?.isAdmin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  await next();
});
