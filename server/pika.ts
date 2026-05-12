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

/**
 * Verify a Pika short URL is still alive by issuing a manual-redirect GET.
 * A live key responds with a 3xx redirect to the long URL; a deleted/expired
 * key responds with 404 or 410. Transient errors (timeout, network) are
 * treated as alive so we don't wipe good URLs on a Pika blip.
 */
export async function verifyPikaUrl(shortUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(shortUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    if (res.status === 404 || res.status === 410) return false;
    return true;
  } catch {
    return true;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verify a single shortUrl. If dead, run the supplied DB-clear callback and
 * return null; otherwise return the URL unchanged.
 */
export async function checkAndPruneShortUrl(
  shortUrl: string | null | undefined,
  clearInDb: () => Promise<void>
): Promise<string | null> {
  if (!shortUrl) return null;
  if (await verifyPikaUrl(shortUrl)) return shortUrl;
  await clearInDb();
  return null;
}

/**
 * Verify every record's shortUrl in parallel; for any dead ones, run a single
 * batched DB-clear callback and null-out the field on each affected item.
 */
export async function checkAndPruneShortUrls<
  T extends { id: string; shortUrl: string | null }
>(items: T[], clearByIds: (ids: string[]) => Promise<void>): Promise<void> {
  const withShort = items.filter((i) => !!i.shortUrl);
  if (withShort.length === 0) return;
  const results = await Promise.all(
    withShort.map(async (i) => ({
      id: i.id,
      alive: await verifyPikaUrl(i.shortUrl as string),
    }))
  );
  const deadIds = results.filter((r) => !r.alive).map((r) => r.id);
  if (deadIds.length === 0) return;
  await clearByIds(deadIds);
  const dead = new Set(deadIds);
  for (const i of items) {
    if (dead.has(i.id)) i.shortUrl = null;
  }
}
