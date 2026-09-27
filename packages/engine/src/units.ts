/**
 * Mass parsing and formatting (implementation.md §4.1).
 *
 * Canonical unit is the gram. `parseMass` returns a `Dec` in grams;
 * `formatMass` renders grams back into whatever unit the UI wants.
 */
import { D, Decimal, toDec } from './decimal.js';
import type { Dec } from './types.js';

export type DisplayUnit = 'mg' | 'g' | 'kg' | 't';

const UNIT_TO_GRAMS: Record<DisplayUnit, Decimal> = {
  mg: new Decimal('0.001'),
  g: new Decimal(1),
  kg: new Decimal(1000),
  t: new Decimal(1_000_000),
};

export class MassParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MassParseError';
  }
}

// One optional sign, digits, an optional single '.' decimal point, optional
// whitespace, then an optional unit. No thousands separators of any kind.
const MASS_PATTERN = /^\s*(?<numeric>[+-]?\d+(?:\.\d+)?)\s*(?<unit>mg|g|kg|t)?\s*$/i;

/**
 * Parse a user-typed mass into a `Dec` string in grams.
 *
 * Accepts `10.005 kg`, `10005 g`, `10005` (assumed to be in `assumedUnit`),
 * `250 mg`, `2.5 t`. Rejects a comma as a separator (`10,005`) — ambiguous
 * between a thousands separator and a decimal comma — with a clear message.
 */
export function parseMass(input: string, assumedUnit: DisplayUnit = 'g'): Dec {
  const trimmed = input.trim();
  if (trimmed.includes(',')) {
    throw new MassParseError(
      `"${input}" uses a comma, which is ambiguous between a thousands separator and a decimal ` +
        `comma. Use a plain decimal point, e.g. "10.005 kg".`,
    );
  }

  const match = MASS_PATTERN.exec(trimmed);
  const numeric = match?.groups?.numeric;
  if (!match || !numeric) {
    throw new MassParseError(
      `"${input}" is not a recognised mass. Expected a number optionally followed by mg, g, kg or t.`,
    );
  }

  const unitToken = match.groups?.unit;
  const unit = unitToken ? (unitToken.toLowerCase() as DisplayUnit) : assumedUnit;
  return toDec(D(numeric).times(UNIT_TO_GRAMS[unit]));
}

/** Convert a gram value to `unit`, as a `Decimal` (no string formatting). */
export function convertMass(grams: Dec | Decimal, unit: DisplayUnit): Decimal {
  return D(grams).dividedBy(UNIT_TO_GRAMS[unit]);
}

/** Format a gram value in `unit` with a fixed number of decimal places, e.g. `"10.000 kg"`. */
export function formatMass(grams: Dec | Decimal, unit: DisplayUnit, decimalPlaces: number): string {
  return `${convertMass(grams, unit).toFixed(decimalPlaces)} ${unit}`;
}
