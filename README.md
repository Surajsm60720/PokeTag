# PokéTag

Personal Pokémon save vault and trainer dashboard (working title). Phase 1 vault MVP is live; Phase 2 adds a read-only trainer dashboard (real parses when available; optional demo seed for UI walkthrough). Solo login via env username + password hash; object storage on MinIO (local) or Cloudflare R2.

Companion docs: [Design Document](docs/design.md), [PRD](docs/prd.md).

## Stack

- **Web + API:** Next.js (TypeScript) App Router
- **Metadata:** libSQL (`@libsql/client`) — local SQLite file or [Turso](docs/turso.md) for Vercel
- **Object storage:** MinIO (Docker, local) or Cloudflare R2 (cloud) — see [docs/storage.md](docs/storage.md)
- **Format helpers:** `@poketag/save-format` (detect + `.dsv` / `.sav` / `.srm` convert)

## Requirements

- Node.js 20+
- Docker (for local MinIO; optional if using R2)

## Quick start

### 1. Start object storage

**Local (default):**

```bash
docker compose up -d
```

Console: http://localhost:9001 (local Docker defaults — change them before any shared or cloud deploy). Bucket `poketag-saves` is created by the init container.

**Cloudflare R2:** create a private bucket + API token, then set `STORAGE_DRIVER=r2` and `R2_*` in `.env.local` ([docs/storage.md](docs/storage.md)). Verify with `npm run storage:check`.

### 2. Configure env

```bash
cp .env.example apps/web/.env.local
# defaults match docker-compose; switch to R2 when ready (docs/storage.md)
```

Lock the vault (recommended before any public URL):

```bash
npm run auth:hash -- 'your-password'
# paste AUTH_USERNAME, AUTH_PASSWORD_HASH, AUTH_SESSION_SECRET into .env.local
# AUTH_SESSION_SECRET: openssl rand -hex 32
```

### 3. Install and run

```bash
npm install
mkdir -p data
npm run dev
```

Open http://localhost:3000 — empty cartridge shelf, then upload a `.sav` / `.dsv` / `.srm`.

### 4. Empty shelf → real saves

With no slots, the home page shows an empty shelf. Upload a `.sav` / `.dsv` / `.srm` via **New run**.

Optional UI walkthrough only (fake `demo-*` cartridges — not real saves):

```bash
npm run seed:demo    # add demos
npm run clear:demo   # remove demos + their storage objects
```

### 5. Tests

```bash
npm test
```

Covers both workspaces:

- **`packages/save-format`** — detection and conversion, run against generated
  fixtures (`npm run fixtures`) for `.sav` / `.dsv` / `.srm`: every fixture
  round-trips byte for byte, and conversion never mutates its input. Fixtures are
  synthetic and gitignored — no real save data is ever committed.
- **`apps/web`** — the vault itself: upload→download byte identity, duplicate by
  SHA-256, the concurrent-upload race, version history/restore, shared
  storage-key safety, and the parse job's claim/retry/stale-recovery logic. It
  runs against a throwaway SQLite file and an in-process storage driver, so it
  needs no Docker, no MinIO and no dev data.

Verified Phase 1 flow: upload → SHA-256 duplicate reject → download original (byte-identical) → convert to `.dsv` with ROM filename helper.

## Integrity

Upload stores original bytes in object storage unchanged. Download of “original” returns those exact bytes. Conversion only strips or adds known emulator footers; it does not rewrite Pokémon data blocks.

## Non-goals (v1)

No save editing, ROM hosting, multi-user, OAuth, or official affiliation with Nintendo / Game Freak / The Pokémon Company. Fan project for personal use.
