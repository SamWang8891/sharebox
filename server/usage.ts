import { sql } from "drizzle-orm";
import type { Database } from "./db";
import type { Env, Usage, Limits } from "./types";

export function parseLimits(env: Env): Limits {
  const num = (v: string | undefined) => {
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    maxStorageBytes: num(env.MAX_TOTAL_STORAGE_BYTES),
    maxDownloads: num(env.MAX_TOTAL_DOWNLOADS),
    maxBandwidthBytes: num(env.MAX_TOTAL_BANDWIDTH_BYTES),
    maxUploadSize: parseInt(env.MAX_UPLOAD_SIZE ?? "83886080", 10),
  };
}

export async function getUsage(db: Database): Promise<Usage> {
  const rows = await db.execute<{
    storage: string | null;
    downloads: string | null;
    bandwidth: string | null;
    file_count: string | null;
  }>(sql`
    SELECT
      COALESCE(SUM(size), 0)::text                       AS storage,
      COALESCE(SUM(access_count), 0)::text               AS downloads,
      COALESCE(SUM(size * access_count), 0)::text        AS bandwidth,
      COUNT(*)::text                                     AS file_count
    FROM files
  `);
  const r = rows.rows[0];
  return {
    storageBytes: Number(r?.storage ?? 0),
    totalDownloads: Number(r?.downloads ?? 0),
    bandwidthBytes: Number(r?.bandwidth ?? 0),
    fileCount: Number(r?.file_count ?? 0),
  };
}

export type LimitDenial = {
  code: "storage" | "downloads" | "bandwidth" | "upload_size";
  message: string;
};

/** Check whether adding `incomingBytes` to current usage would breach storage limit. */
export function checkUploadAllowed(
  usage: Usage,
  limits: Limits,
  incomingBytes: number
): LimitDenial | null {
  if (incomingBytes > limits.maxUploadSize) {
    return {
      code: "upload_size",
      message: `File too large. Max ${Math.round(limits.maxUploadSize / 1024 / 1024)} MB per file.`,
    };
  }
  if (
    limits.maxStorageBytes !== null &&
    usage.storageBytes + incomingBytes > limits.maxStorageBytes
  ) {
    return {
      code: "storage",
      message: "Total storage limit reached. Ask admin to delete old files.",
    };
  }
  return null;
}

/** Check whether serving `fileBytes` (one more download) would breach download/bandwidth limits. */
export function checkDownloadAllowed(
  usage: Usage,
  limits: Limits,
  fileBytes: number
): LimitDenial | null {
  if (
    limits.maxDownloads !== null &&
    usage.totalDownloads + 1 > limits.maxDownloads
  ) {
    return {
      code: "downloads",
      message: "Download quota reached for this period.",
    };
  }
  if (
    limits.maxBandwidthBytes !== null &&
    usage.bandwidthBytes + fileBytes > limits.maxBandwidthBytes
  ) {
    return {
      code: "bandwidth",
      message: "Bandwidth quota reached for this period.",
    };
  }
  return null;
}
