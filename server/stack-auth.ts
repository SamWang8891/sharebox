import type { Env } from "./types";

export type StackUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
};

/**
 * Verify a Stack Auth access token by calling Stack Auth's API.
 * Returns the user on success, null otherwise.
 *
 * One round-trip per request — fine for low traffic. Switch to JWT/JWKS
 * verification if you need to scale.
 */
export async function verifyStackToken(
  env: Env,
  accessToken: string
): Promise<StackUser | null> {
  const res = await fetch("https://api.stack-auth.com/api/v1/users/me", {
    headers: {
      "x-stack-access-type": "server",
      "x-stack-project-id": env.STACK_PROJECT_ID,
      "x-stack-publishable-client-key": env.STACK_PUBLISHABLE_CLIENT_KEY,
      "x-stack-secret-server-key": env.STACK_SECRET_SERVER_KEY,
      "x-stack-access-token": accessToken,
    },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    id: string;
    primary_email: string | null;
    display_name: string | null;
    profile_image_url: string | null;
  };

  if (!data.primary_email) return null;

  return {
    id: data.id,
    email: data.primary_email,
    name: data.display_name ?? data.primary_email,
    image: data.profile_image_url,
  };
}

/** Extract bearer token from Authorization header */
export function extractBearerToken(headers: Headers): string | null {
  const auth = headers.get("authorization") ?? headers.get("Authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
