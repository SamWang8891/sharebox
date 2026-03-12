import { Hono } from 'hono'
import files from './routes/files'
import admin from './routes/admin'

const app = new Hono().basePath('/api')

app.route('/files', files)
app.route('/admin', admin)

export default app
