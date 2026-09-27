import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { config as loadDotenv } from 'dotenv';

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
      return candidate;
    }
    if (dir === root) return undefined;
    dir = dirname(dir);
  }
}
