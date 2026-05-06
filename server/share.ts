/** Helpers for working with share-link extension allowlists and quotas. */

/** Extract the lowercase extension (without dot) from a filename, or "" if none. */
export function getExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  if (i < 0 || i === filename.length - 1) return "";
  return filename.slice(i + 1).toLowerCase();
}

/** Normalize an allow-list entry to a bare lowercase extension (no dot, no whitespace). */
export function normalizeExtension(raw: string): string {
  return raw.trim().toLowerCase().replace(/^\.+/, "");
}

/** Normalize an array of allow-list entries; drops empties and duplicates. */
export function normalizeExtensions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const ext = normalizeExtension(raw);
    if (ext) out.add(ext);
  }
  return [...out];
}

/**
 * Check whether a filename is allowed by the extension allow-list.
 * An empty list means "any type allowed".
 */
export function extensionAllowed(
  allowed: string[],
  filename: string
): boolean {
  if (!allowed || allowed.length === 0) return true;
  const ext = getExtension(filename);
  if (!ext) return false;
  return allowed.includes(ext);
}

/** Convert an "expiresIn" string ("1h", "24h", "7d", etc.) to a Date or null. */
export function parseExpiresIn(input: string | null | undefined): Date | null {
  if (!input || input === "never") return null;
  const hours = parseInt(input, 10);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return new Date(Date.now() + hours * 3600 * 1000);
}
