import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import type { Env } from "./types";

export type ClerkUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
};

/**
 * Decode the Clerk publishable key to get the Frontend API hostname.
 * Format: pk_(test|live)_<base64url(hostname + '$')>
 */
function getFrontendApi(publishableKey: string): string {
  const parts = publishableKey.split("_");
  const encoded = parts[parts.length - 1];
  // base64 (not url-safe), may need padding
  const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
  const decoded = atob(padded);
  return decoded.replace(/\$+$/, "");
}

const jwksCache = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();

function getJwks(env: Env) {
  const api = getFrontendApi(env.CLERK_PUBLISHABLE_KEY);
  let jwks = jwksCache.get(api);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${api}/.well-known/jwks.json`));
    jwksCache.set(api, jwks);
  }
  return jwks;
}

type ClerkApiUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  image_url: string | null;
  primary_email_address_id: string | null;
  email_addresses: Array<{ id: string; email_address: string }>;
};

async function fetchClerkUser(
  env: Env,
  userId: string
): Promise<ClerkApiUser | null> {
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as ClerkApiUser;
}

/**
 * Verify a Clerk session JWT against the project's JWKS, then fetch
 * user details from Clerk's API. Returns the user or null.
 */
export async function verifyClerkToken(
  env: Env,
  token: string
): Promise<ClerkUser | null> {
  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(token, getJwks(env));
    payload = verified.payload;
  } catch {
    return null;
  }

  const userId = typeof payload.sub === "string" ? payload.sub : null;
  if (!userId) return null;

  const user = await fetchClerkUser(env, userId);
  if (!user) return null;

  const primary = user.email_addresses.find(
    (e) => e.id === user.primary_email_address_id
  );
  const email = primary?.email_address ?? user.email_addresses[0]?.email_address;
  if (!email) return null;

  const name =
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.username ||
    email;

  return { id: userId, email, name, image: user.image_url };
}

export function extractBearerToken(headers: Headers): string | null {
  const auth = headers.get("authorization") ?? headers.get("Authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
