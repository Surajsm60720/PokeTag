# PokéTag

Personal Pokémon save vault and trainer dashboard (working title). Phase 1 vault MVP is live; Phase 2 adds a read-only trainer dashboard (demo snapshots for every Gen 3–9 game until PKHeX parsing lands). No auth; single-operator local use.

Companion docs: [Design Document](docs/design.md), [PRD](docs/prd.md).

## Stack

- **Web + API:** Next.js (TypeScript) App Router
- **Metadata:** SQLite via Node's built-in `node:sqlite`
- **Object storage:** MinIO (Docker)
- **Format helpers:** `@poketag/save-format` (detect + `.dsv` / `.sav` / `.srm` convert)

## Requirements

- Node.js 22+ (uses built-in `node:sqlite`; scripts pass `--experimental-sqlite`)
- Docker (for MinIO)

## Quick start

### 1. Start MinIO

```bash
docker compose up -d
```

Console: http://localhost:9001 (local Docker defaults from `.env.example` / `docker-compose.yml` — change them before any shared or cloud deploy). Bucket `poketag-saves` is created by the init container.

### 2. Configure env

```bash
cp .env.example apps/web/.env.local
# defaults match docker-compose; adjust if needed
```

### 3. Install and run

```bash
npm install
mkdir -p data
npm run dev
```

Open http://localhost:3000 — empty cartridge shelf, then upload a `.sav` / `.dsv` / `.srm`.

### 4. Demo shelf (optional)

Seed one cartridge per Gen 3–9 mainline game (shelves, themes, and Phase 2 demo dashboards — trainer card, party, PC, dex, badges):

```bash
docker compose up -d   # MinIO must be running
npm run seed:demo
```

Refresh http://localhost:3000 — open any cartridge for the dashboard. Re-running replaces only `demo-*` slots.

### 5. Tests

```bash
npm test
```

Verified Phase 1 flow: upload → SHA-256 duplicate reject → download original (byte-identical) → convert to `.dsv` with ROM filename helper.

## Integrity

Upload stores original bytes in MinIO unchanged. Download of “original” returns those exact bytes. Conversion only strips or adds known emulator footers; it does not rewrite Pokémon data blocks.

## Non-goals (v1)

No save editing, ROM hosting, auth, multi-user, or official affiliation with Nintendo / Game Freak / The Pokémon Company. Fan project for personal use.
