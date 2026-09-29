/**
 * Print-time formatting (implementation.md §4.1, §7.3).
 *
 * Masses are shown to the resolution of `d` where a range is known, or 3
 * decimal places otherwise; errors are shown in mass units and in multiples
 * of `e`, matching §4.1's "every computed error is shown twice." All of
 * this reads `Dec` strings and formats through `@tula/engine`'s own
 * `convertMass`/`D` — never a JS number on a mass (§11).
 */
import { convertMass, D, type Dec, type DisplayUnit } from '@tula/engine';

export function fmtMass(grams: Dec, unit: DisplayUnit, decimalPlaces = 3): string {
  return `${convertMass(grams, unit).toFixed(decimalPlaces)} ${unit}`;
}

export function fmtDec(value: Dec, decimalPlaces = 2): string {
  return D(value).toFixed(decimalPlaces);
}

export function fmtErrorPair(grams: Dec, inE: Dec | undefined): string {
  const g = D(grams).toFixed(3);
  return inE ? `${g} g · ${D(inE).toFixed(2)} e` : `${g} g`;
}

/** `2026-09-29` → `29 Sep 2026`. Accepts an ISO date or date-time string. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${fmtDate(iso)} ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export function verdictLabel(verdict: string): string {
  switch (verdict) {
    case 'PASS':
      return 'Pass';
    case 'FAIL':
      return 'Fail';
    case 'NOT_APPLICABLE':
      return 'Not applicable';
    case 'CONFORMS':
      return 'Conforms';
    case 'DOES_NOT_CONFORM':
      return 'Does not conform';
    default:
      return 'Incomplete';
  }
}
