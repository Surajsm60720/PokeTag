# Turso (libSQL) for Vercel

Metadata (slots, versions, parsed snapshots) uses **libSQL** via `@libsql/client`.

| Environment | Config |
| --- | --- |
| Local default | `DATABASE_URL=file:../../data/poketag.sqlite` (no Turso account needed) |
| Vercel / cloud | `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` |

When `TURSO_DATABASE_URL` is set, it wins over the local file URL.

## Your steps (Turso + Vercel)

### 1. Create a Turso database

```bash
# Install CLI: https://docs.turso.tech/cli/installation
turso auth login
turso db create poketag
turso db show poketag --url
turso db tokens create poketag
```

Copy the **URL** (`libsql://…`) and **token**.

### 2. Local `.env.local` (optional — to develop against Turso)

```env
TURSO_DATABASE_URL=libsql://poketag-….turso.io
TURSO_AUTH_TOKEN=eyJ…
```

Or omit both and keep using the local SQLite file.

### 3. Vercel project env

Add (Production + Preview):

| Name | Value |
| --- | --- |
| `TURSO_DATABASE_URL` | from `turso db show --url` |
| `TURSO_AUTH_TOKEN` | from `turso db tokens create` |
| `STORAGE_DRIVER` | `r2` |
| `R2_ACCOUNT_ID` | … |
| `R2_ACCESS_KEY_ID` | … |
| `R2_SECRET_ACCESS_KEY` | … |
| `R2_BUCKET` | `poketag-saves` |
| `AUTH_USERNAME` | your username |
| `AUTH_PASSWORD_HASH` | from `npm run auth:hash` |
| `AUTH_SESSION_SECRET` | `openssl rand -hex 32` |
| `AUTH_COOKIE_SECURE` | `true` |

### 4. Vercel project settings

- **Root Directory:** set to **`apps/web`** (required — Next writes `.next` here; leaving the root empty causes `NEXT_OUTPUT_DIR_MISSING`)
- **Framework:** Next.js
- **Output Directory:** leave default (do not set a custom value)
- **Install / Build:** use `apps/web/vercel.json` (installs from repo root, builds save-format, then `next build`)
- **Node:** 20+

### 5. Deploy

Push to GitHub → import on Vercel → deploy. Schema migrates automatically on first request (`getDb()`).

### Optional: migrate existing local SQLite into Turso

```bash
turso db shell poketag < <(sqlite3 data/poketag.sqlite .dump)
```

Or start empty on Turso and re-upload saves.
