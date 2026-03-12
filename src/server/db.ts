import { neon } from '@neondatabase/serverless'

export type Sql = ReturnType<typeof neon>

export function createDb(databaseUrl: string): Sql {
  return neon(databaseUrl)
}

export interface FileRecord {
  id: number
  short_id: string
  filename: string
  mime_type: string | null
  size: number
  r2_key: string
  uploader_email: string
  password_hash: string | null
  password_salt: string | null
  expires_at: string | null
  downloads: number
  created_at: string
}

export interface AllowedUser {
  id: number
  email: string
  added_by: string
  created_at: string
}

export interface SessionUser {
  id: string
  email: string
  name?: string
}

/**
 * Verify a bearer token by querying the neon_auth.sessions table.
 * Neon Auth (Stack Auth) stores session tokens in this table.
 *
 * The neon_auth schema is created automatically when you enable Neon Auth.
 * Sessions table schema (Stack Auth):
 *   - id: uuid (session/access token)
 *   - user_id: uuid
 *   - expires_at: timestamptz
 * Users table schema (Stack Auth):
 *   - id: uuid
 *   - primary_email: varchar
 *   - display_name: varchar
 */
export async function verifySession(sql: Sql, token: string): Promise<SessionUser | null> {
  try {
    const rows = await sql`
      SELECT
        u.id,
        u.primary_email AS email,
        u.display_name AS name
      FROM neon_auth.sessions s
      JOIN neon_auth.users u ON s.user_id = u.id
      WHERE s.id = ${token}
        AND (s.expires_at IS NULL OR s.expires_at > NOW())
      LIMIT 1
    `
    if (rows.length === 0) return null
    const row = rows[0] as { id: string; email: string; name: string | null }
    return { id: row.id, email: row.email, name: row.name ?? undefined }
  } catch {
    return null
  }
}

export async function isAllowedUser(sql: Sql, email: string, adminEmails: string[]): Promise<boolean> {
  // Admins are always allowed
  if (adminEmails.includes(email)) return true

  const rows = await sql`
    SELECT 1 FROM allowed_users WHERE email = ${email} LIMIT 1
  `
  return rows.length > 0
}

export async function isAdmin(email: string, adminEmails: string[]): Promise<boolean> {
  return adminEmails.includes(email)
}
