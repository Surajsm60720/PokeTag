/**
 * Module resolution hook so Node's native test runner can load the app's
 * TypeScript the way Next does.
 *
 * Two things Next/bundler resolution allows that plain ESM does not:
 *   1. extensionless relative imports  (`import { x } from "./vault"`)
 *   2. the `@/*` path alias from tsconfig.json
 *
 * Registered by ./register.mjs — never import this directly.
 */
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src"
);

function isFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function resolveFile(base) {
  if (isFile(base)) return base;
  for (const suffix of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + suffix;
    if (isFile(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith("@/")) {
      const hit = resolveFile(path.join(SRC_DIR, specifier.slice(2)));
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }

    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const parentURL = context.parentURL;
      if (parentURL) {
        const base = path.resolve(
          path.dirname(fileURLToPath(parentURL)),
          specifier
        );
        const hit = resolveFile(base);
        if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
      }
    }

    throw err;
  }
}
