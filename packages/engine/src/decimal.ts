/**
 * Decimal.js configuration and boundary helpers (implementation.md §4.1).
 *
 * Precision 40 gives ample guard digits from a tonne down to a milligram.
 * Limit comparisons are never rounded first — only display values are,
 * explicitly, with {@link roundToStep}. Rounding mode is half-up (away from
 * zero on ties), the conventional legal-metrology default; this is an
 * engineering choice, not an OIML constant (docs/QUESTIONS.md).
 */
import Decimal from 'decimal.js';
import type { Dec } from './types.js';

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

export { Decimal };

/** Build a {@link Decimal} from a `Dec` string, a `number`, or another `Decimal`. */
export function D(value: Dec | number | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Serialize a {@link Decimal} to its canonical, non-exponential `Dec` string. */
export function toDec(value: Decimal): Dec {
  return value.toFixed();
}

/**
 * Round `value` to the nearest multiple of `step` (e.g. the display
 * resolution `d`), half rounding away from zero. `step` must be positive.
 */
export function roundToStep(value: Decimal, step: Decimal): Decimal {
  if (step.lte(0)) throw new RangeError('roundToStep: step must be positive');
  return value.dividedBy(step).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(step);
}

/** True when `value` is an exact multiple of `step` (used for the d/e/ΔL checks). */
export function isMultipleOf(value: Decimal, step: Decimal): boolean {
  if (step.lte(0)) return false;
  return value.dividedBy(step).isInteger();
}
