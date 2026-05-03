import type { Env } from "./types";
import { getFileTokenSecret } from "./utils";

/** Extensions that Collabora can typically edit. Used as a fast filter. */
const EDITABLE_EXTENSIONS = new Set([
  "doc",
  "docx",
  "odt",
  "rtf",
  "xls",
  "xlsx",
  "ods",
  "csv",
  "ppt",
  "pptx",
  "odp",
  "txt",
]);

export function getExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

export function isEditableExtension(filename: string): boolean {
  return EDITABLE_EXTENSIONS.has(getExtension(filename));
}

// ── WOPI access tokens ──────────────────────────────────────────────
//
// Token format: base64url(JSON({fileId, userId, write, exp})) + "." + base64url(HMAC-SHA256)
// Tokens are validated on every WOPI request from Collabora.

export type WopiClaims = {
  fileId: string;
  userId: string;
  write: boolean;
  exp: number; // unix seconds
};

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

export async function createWopiToken(
  env: Env,
  claims: Omit<WopiClaims, "exp">,
  ttlSeconds = 3600
): Promise<{ token: string; exp: number }> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = b64urlEncode(
    new TextEncoder().encode(JSON.stringify({ ...claims, exp }))
  );
  const sig = await hmac(getFileTokenSecret(env), payload);
  return { token: `${payload}.${sig}`, exp };
}

export async function verifyWopiToken(
  env: Env,
  token: string
): Promise<WopiClaims | null> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await hmac(getFileTokenSecret(env), payload);
  // constant-time-ish equality
  if (expected.length !== sig.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  if (mismatch !== 0) return null;
  try {
    const claims = JSON.parse(
      new TextDecoder().decode(b64urlDecode(payload))
    ) as WopiClaims;
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

// ── Collabora discovery ─────────────────────────────────────────────
//
// One-shot fetch of <COLLABORA_URL>/hosting/discovery → cache parsed
// per-extension action URL. Cached at module scope for the lifetime of
// the Worker instance.

type DiscoveryActions = Record<string, string>; // ext → urlsrc

let discoveryCache: { url: string; actions: DiscoveryActions; fetchedAt: number } | null =
  null;
const DISCOVERY_TTL_MS = 60 * 60 * 1000; // 1h

export async function getEditActionUrl(
  env: Env,
  ext: string
): Promise<string | null> {
  if (!env.COLLABORA_URL) return null;
  const collaboraUrl = env.COLLABORA_URL.replace(/\/$/, "");

  const stale =
    !discoveryCache ||
    discoveryCache.url !== collaboraUrl ||
    Date.now() - discoveryCache.fetchedAt > DISCOVERY_TTL_MS;

  if (stale) {
    let xml: string;
    try {
      const res = await fetch(`${collaboraUrl}/hosting/discovery`);
      if (!res.ok) {
        console.error(
          `Collabora discovery failed: ${res.status} ${res.statusText}`
        );
        return null;
      }
      xml = await res.text();
    } catch (err) {
      console.error("Collabora discovery fetch threw:", err);
      return null;
    }
    discoveryCache = {
      url: collaboraUrl,
      actions: parseDiscovery(xml),
      fetchedAt: Date.now(),
    };
  }

  return discoveryCache!.actions[ext] ?? null;
}

/** Parse Collabora discovery XML into { ext: editUrlsrc }. Regex-based — XML is simple and stable. */
function parseDiscovery(xml: string): DiscoveryActions {
  const out: DiscoveryActions = {};
  const actionRe = /<action\b([^/>]*)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = actionRe.exec(xml))) {
    const attrs = parseAttrs(m[1]);
    if (attrs.name !== "edit") continue;
    const ext = attrs.ext?.toLowerCase();
    const urlsrc = attrs.urlsrc;
    if (ext && urlsrc && !(ext in out)) {
      out[ext] = urlsrc;
    }
  }
  return out;
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\w[\w-]*)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out[m[1]] = m[2];
  return out;
}
