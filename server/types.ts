export interface Env {
  R2_BUCKET: R2Bucket;
  DATABASE_URL: string;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
  ADMIN_EMAILS: string;
  /** Max single-file upload size in bytes. Default 80 MB. */
  MAX_UPLOAD_SIZE?: string;
  /** Hard cap on total storage across all files (bytes). Empty = unlimited. */
  MAX_TOTAL_STORAGE_BYTES?: string;
  /** Hard cap on total downloads across all files. Empty = unlimited. */
  MAX_TOTAL_DOWNLOADS?: string;
  /** Hard cap on total bandwidth (sum of size × downloads, bytes). Empty = unlimited. */
  MAX_TOTAL_BANDWIDTH_BYTES?: string;
  /** Optional, used to sign short-lived file access tokens. Falls back to CLERK_SECRET_KEY. */
  FILE_TOKEN_SECRET?: string;
  /** Optional Collabora Online base URL (e.g. https://ncoffice.smashit.tw). When unset, edit feature is hidden. */
  COLLABORA_URL?: string;
}

export type UserInfo = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  isAdmin: boolean;
};

export type Usage = {
  storageBytes: number;
  totalDownloads: number;
  bandwidthBytes: number;
  fileCount: number;
};

export type Limits = {
  maxStorageBytes: number | null;
  maxDownloads: number | null;
  maxBandwidthBytes: number | null;
  maxUploadSize: number;
};
