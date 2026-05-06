import type { Env } from "./types";

export type PikaExpiresIn = "1h" | "12h" | "1d" | "7d" | "never";

export function pikaEnabled(env: Env): boolean {
  return !!env.PIKA_BASE_URL && env.PIKA_BASE_URL.trim().length > 0;
}

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Shorten a URL using a Pika instance.
 * Pika's create endpoint is public (no auth) and accepts form-encoded fields.
 */
export async function shortenWithPika(
  env: Env,
  longUrl: string,
  expiresIn: PikaExpiresIn = "never"
): Promise<{ shortUrl: string }> {
  if (!pikaEnabled(env)) {
    throw new Error("Shortener not configured (PIKA_BASE_URL missing)");
  }
  const base = normalizeBase(env.PIKA_BASE_URL!);
  const body = new URLSearchParams();
  body.set("url", longUrl);
  body.set("expires_in", expiresIn);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(`${base}/api/v3/create_record`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Pika error (${res.status}): ${text.slice(0, 200) || res.statusText}`
    );
  }

  const json = (await res.json()) as {
    message?: string;
    data?: { shortened_key?: string };
  };
  const key = json?.data?.shortened_key;
  if (!key) {
    throw new Error(`Pika returned no shortened_key: ${JSON.stringify(json)}`);
  }
  return { shortUrl: `${base}/${key}` };
}
