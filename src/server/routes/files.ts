import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { createDb, verifySession, isAllowedUser } from '../db'
import { hashPassword, verifyPassword } from '../crypto'

const files = new Hono<{
  Bindings: {
    DATABASE_URL: string
    ADMIN_EMAILS: string
    R2_BUCKET: R2Bucket
  }
}>()

// Public: Get file metadata
files.get('/:shortId', async (c) => {
  const shortId = c.req.param('shortId')
  const sql = createDb(c.env.DATABASE_URL)

  const rows = await sql`
    SELECT id, short_id, filename, mime_type, size, uploader_email, 
           (password_hash IS NOT NULL) as is_protected, expires_at, created_at
    FROM files WHERE short_id = ${shortId} LIMIT 1
  `

  if (rows.length === 0) return c.json({ error: 'File not found' }, 404)
  const file = rows[0]

  if (file.expires_at && new Date(file.expires_at) < new Date()) {
    return c.json({ error: 'File has expired' }, 410)
  }

  return c.json(file)
})

// Public/Protected: Download file content
files.post('/:shortId/download', async (c) => {
  const shortId = c.req.param('shortId')
  const { password } = await c.req.json().catch(() => ({}))
  const sql = createDb(c.env.DATABASE_URL)

  const rows = await sql`
    SELECT * FROM files WHERE short_id = ${shortId} LIMIT 1
  `

  if (rows.length === 0) return c.json({ error: 'File not found' }, 404)
  const file = rows[0]

  if (file.expires_at && new Date(file.expires_at) < new Date()) {
    return c.json({ error: 'File has expired' }, 410)
  }

  if (file.password_hash) {
    if (!password || !(await verifyPassword(password, file.password_hash, file.password_salt))) {
      return c.json({ error: 'Invalid password' }, 403)
    }
  }

  const object = await c.env.R2_BUCKET.get(file.r2_key)
  if (!object) return c.json({ error: 'File missing in storage' }, 404)

  // Increment download count
  await sql`UPDATE files SET downloads = downloads + 1 WHERE id = ${file.id}`

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Content-Disposition', `attachment; filename="${file.filename}"`)

  return new Response(object.body, { headers })
})

// Private: Upload file
files.post('/', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const token = authHeader.split(' ')[1]

  const sql = createDb(c.env.DATABASE_URL)
  const user = await verifySession(sql, token)
  if (!user) return c.json({ error: 'Invalid session' }, 401)

  const adminEmails = (c.env.ADMIN_EMAILS || '').split(',').map(e => e.trim())
  if (!(await isAllowedUser(sql, user.email, adminEmails))) {
    return c.json({ error: 'You are not in the allowed uploader list' }, 403)
  }

  const formData = await c.req.parseBody()
  const file = formData.file as File
  const password = formData.password as string | undefined
  const expiration = formData.expiration as string // '1h', '24h', '7d', '30d', 'never'

  if (!file) return c.json({ error: 'No file provided' }, 400)
  if (file.size > 80 * 1024 * 1024) return c.json({ error: 'File too large (max 80MB)' }, 400)

  let expiresAt: Date | null = null
  if (expiration !== 'never') {
    expiresAt = new Date()
    if (expiration === '1h') expiresAt.setHours(expiresAt.getHours() + 1)
    else if (expiration === '24h') expiresAt.setDate(expiresAt.getDate() + 1)
    else if (expiration === '7d') expiresAt.setDate(expiresAt.getDate() + 7)
    else if (expiration === '30d') expiresAt.setDate(expiresAt.getDate() + 30)
  }

  let passHash = null
  let passSalt = null
  if (password) {
    const { hash, salt } = await hashPassword(password)
    passHash = hash
    passSalt = salt
  }

  const shortId = nanoid(8)
  const r2Key = `${user.email}/${Date.now()}-${file.name}`

  await c.env.R2_BUCKET.put(r2Key, file, {
    httpMetadata: { contentType: file.type }
  })

  await sql`
    INSERT INTO files (short_id, filename, mime_type, size, r2_key, uploader_email, password_hash, password_salt, expires_at)
    VALUES (${shortId}, ${file.name}, ${file.type}, ${file.size}, ${r2Key}, ${user.email}, ${passHash}, ${passSalt}, ${expiresAt})
  `

  return c.json({ short_id: shortId })
})

// Private: List user's files
files.get('/', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const token = authHeader.split(' ')[1]

  const sql = createDb(c.env.DATABASE_URL)
  const user = await verifySession(sql, token)
  if (!user) return c.json({ error: 'Invalid session' }, 401)

  const rows = await sql`
    SELECT id, short_id, filename, mime_type, size, expires_at, downloads, created_at
    FROM files 
    WHERE uploader_email = ${user.email}
    ORDER BY created_at DESC
  `
  return c.json(rows)
})

// Private: Delete file
files.delete('/:shortId', async (c) => {
  const shortId = c.req.param('shortId')
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const token = authHeader.split(' ')[1]

  const sql = createDb(c.env.DATABASE_URL)
  const user = await verifySession(sql, token)
  if (!user) return c.json({ error: 'Invalid session' }, 401)

  const rows = await sql`SELECT r2_key, uploader_email FROM files WHERE short_id = ${shortId} LIMIT 1`
  if (rows.length === 0) return c.json({ error: 'Not found' }, 404)
  
  const file = rows[0]
  if (file.uploader_email !== user.email) return c.json({ error: 'Forbidden' }, 403)

  await c.env.R2_BUCKET.delete(file.r2_key)
  await sql`DELETE FROM files WHERE short_id = ${shortId}`

  return c.json({ success: true })
})

export default files
