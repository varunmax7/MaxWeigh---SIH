#!/usr/bin/env tsx
/**
 * `pnpm --filter @tula/engine demo` — prints the §4.5 worked example as a
 * golden table, computed live through the engine (not hard-coded numbers).
 */
import { goldenClassIII } from './__fixtures__/instruments.js';
import { getRulepack } from './__fixtures__/rulepack.js';
import { correctedError, errorOfIndication } from './error.js';
import { mpe } from './mpe.js';

const rulepack = getRulepack();
const range = goldenClassIII.ranges[0];
if (!range) throw new Error('golden fixture has no range');

console.log('Tula — OIML R 76-1:2006 engine demo');
console.log(`Rule pack: ${rulepack.id}@${rulepack.version}\n`);
console.log('Instrument: class III, Max 30 kg, e = d = 5 g\n');

const zero = errorOfIndication({ L: '50', I: '50', deltaL: '3.0' }, range, rulepack);
console.log(`Zero reference — L=50 g, I=50 g, ΔL=3.0 g → P=${zero.P} g, E0=${zero.E} g\n`);

const rows = [
  { L: '10000', I: '10000', deltaL: '1.5' },
  { L: '30000', I: '30005', deltaL: '0.5' },
  { L: '2500', I: '2505', deltaL: '4.5' },
];

const header = ['L (g)', 'I (g)', 'ΔL (g)', 'P (g)', 'E (g)', 'Ec (g)', 'mpe (g)', 'Verdict'];
const widths = header.map((h) => h.length + 2);

function pad(values: string[]): string {
  return values.map((v, i) => v.padEnd(widths[i] ?? v.length)).join('');
}

console.log(pad(header));
console.log(pad(header.map((h) => '-'.repeat(h.length))));

for (const row of rows) {
  const { P, E } = errorOfIndication(row, range, rulepack);
  const Ec = correctedError(E, zero.E);
  const mpeResult = mpe(goldenClassIII, row.L, rulepack);
  const verdict = Ec.abs().lte(mpeResult.value) ? 'PASS' : 'FAIL';
  console.log(pad([row.L, row.I, row.deltaL, P, E, Ec.toFixed(), mpeResult.value, verdict]));
}

console.log('\n(See implementation.md §4.5 for the worked derivation of each column.)');
