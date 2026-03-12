import { Hono } from 'hono'
import { createDb, verifySession, isAdmin } from '../db'

const admin = new Hono<{
  Bindings: {
    DATABASE_URL: string
    ADMIN_EMAILS: string
  }
}>()

// Admin Check: Check if user is an admin
admin.get('/check', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return c.json({ isAdmin: false }, 401)
  const token = authHeader.split(' ')[1]

  const sql = createDb(c.env.DATABASE_URL)
  const user = await verifySession(sql, token)
  if (!user) return c.json({ isAdmin: false }, 401)

  const adminEmails = (c.env.ADMIN_EMAILS || '').split(',').map(e => e.trim())
  const adminFlag = await isAdmin(user.email, adminEmails)

  return c.json({ isAdmin: adminFlag, email: user.email })
})

// Private: List allowed users
admin.get('/users', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const token = authHeader.split(' ')[1]

  const sql = createDb(c.env.DATABASE_URL)
  const user = await verifySession(sql, token)
  if (!user) return c.json({ error: 'Invalid session' }, 401)

  const adminEmails = (c.env.ADMIN_EMAILS || '').split(',').map(e => e.trim())
  if (!(await isAdmin(user.email, adminEmails))) return c.json({ error: 'Forbidden' }, 403)

  const rows = await sql`
    SELECT * FROM allowed_users ORDER BY created_at DESC
  `
  return c.json(rows)
})

// Private: Add allowed user
admin.post('/users', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const token = authHeader.split(' ')[1]

  const sql = createDb(c.env.DATABASE_URL)
  const user = await verifySession(sql, token)
  if (!user) return c.json({ error: 'Invalid session' }, 401)

  const adminEmails = (c.env.ADMIN_EMAILS || '').split(',').map(e => e.trim())
  if (!(await isAdmin(user.email, adminEmails))) return c.json({ error: 'Forbidden' }, 403)

  const { email } = await c.req.json()
  if (!email || !email.includes('@')) return c.json({ error: 'Invalid email' }, 400)

  await sql`
    INSERT INTO allowed_users (email, added_by) 
    VALUES (${email.toLowerCase().trim()}, ${user.email})
    ON CONFLICT (email) DO NOTHING
  `
  return c.json({ success: true })
})

// Private: Remove allowed user
admin.delete('/users/:id', async (c) => {
  const id = c.req.param('id')
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const token = authHeader.split(' ')[1]

  const sql = createDb(c.env.DATABASE_URL)
  const user = await verifySession(sql, token)
  if (!user) return c.json({ error: 'Invalid session' }, 401)

  const adminEmails = (c.env.ADMIN_EMAILS || '').split(',').map(e => e.trim())
  if (!(await isAdmin(user.email, adminEmails))) return c.json({ error: 'Forbidden' }, 403)

  await sql`DELETE FROM allowed_users WHERE id = ${parseInt(id)}`
  return c.json({ success: true })
})

export default admin
