# Solo vault login

Username + password from environment variables. No Google/GitHub. The browser never receives the password hash or session secret.

| Variable | Purpose |
| --- | --- |
| `AUTH_USERNAME` | Your login name |
| `AUTH_PASSWORD_HASH` | scrypt hash from `npm run auth:hash -- '…'` (colon-separated `scrypt:N:r:p:salt:hash`) |
| `AUTH_SESSION_SECRET` | Random ≥32 chars (`openssl rand -hex 32`) |

When all three are set, middleware blocks every page and API except `/login` and `POST /api/auth/login` until a signed `HttpOnly` session cookie is present.

```bash
npm run auth:hash -- 'your-password'
# paste AUTH_PASSWORD_HASH into apps/web/.env.local
```
