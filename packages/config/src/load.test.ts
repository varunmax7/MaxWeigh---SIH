import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadRootEnv, resolveFromRoot } from './load.js';

const touched: string[] = [];

function setEnv(key: string, value: string | undefined): void {
  touched.push(key);
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  for (const key of touched) delete process.env[key];
  touched.length = 0;
});

describe('loadRootEnv', () => {
  it('finds a .env in an ancestor directory and loads it', () => {
    const root = mkdtempSync(join(tmpdir(), 'tula-env-'));
    const nested = join(root, 'apps', 'web');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, '.env'), 'TULA_TEST_LOADED=yes\n');
    setEnv('TULA_TEST_LOADED', undefined);

    expect(loadRootEnv(nested)).toBe(join(root, '.env'));
    expect(process.env.TULA_TEST_LOADED).toBe('yes');
  });

  it('never overrides a value already in the environment', () => {
    const root = mkdtempSync(join(tmpdir(), 'tula-env-'));
    writeFileSync(join(root, '.env'), 'TULA_TEST_PRESET=from-file\n');
    setEnv('TULA_TEST_PRESET', 'from-shell');

    loadRootEnv(root);
    expect(process.env.TULA_TEST_PRESET).toBe('from-shell');
  });

  it('returns undefined when no .env exists above the start directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'tula-env-'));
    expect(loadRootEnv(root)).toBeUndefined();
  });
});

describe('resolveFromRoot', () => {
  it('resolves a relative path against the repo root, not process.cwd()', () => {
    const root = mkdtempSync(join(tmpdir(), 'tula-env-'));
    const nested = join(root, 'apps', 'worker');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, '.env'), 'TULA_TEST_ROOT_RESOLVE=1\n');
    setEnv('TULA_TEST_ROOT_RESOLVE', undefined);

    // Simulates apps/worker running with its own cwd (pnpm --filter), while
    // .env's paths are written relative to the repo root, the bug this
    // guards against (implementation.md §10 P8: report.sign failed with
    // ENOENT resolving SIGNING_P12_PATH against the worker's own cwd).
    loadRootEnv(nested);
    expect(resolveFromRoot('./certs/dev-signing.p12')).toBe(join(root, 'certs', 'dev-signing.p12'));
  });

  it('passes an already-absolute path through unchanged', () => {
    const root = mkdtempSync(join(tmpdir(), 'tula-env-'));
    writeFileSync(join(root, '.env'), 'TULA_TEST_ROOT_RESOLVE_ABS=1\n');
    setEnv('TULA_TEST_ROOT_RESOLVE_ABS', undefined);
    loadRootEnv(root);

    expect(resolveFromRoot('/etc/certs/dev-signing.p12')).toBe('/etc/certs/dev-signing.p12');
  });
});
