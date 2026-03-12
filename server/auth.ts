import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { Env } from "./types";
import * as schema from "./schema";

export function createAuth(env: Env) {
  const sql = neon(env.DATABASE_URL);
  const db = drizzle(sql);

  const baseURL = env.NEON_AUTH_URL ?? env.BETTER_AUTH_URL;
  const secret = env.NEON_AUTH_SECRET ?? env.BETTER_AUTH_SECRET;

  if (!baseURL || !secret) {
    throw new Error(
      "Missing auth config: set NEON_AUTH_URL/NEON_AUTH_SECRET (or legacy BETTER_AUTH_URL/BETTER_AUTH_SECRET)"
    );
  }

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    baseURL,
    secret,
    basePath: "/api/auth",
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
