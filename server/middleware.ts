import { createMiddleware } from "hono/factory";
import { createAuth } from "./auth";
import { createDb } from "./db";
import { allowedUsers } from "./schema";
import { eq } from "drizzle-orm";
import type { Env, UserInfo } from "./types";

type AuthEnv = {
  Bindings: Env;
  Variables: {
    user: UserInfo;
    auth: ReturnType<typeof createAuth>;
  };
};

/** Attach Better Auth instance to context */
export const authInstance = createMiddleware<AuthEnv>(async (c, next) => {
  c.set("auth", createAuth(c.env));
  await next();
});

/** Require authenticated user — sets c.var.user */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const auth = c.get("auth") ?? createAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminEmails = c.env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = adminEmails.includes(session.user.email.toLowerCase());

  // Check if user is admin or in allowed list
  if (!isAdmin) {
    const db = createDb(c.env.DATABASE_URL);
    const allowed = await db
      .select()
      .from(allowedUsers)
      .where(eq(allowedUsers.email, session.user.email.toLowerCase()));
    if (allowed.length === 0) {
      return c.json(
        { error: "Access denied. Contact admin for approval.", approved: false },
        403
      );
    }
  }

  c.set("user", {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
    isAdmin,
  });

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
