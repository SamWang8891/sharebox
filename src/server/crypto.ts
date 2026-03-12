/**
 * Password hashing using Web Crypto API (PBKDF2).
 * Works in Cloudflare Workers / Edge runtime - no bcrypt needed.
 */

const ITERATIONS = 100_000
const KEY_LENGTH = 32 // 256 bits
const HASH_ALGORITHM = 'SHA-256'

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    KEY_LENGTH * 8,
  )
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveKey(password, salt)
  return {
    hash: bufferToHex(hash),
    salt: bufferToHex(salt),
  }
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
): Promise<boolean> {
  try {
    const saltBuffer = hexToBuffer(storedSalt)
    const derivedHash = await deriveKey(password, saltBuffer)
    return bufferToHex(derivedHash) === storedHash
  } catch {
    return false
  }
}
