#!/usr/bin/env tsx
/**
 * Serial indicator simulator (implementation.md §10 P10: "mock mode +
 * `scripts/sim-serial.ts`"). Node has no way to appear as a USB serial
 * device to a browser's `navigator.serial.requestPort()` — Web Serial only
 * ever lists real (or virtual-but-OS-level) serial ports the user picks
 * from a native chooser dialog — so this script's job is to *emit* a
 * plausible instrument data stream that a developer can feed into an
 * actual virtual serial port pair for a real end-to-end test:
 *
 *   1. `socat -d -d pty,raw,echo=0,link=/tmp/tula-sim-a pty,raw,echo=0,link=/tmp/tula-sim-b`
 *   2. `pnpm tsx scripts/sim-serial.ts --out /tmp/tula-sim-a`
 *   3. In Chrome, "Read from instrument" → choose `/tmp/tula-sim-b` (or
 *      the OS's equivalent name for it) from the port picker.
 *
 * With no `--out`, it just prints lines to stdout — useful for eyeballing
 * the exact wire format each `--profile` produces without any serial setup
 * at all (this is what `docs/API.md` shows as sample output). For a
 * hardware-free UI check, the workspace's own "Mock mode" toggle (no
 * script needed) is the faster path — see `SerialReadPanel.tsx`.
 *
 * Run: `pnpm tsx scripts/sim-serial.ts [--profile and-style|generic-csv] [--out /path/to/port] [--interval-ms 500]`
 */
import { createWriteStream, type WriteStream } from 'node:fs';

function argValue(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1] as string;
}

const profile = argValue('--profile', 'and-style') as 'and-style' | 'generic-csv';
const intervalMs = Number(argValue('--interval-ms', '500'));
const outPath = process.argv.includes('--out') ? argValue('--out', '') : null;

const sink: WriteStream | NodeJS.WriteStream = outPath
  ? createWriteStream(outPath)
  : process.stdout;

function drift(current: number, step: number, min: number, max: number): number {
  const next = current + (Math.random() - 0.5) * 2 * step;
  return Math.min(max, Math.max(min, next));
}

function formatLine(value: number, unit: string, stable: boolean): string {
  if (profile === 'generic-csv') {
    return `${value.toFixed(3)},${unit},${stable ? 'stable' : 'unstable'}`;
  }
  const sign = value >= 0 ? '+' : '-';
  return `${stable ? 'ST' : 'US'},${sign}${Math.abs(value).toFixed(2).padStart(8, '0')},${unit}`;
}

let value = 0;
let settleTicks = 0;

function tick() {
  // Every so often, jump to a new "load placed on the pan" and go through a
  // few unstable ticks before settling — a rough approximation of how a
  // real indicator behaves, not a literal spec.
  if (settleTicks <= 0) {
    value = Math.round(drift(value, 500, 0, 30000));
    settleTicks = 2 + Math.floor(Math.random() * 3);
  }
  const stable = settleTicks <= 1;
  const jitter = stable ? 0 : (Math.random() - 0.5) * 4;
  sink.write(`${formatLine(value + jitter, 'g', stable)}\n`);
  settleTicks -= 1;
}

console.error(
  `Emitting ${profile} lines every ${intervalMs}ms${outPath ? ` to ${outPath}` : ' to stdout'}. Ctrl+C to stop.`,
);
tick();
const interval = setInterval(tick, intervalMs);

process.on('SIGINT', () => {
  clearInterval(interval);
  if (sink !== process.stdout) (sink as WriteStream).end();
  process.exit(0);
});
