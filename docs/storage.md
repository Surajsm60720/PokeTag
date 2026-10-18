# Object storage (MinIO + Cloudflare R2)

PokéTag stores **immutable save bytes** in an S3-compatible bucket. Metadata stays in SQLite.

| Environment | Driver | Typical host |
| --- | --- | --- |
| Local dev | `minio` | Docker Compose (`docker compose up -d`) |
| Cloud / prod | `r2` | Cloudflare R2 (10 GB-month free Standard storage) |

The app picks the driver from `STORAGE_DRIVER`, or auto-selects `r2` when `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` is set.

## Local MinIO

```bash
docker compose up -d
cp .env.example apps/web/.env.local   # STORAGE_DRIVER=minio (default)
npm run storage:check
```

## Cloudflare R2 setup

1. In [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2** → create a bucket (e.g. `poketag-saves`). Keep it **private**.
2. **R2** → **Manage R2 API Tokens** → create a token with **Object Read & Write** on that bucket (or account-level if you prefer).
3. Copy **Access Key ID**, **Secret Access Key**, and your **Account ID** (R2 overview sidebar).
4. Put them in `apps/web/.env.local` (never commit):

```env
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET=poketag-saves
```

5. Verify:

```bash
npm run storage:check
```

You should see `Storage: r2 https://<account>.r2.cloudflarestorage.com/poketag-saves` and `OK`.

### Billing note

Free tier is **10 GB-month of storage held in the bucket** (average over the month), not “10 GB uploaded per month.” Ops free allowances are large enough for solo use; egress is free.

### Create-bucket behaviour

R2 buckets are normally created in the dashboard. The app **does not** auto-create on R2 unless you set `R2_AUTO_CREATE_BUCKET=true`. Local MinIO still auto-creates by default.

## Railway / prod env

Set the same `STORAGE_DRIVER=r2` and `R2_*` variables in the host’s environment. Keep using Docker MinIO only on your laptop.

## Switching back to local MinIO

Remove or comment out `R2_*`, set `STORAGE_DRIVER=minio` (or omit it), and run `docker compose up -d`.
