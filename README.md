# ShareBox

Self-hosted (basically all cloud services) private file sharing on Cloudflare Pages + R2. Authenticated uploads, public download links, optional passwords and expiry, and (optionally) in-browser editing of office documents via Collabora.

```
Browser ──▶ Cloudflare Pages (React)
              │
              ▼
        Pages Functions (Hono API)
         │            │           │
         ▼            ▼           ▼
       Clerk      Neon PG       R2 bucket
       (JWT)    (metadata)    (file bytes)
```

## Features

- **Public links** at `/f/:id` — recipients don't need an account.
- **Authenticated uploads** via Clerk (Google, GitHub, Discord, etc.).
- **Allowlist model** — only emails in `ADMIN_EMAILS` or the in-app allowlist can upload.
- **Per-file controls** — optional password, expiry (1h / 24h / 7d / 30d / never), 80 MB default cap (`MAX_UPLOAD_SIZE`).
- **Owner dashboard** — list and delete your uploads.
- **Admin panel** — manage who's allowed to upload.
- **HEIC preview** — converted on the client.
- **Optional Collabora editing** — owners can edit docx/xlsx/pptx/odt in-browser; saves back to R2 in place.
- **Upload links (drop-boxes)** at `/u/:id` — share a link that lets anyone upload without an account; uploader clicks Done and the link locks into a view-only download page.
- **Share / copy / QR** on every link, plus optional **URL shortening** via [Pika](https://github.com/) when `PIKA_BASE_URL` is set.

## Tech

| Layer    | Choice                                          |
| -------- | ----------------------------------------------- |
| Frontend | Vite, React, TypeScript, Tailwind               |
| API      | Hono on Cloudflare Pages Functions              |
| Auth     | Clerk (JWT verified server-side via JWKS)       |
| DB       | Neon Postgres (`@neondatabase/serverless`)      |
| Storage  | Cloudflare R2                                   |
| Editing  | Collabora Online via WOPI (optional)            |

## Project layout

```
src/                         frontend (React)
  pages/                     Home, Dashboard, FileView, EditView, Admin
server/
  app.ts                     Hono app wiring
  clerk-auth.ts              JWT verification (JWKS)
  routes/{files,admin,wopi}  API + WOPI host endpoints
functions/api/[[route]].ts   Pages Function entrypoint
db/schema.sql                Postgres schema
wrangler.toml                R2 bindings, compatibility flags
```

## Getting started

### Prerequisites

- Node 18+
- A [Neon](https://neon.tech) Postgres database
- A [Clerk](https://dashboard.clerk.com) application (enable the OAuth providers you want)
- A Cloudflare account with R2 enabled

### 1. Clone & install

```bash
git clone <this repo>
cd sharebox
npm install
```

### 2. Provision

- Run `db/schema.sql` against your Neon database.
- Create the R2 buckets referenced in `wrangler.toml`:
  - `sharebox-files`
  - `sharebox-files-preview`
- Grab your Clerk **Publishable** (`pk_…`) and **Secret** (`sk_…`) keys.

### 3. Configure

Copy `.dev.vars.example` → `.dev.vars` and fill in the values (see [Environment variables](#environment-variables)).

### 4. Run locally

```bash
npm run dev          # full stack on http://localhost:5173 (Pages + R2 + auth)
npm run dev:frontend # frontend only, no API
```

### 5. Deploy

```bash
npm run deploy
```

Then in **Cloudflare Pages → Settings**:

- Add the same env vars under **Environment variables**.
- Enable the `nodejs_compat` flag under **Functions → Compatibility flags** (the entry in `wrangler.toml` only covers local dev).

## Environment variables

| Variable                      | Secret | Purpose                                                                 |
| ----------------------------- | ------ | ----------------------------------------------------------------------- |
| `DATABASE_URL`                | yes    | Neon Postgres connection string                                         |
| `ADMIN_EMAILS`                | no     | Comma-separated admin emails                                            |
| `CLERK_PUBLISHABLE_KEY`       | no     | Clerk `pk_…` — server uses it to derive the JWKS URL                    |
| `CLERK_SECRET_KEY`            | yes    | Clerk `sk_…` — server uses it to fetch user details                     |
| `VITE_CLERK_PUBLISHABLE_KEY`  | no     | Same value as `CLERK_PUBLISHABLE_KEY`. Embedded in the JS bundle at build time. |
| `MAX_UPLOAD_SIZE`             | no     | Bytes; default 80 MB                                                    |
| `COLLABORA_URL`               | no     | e.g. `https://collabora.example.com`. Enables in-browser editing.       |
| `PIKA_BASE_URL`               | no     | e.g. `https://fastgoto.xyz`. Enables the shorten button on share links. |

`VITE_*` vars must exist at **build time** — set them as plain (non-secret) Pages env vars so they're present during the build.

## How permissions work

- **Anyone** with a link can download a file (entering the password if one is set).
- **Uploading** requires a signed-in user whose email is in `ADMIN_EMAILS` or the `allowed_users` table.
- **Admins** (emails in `ADMIN_EMAILS`) manage the allowlist via `/admin`.
- **Owners** (the uploader) can delete their own files from `/dashboard` and edit them via Collabora if enabled.
- **Anyone with an open `/u/:id` link** can upload files into it without signing in, subject to the per-link caps (file count, total size, allowed extensions). Once they click Done the link is sealed and downloads are public.

## Upload links (drop-boxes)

Owners can create reusable `/u/:id` links from the dashboard with:

- A **file count** cap and a **total size** cap.
- **Allowed file types** — any combination of presets (Images / Documents / Spreadsheets / Slides / Video / Audio / Archives) plus free-form custom extensions. Empty list means any type is accepted.
- An **expiry** that controls how long the link accepts uploads (the view page stays available even after expiry, once confirmed).

Each link gets a **share / copy / QR** action row. If `PIKA_BASE_URL` is configured, owners can also click **shorten** to create a memorable short URL (e.g. `https://fastgoto.xyz/apple`); the short URL gets the same share / copy / QR actions.

Uploaded files are owned by the link creator and count against their storage quota.

## Optional: Collabora Online editing

Set `COLLABORA_URL` to a reachable Collabora Online (Code) instance. The owner sees an **Edit** button on `/f/:id` for supported types (docx, xlsx, pptx, odt, ods, odp, txt, csv, rtf); changes save back to the same R2 object.

WOPI host endpoints live under `/wopi/*`. On the Collabora side:

1. Allow your ShareBox origin (e.g. `https://share.example.com`) as a WOPI host (e.g. `aliasgroup1` in `coolwsd.xml`).
2. Allow the same origin in `frame-ancestors` so the editor can be iframed.
3. Make sure `<COLLABORA_URL>/hosting/discovery` is reachable from Cloudflare (no IP allowlist blocking the Worker).

Editing is owner-only and disabled for password-protected files.

## Troubleshooting

- **`nodejs_compat` errors in production** — enable the flag in the Pages dashboard, not just `wrangler.toml`.
- **Clerk session not detected** — confirm `VITE_CLERK_PUBLISHABLE_KEY` was set at build time, then redeploy.
- **Edit button missing** — owner-only; hidden for password-protected files; requires `COLLABORA_URL` and a supported extension.
- **Upload denied for an email you expected to work** — check `ADMIN_EMAILS` casing and the `allowed_users` table.

## License

See [LICENSE](LICENSE).
