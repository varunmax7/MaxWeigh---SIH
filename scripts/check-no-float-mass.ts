#!/usr/bin/env tsx
/**
 * Guards against float arithmetic on mass and error fields (implementation.md
 * §4.1, §11: "Never JS number arithmetic on masses").
 *
 * This is a heuristic, regex-based scan of `packages/engine/src` — not full
 * type analysis. It flags two anti-patterns for a curated list of mass/error
 * field names (L, I, E, Ec, P, e, d, Max, Min, mass, load, tare, mpe, …):
 *   1. a `: number` type annotation on a field or parameter with that exact name;
 *   2. a `Number(...)` or `parseFloat(...)` cast of an identifier with that name.
 *
 * Every real mass/error value in this codebase is a `Dec` (string) at
 * boundaries and a `Decimal` internally (decimal.ts) — this script exists so
 * a future change can't quietly reintroduce `number` arithmetic on one.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const engineSrc = join(scriptDir, '..', 'packages', 'engine', 'src');

// Exact field/parameter names (case-insensitive), not substrings — this
// deliberately does not match compound identifiers like `loadReceptor` or
// `stepFractionOfE`, which aren't mass fields themselves.
const MASS_FIELD_NAMES = [
  'mass',
  'load',
  'weight',
  'nominal',
  'tare',
  'mpe',
  'mpeine',
  'indication',
  'reading',
  'deltal',
  'max',
  'min',
  'l',
  'i',
  'e',
  'd',
  'p',
  'ec',
  'ecine',
  'e0',
  'i0',
];

const namePattern = MASS_FIELD_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const TYPE_ANNOTATION = new RegExp(`\\b(${namePattern})\\s*\\??\\s*:\\s*number\\b`, 'i');
const NUMBER_CAST = new RegExp(`\\b(?:Number|parseFloat)\\(\\s*(${namePattern})\\b`, 'i');

interface Violation {
  file: string;
  line: number;
  text: string;
  rule: string;
}

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__fixtures__' || entry === 'dist' || entry === 'node_modules') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (extname(entry) === '.ts' && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

function scanFile(file: string): Violation[] {
  const violations: Violation[] = [];
  const lines = readFileSync(file, 'utf-8').split('\n');
  const relPath = relative(join(scriptDir, '..'), file);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) return; // comments/JSDoc

    if (TYPE_ANNOTATION.test(line)) {
      violations.push({
        file: relPath,
        line: index + 1,
        text: trimmed,
        rule: 'number-typed mass field',
      });
    }
    if (NUMBER_CAST.test(line)) {
      violations.push({
        file: relPath,
        line: index + 1,
        text: trimmed,
        rule: 'Number()/parseFloat() cast of a mass field',
      });
    }
  });

  return violations;
}

function main(): void {
  const files = listTsFiles(engineSrc);
  const violations = files.flatMap(scanFile);

  if (violations.length === 0) {
    console.log(
      `check-no-float-mass: OK — scanned ${files.length} files in packages/engine/src, no violations.`,
    );
    return;
  }

  console.error(`check-no-float-mass: found ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.rule}]\n    ${v.text}`);
  }
  process.exitCode = 1;
}

main();
