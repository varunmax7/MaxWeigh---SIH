#!/usr/bin/env tsx
/**
 * Guards against raw hex colours outside the token file (implementation.md
 * §7.2: "no raw hex anywhere else"; §11: "Use design tokens only; no raw hex
 * outside globals.css").
 *
 * Scans `apps/web/src` for `#rgb`/`#rrggbb`/`#rrggbbaa`-style colour
 * literals in `.ts`/`.tsx`/`.css` source, excluding `globals.css` itself
 * (the one file allowed to define them) and generated/vendor output.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webSrc = join(scriptDir, '..', 'apps', 'web', 'src');

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.css']);
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage']);
const ALLOWED_FILES = new Set(['globals.css']);

// A hex colour literal: `#` + 3, 4, 6 or 8 hex digits, not immediately
// followed by another hex digit (so it doesn't match inside a longer token).
const HEX_COLOR = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;

interface Violation {
  file: string;
  line: number;
  text: string;
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (SCAN_EXTENSIONS.has(extname(entry)) && !ALLOWED_FILES.has(entry)) {
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
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return; // comments/JSDoc

    // A narrow, visible escape hatch for the rare case a raw hex is
    // structurally unavoidable (e.g. Next's `viewport.themeColor`, which
    // renders into a <meta> tag and cannot reference a CSS custom property)
    // — same idea as this repo's `biome-ignore` comments.
    const previousLine = lines[index - 1]?.trim() ?? '';
    if (HEX_COLOR.test(line) && !previousLine.includes('check-no-raw-hex: allow')) {
      violations.push({ file: relPath, line: index + 1, text: trimmed });
    }
  });

  return violations;
}

function main(): void {
  const files = listSourceFiles(webSrc);
  const violations = files.flatMap(scanFile);

  if (violations.length === 0) {
    console.log(`check-no-raw-hex: OK — scanned ${files.length} files in apps/web/src, no violations.`);
    return;
  }

  console.error(`check-no-raw-hex: found ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}\n    ${v.text}`);
  }
  process.exitCode = 1;
}

main();
