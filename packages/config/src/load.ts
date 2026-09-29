import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

let cachedRootDir: string | undefined;

/**
 * Load the monorepo's root `.env` into `process.env`.
 *
 * The workspace keeps one `.env` at the repository root so the web app, the
 * worker and the CLI scripts can never be configured differently. Values
 * already present in the environment win, which is what lets Docker Compose,
 * CI and the shell override the file.
 *
 * @param from directory to start searching upwards from
 * @returns the path loaded, or `undefined` when no `.env` was found
 */
export function loadRootEnv(from: string = process.cwd()): string | undefined {
  const { root } = parse(from);
  let dir = from;

  while (true) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate, override: false, quiet: true });
      cachedRootDir = dir;
      return candidate;
    }
    if (dir === root) return undefined;
    dir = dirname(dir);
  }
}

/**
 * Resolves a file-path env value (e.g. `SIGNING_P12_PATH`) against the
 * repository root rather than `process.cwd()`.
 *
 * Every process sets `.env`'s file paths relative to the repo root by
 * convention (`./certs/dev-signing.p12`), but `apps/web` and `apps/worker`
 * run with *different* working directories (each package's own directory,
 * via `pnpm --filter`) — resolving against `cwd()` silently looks in the
 * wrong place for whichever process isn't started from the root, which is
 * every real deployment. Call `loadRootEnv()` first; this throws if it
 * hasn't run yet, since that would mean guessing at a root that was never
 * actually located.
 */
export function resolveFromRoot(path: string): string {
  if (isAbsolute(path)) return path;
  if (!cachedRootDir) {
    throw new Error('resolveFromRoot() called before loadRootEnv() found the repository root');
  }
  return resolve(cachedRootDir, path);
}
