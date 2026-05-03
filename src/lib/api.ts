import { stackApp } from "./stack";

const BASE = "/api";

async function authHeader(): Promise<Record<string, string>> {
  const user = await stackApp.getUser();
  if (!user) return {};
  const { accessToken } = await user.getAuthJson();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
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
};

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
