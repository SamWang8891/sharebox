# ShareBox

Private file sharing on Cloudflare Pages + R2.

## What it does

- Public link access for uploaded files (`/f/:id`)
- Sign in via Neon Auth (Stack Auth)
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
- **Auth:** Neon Auth (Stack Auth) via `@stackframe/react`
- **DB:** Neon Postgres
- **Storage:** Cloudflare R2 (`R2_BUCKET` binding)

## Project structure

- `src/` → frontend
- `server/` → Hono app + auth verification + routes
- `functions/api/[[route]].ts` → Pages function entrypoint
- `db/schema.sql` → SQL schema (Neon Auth syncs `neon_auth.users_sync` automatically)

## Setup

1. **Create a Neon project** and enable **Neon Auth** in the Neon dashboard → Auth tab. This:
   - Creates the `neon_auth.users_sync` table automatically
   - Gives you Stack Auth credentials: `Project ID`, `Publishable Client Key`, `Secret Server Key`
2. **Run `db/schema.sql`** against your Neon database (creates `files` and `allowed_users` tables).
3. **Configure auth providers** in your Stack Auth project (e.g. Google) and set the redirect URL to your deployed origin (e.g. `https://share.smashit.tw`).
4. **Create R2 buckets** matching `wrangler.toml`:
   - `sharebox-files`
   - `sharebox-files-preview`
5. **Copy `.dev.vars.example` → `.dev.vars`** and fill in the values.
6. **Install deps:**
   ```bash
   npm install
   ```
7. **Run dev** (full stack: builds frontend, watches for changes, runs Pages function locally with R2 + auth):
   ```bash
   npm run dev
   ```
   App runs at http://localhost:5173. Initial build takes a few seconds.

   Frontend-only (no API):
   ```bash
   npm run dev:frontend
   ```
8. **Deploy:**
   ```bash
   npm run deploy
   ```

## Env vars

`.dev.vars` (local) — and matching values in **Cloudflare Pages → Settings → Environment variables** for production:

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | server | Neon Postgres connection string |
| `ADMIN_EMAILS` | server | Comma-separated admin emails |
| `STACK_PROJECT_ID` | server | From Neon Auth dashboard |
| `STACK_PUBLISHABLE_CLIENT_KEY` | server | From Neon Auth dashboard |
| `STACK_SECRET_SERVER_KEY` | server (encrypted) | From Neon Auth dashboard |
| `VITE_STACK_PROJECT_ID` | build-time | Same value as above (bundled into client) |
| `VITE_STACK_PUBLISHABLE_CLIENT_KEY` | build-time | Same value as above (bundled into client) |
| `MAX_UPLOAD_SIZE` | server | Optional, in bytes |

The `VITE_*` vars must be present at **build time** for the frontend bundle. On Cloudflare Pages, set them as plain (non-secret) environment variables on the project so they're available during the build.

## Notes

- API mounted under `/api/*`.
- Stack Auth handler routes mounted at `/handler/*` (sign-in, sign-up, OAuth callback).
- Public file route in frontend is `/f/:id`.
- The `nodejs_compat` compatibility flag must be enabled both in `wrangler.toml` (for `wrangler pages dev`) and in **Cloudflare dashboard → Pages → Settings → Functions → Compatibility flags** (for production).
