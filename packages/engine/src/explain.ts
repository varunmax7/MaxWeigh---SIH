/**
 * `CalcStep` builders — one place that keeps "Show calculation" in the UI and
 * the report's methodology annex (docs/CALCULATION_METHODOLOGY.md) rendering
 * the same trail the engine actually computed (implementation.md §4.2, §4.10).
 */
import type { CalcStep } from './types.js';

export function step(
  label: string,
  formula: string,
  substituted: string,
  result: string,
  clause?: string,
): CalcStep {
  return { label, formula, substituted, result, clause };
}
