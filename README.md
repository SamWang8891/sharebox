# ShareBox

Private file sharing on Cloudflare Pages + R2.

> I still need some time to understand what my AI is coind and fix it myself I guess

## What it does

- Public link access for uploaded files (`/f/:id`)
- Google login for uploaders
- Upload access restricted to:
  - admins from `ADMIN_EMAILS` (env)
  - emails added in Admin panel (`allowed_users`)
- Upload options:
  - optional password protection
  - expiration (1h / 24h / 7d / 30d / never)
- 80MB upload limit (configurable via `MAX_UPLOAD_SIZE`)
- Dashboard: list and delete your uploads
- Admin panel: add/remove allowed uploader emails

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind
- **API:** Hono on Cloudflare Pages Functions
- **Auth:** Neon Auth (Google OAuth)
- **DB:** Neon Postgres
- **Storage:** Cloudflare R2 (`R2_BUCKET` binding)

## Project structure

- `src/` → frontend
- `server/` → Hono app + auth + routes
- `functions/api/[[route]].ts` → Pages function entrypoint
- `db/schema.sql` → SQL schema

## Env vars (`.dev.vars`)

Copy `.dev.vars.example` to `.dev.vars` and fill values:

```bash
DATABASE_URL=postgresql://...
ADMIN_EMAILS=admin@example.com
NEON_AUTH_URL=http://localhost:5173
NEON_AUTH_SECRET=replace-with-a-long-random-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MAX_UPLOAD_SIZE=83886080
```

For production, set the same secrets in Cloudflare Pages project settings.

## Setup

1. Create Neon project and run `db/schema.sql`.
2. Create Google OAuth credentials (authorized redirect URI must point to your deployed domain).
3. Create R2 buckets matching `wrangler.toml`:
   - `sharebox-files`
   - `sharebox-files-preview`
4. Install deps:
   ```bash
   npm install
   ```
5. Run dev (full stack — builds the frontend, watches for changes, and runs the Pages function locally with R2 + auth):
   ```bash
   npm run dev
   ```
   Dev server runs at http://localhost:5173. The first build takes a few seconds before the server is reachable.

   Frontend-only (no API, no R2 — useful only for tweaking pure UI):
   ```bash
   npm run dev:frontend
   ```
6. Deploy:
   ```bash
   npm run deploy
   ```

## Notes

- API is mounted under `/api/*`.
- Auth endpoints are under `/api/auth/*`.
- Public file route in frontend is `/f/:id`.
