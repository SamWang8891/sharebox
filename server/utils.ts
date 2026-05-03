import { nanoid } from "nanoid";
import type { Env } from "./types";

/** Get the auth/signing secret, supporting legacy BETTER_AUTH_SECRET */
export function getAuthSecret(env: Env): string {
  const secret = env.NEON_AUTH_SECRET ?? env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "Missing auth secret: set NEON_AUTH_SECRET (or legacy BETTER_AUTH_SECRET)"
    );
  }
  return secret;
}

/** Generate a short file ID (8 chars, URL-safe) */
export function generateFileId(): string {
  return nanoid(8);
}

/** Hash a file password using PBKDF2 (Web Crypto API compatible) */
export async function hashPassword(
  password: string,
  salt: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return uint8ToBase64url(new Uint8Array(bits));
}

/** Verify a file password */
export async function verifyPassword(
  password: string,
  salt: string,
  hash: string
): Promise<boolean> {
  const computed = await hashPassword(password, salt);
  return computed === hash;
}

/** Generate a random salt */
export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return uint8ToBase64url(arr);
}

/** Create a short-lived access token for password-protected files */
export async function createAccessToken(
  fileId: string,
  secret: string
): Promise<{ token: string; expires: number }> {
  const expires = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = encoder.encode(`${fileId}|${expires}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const token = `${expires}.${uint8ToBase64url(new Uint8Array(sig))}`;
  return { token, expires };
}

/** Verify an access token */
export async function verifyAccessToken(
  fileId: string,
  token: string,
  secret: string
): Promise<boolean> {
  const [expiresStr, sig] = token.split(".");
  if (!expiresStr || !sig) return false;
  const expires = parseInt(expiresStr, 10);
  if (Date.now() / 1000 > expires) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const data = encoder.encode(`${fileId}|${expires}`);
  const sigBytes = base64urlToUint8(sig);
  return crypto.subtle.verify("HMAC", key, sigBytes as BufferSource, data);
}

function uint8ToBase64url(arr: Uint8Array): string {
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToUint8(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
