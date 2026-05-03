# ShareBox

Private file sharing on Cloudflare Pages + R2.

## What it does

- Public link access for uploaded files (`/f/:id`)
- Sign in via Clerk (Google / GitHub / Discord / etc.)
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
- **Auth:** Clerk (JWT verified server-side via JWKS)
- **DB:** Neon Postgres
- **Storage:** Cloudflare R2 (`R2_BUCKET` binding)

## Project structure

- `src/` → frontend
- `server/` → Hono app + auth verification + routes
- `functions/api/[[route]].ts` → Pages function entrypoint
- `db/schema.sql` → SQL schema

## Setup

1. **Create a Neon project** and copy the connection string.
2. **Run `db/schema.sql`** against your Neon database.
3. **Create a Clerk app** at https://dashboard.clerk.com. Enable the OAuth providers you want (Google, GitHub, Discord, etc.). Copy your **Publishable key** (`pk_...`) and **Secret key** (`sk_...`) from the API Keys page.
4. **Create R2 buckets** matching `wrangler.toml`:
   - `sharebox-files`
   - `sharebox-files-preview`
5. **Copy `.dev.vars.example` → `.dev.vars`** and fill in the values.
6. **Install deps:**
   ```bash
   npm install
   ```
7. **Run dev** (full stack — builds frontend, watches for changes, runs Pages function locally with R2 + auth):
   ```bash
   npm run dev
   ```
   App runs at http://localhost:5173.

   Frontend-only (no API):
   ```bash
   npm run dev:frontend
   ```
8. **Deploy:**
   ```bash
   npm run deploy
   ```

## Env vars

Set in `.dev.vars` (local) and **Cloudflare Pages → Settings → Environment variables** (production):

| Variable | Encrypted | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon Postgres connection string |
| `ADMIN_EMAILS` | no | Comma-separated admin emails |
| `CLERK_PUBLISHABLE_KEY` | no | Clerk publishable key (`pk_...`) — used server-side to derive the JWKS URL |
| `CLERK_SECRET_KEY` | yes | Clerk secret key (`sk_...`) — used server-side to fetch user details |
| `VITE_CLERK_PUBLISHABLE_KEY` | no | Same value as `CLERK_PUBLISHABLE_KEY`. Read by Vite at build time and embedded into the JS bundle. |
| `MAX_UPLOAD_SIZE` | no | Optional, in bytes (default 80MB) |

The `VITE_*` var must be present at **build time** for the frontend bundle. On Cloudflare Pages, set it as a plain (non-secret) env var on the project so it's available during the build.

## Notes

- API mounted under `/api/*`.
- Public file route in frontend is `/f/:id`.
- Sign-in opens as a Clerk modal; no callback URL configuration needed.
- The `nodejs_compat` compatibility flag must be enabled in **Cloudflare dashboard → Pages → Settings → Functions → Compatibility flags** for production (in addition to `wrangler.toml` for local dev).
