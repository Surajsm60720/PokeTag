/**
 * Generate AUTH_PASSWORD_HASH for .env.local
 *
 *   npm run auth:hash -- 'your-password'
 */
import { hashPassword } from "../src/lib/auth/password.ts";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npm run auth:hash -- 'your-password'");
  process.exit(1);
}

const hash = await hashPassword(password);
console.log("Add this to apps/web/.env.local:\n");
console.log(`AUTH_PASSWORD_HASH=${hash}`);

