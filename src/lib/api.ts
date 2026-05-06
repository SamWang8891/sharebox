const BASE = "/api";

/** Read the Clerk session token from the global Clerk instance, if present. */
async function authHeader(): Promise<Record<string, string>> {
  const clerk = (window as unknown as { Clerk?: any }).Clerk;
  const session = clerk?.session;
  if (!session) return {};
  const token = await session.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  for (const [k, v] of Object.entries(await authHeader())) headers.set(k, v);

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, (body as any).error || res.statusText);
  }
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// ── User ────────────────────────────────────────────────────────────

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  isAdmin: boolean;
  isApproved: boolean;
};

export async function getMe(): Promise<CurrentUser | null> {
  const data = await request<{ user: CurrentUser | null }>("/me");
  return data.user;
}

// ── Files ───────────────────────────────────────────────────────────

export type FileInfo = {
  id: string;
  originalName: string;
  mimeType: string | null;
  size: number;
  hasPassword: boolean;
  expiresAt: string | null;
  createdAt: string;
  accessCount: number;
  url?: string;
  /** Present on /files/:id only. */
  canEdit?: boolean;
  isOwner?: boolean;
};

export type EditSession = {
  actionUrl: string;
  wopiSrc: string;
  accessToken: string;
  accessTokenTtl: number;
};

export async function startEditSession(id: string): Promise<EditSession> {
  return request(`/files/${id}/edit`);
}

export async function listFiles(): Promise<FileInfo[]> {
  return request("/files");
}

export async function uploadFile(
  file: File,
  options: { password?: string; expiresIn?: string }
): Promise<FileInfo> {
  const formData = new FormData();
  formData.append("file", file);
  if (options.password) formData.append("password", options.password);
  if (options.expiresIn) formData.append("expiresIn", options.expiresIn);

  return request("/files", { method: "POST", body: formData });
}

export async function getFileInfo(id: string): Promise<FileInfo> {
  return request(`/files/${id}`);
}

export async function deleteFile(id: string): Promise<void> {
  await request(`/files/${id}`, { method: "DELETE" });
}

export async function verifyFilePassword(
  id: string,
  password: string
): Promise<{ token: string; expires: number }> {
  return request(`/files/${id}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

export function getRawFileUrl(id: string, token?: string): string {
  const base = `${BASE}/files/${id}/raw`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

// ── App config (public) ─────────────────────────────────────────────

export type AppConfig = {
  pikaEnabled: boolean;
  maxUploadSize: number;
};

export async function getConfig(): Promise<AppConfig> {
  return request("/config");
}

// ── URL shortener ───────────────────────────────────────────────────

export async function shortenUrl(
  url: string,
  expiresIn?: "1h" | "12h" | "1d" | "7d" | "never"
): Promise<{ shortUrl: string }> {
  return request("/shorten", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, expiresIn: expiresIn ?? "never" }),
  });
}

// ── Share links (drop-box) ──────────────────────────────────────────

export type ShareLinkStatus = "open" | "confirmed" | "expired";

export type ShareLink = {
  id: string;
  label: string | null;
  maxFiles: number | null;
  maxTotalBytes: number | null;
  allowedExtensions: string[];
  status: ShareLinkStatus;
  shortUrl: string | null;
  expiresAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  url: string;
  fileCount: number;
  bytesUsed: number;
};

export type ShareLinkFile = {
  id: string;
  originalName: string;
  mimeType: string | null;
  size: number;
  createdAt: string;
};

export type ShareLinkDetail = Omit<ShareLink, "fileCount" | "bytesUsed"> & {
  files: ShareLinkFile[];
};

export type CreateShareLinkInput = {
  label?: string;
  maxFiles?: number | null;
  maxTotalBytes?: number | null;
  allowedExtensions?: string[];
  expiresIn?: string;
};

export async function listShareLinks(): Promise<ShareLink[]> {
  return request("/share-links");
}

export async function createShareLink(
  input: CreateShareLinkInput
): Promise<ShareLink> {
  return request("/share-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getShareLink(id: string): Promise<ShareLinkDetail> {
  return request(`/share-links/${id}`);
}

export async function deleteShareLink(id: string): Promise<void> {
  await request(`/share-links/${id}`, { method: "DELETE" });
}

export async function shortenShareLink(
  id: string
): Promise<{ shortUrl: string }> {
  return request(`/share-links/${id}/shorten`, { method: "POST" });
}

// Public (anon) share-link API — no auth header needed, but `request()`
// silently skips it when there's no Clerk session, so we can still use it.

export type PublicShareLink = {
  id: string;
  label: string | null;
  status: ShareLinkStatus;
  maxFiles: number | null;
  maxTotalBytes: number | null;
  allowedExtensions: string[];
  expiresAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  fileCount: number;
  bytesUsed: number;
  files: ShareLinkFile[];
};

export async function getPublicShareLink(
  id: string
): Promise<PublicShareLink> {
  return request(`/u/${id}`);
}

export async function publicShareUpload(
  id: string,
  file: File
): Promise<ShareLinkFile> {
  const formData = new FormData();
  formData.append("file", file);
  return request(`/u/${id}/upload`, { method: "POST", body: formData });
}

export async function publicShareDeleteFile(
  id: string,
  fileId: string
): Promise<void> {
  await request(`/u/${id}/files/${fileId}`, { method: "DELETE" });
}

export async function publicShareConfirm(
  id: string
): Promise<{ status: ShareLinkStatus }> {
  return request(`/u/${id}/confirm`, { method: "POST" });
}

export function getPublicShareDownloadUrl(id: string, fileId: string): string {
  return `${BASE}/u/${id}/files/${fileId}/raw`;
}

// ── Admin ───────────────────────────────────────────────────────────

export type AllowedUsersResponse = {
  admins: string[];
  allowedUsers: { email: string; addedBy: string | null; createdAt: string }[];
};

export async function getAdminUsers(): Promise<AllowedUsersResponse> {
  return request("/admin/users");
}

export async function addAllowedUser(email: string): Promise<void> {
  await request("/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function removeAllowedUser(email: string): Promise<void> {
  await request(`/admin/users/${encodeURIComponent(email)}`, {
    method: "DELETE",
  });
}

export type UsageResponse = {
  usage: {
    storageBytes: number;
    totalDownloads: number;
    bandwidthBytes: number;
    fileCount: number;
  };
  limits: {
    maxStorageBytes: number | null;
    maxDownloads: number | null;
    maxBandwidthBytes: number | null;
    maxUploadSize: number;
  };
};

export async function getUsage(): Promise<UsageResponse> {
  return request("/admin/usage");
}

// ── Utility ─────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}
