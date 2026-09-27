/**
 * Standards adequacy and substitution — R 76-1 clause 3.7 (implementation.md §4.8).
 *
 * `standardsAdequacy` never divides by the adequacy divisor (3): it multiplies
 * the candidate sum instead (`sum × 3 ≤ mpe(L)`), so the comparison stays
 * exact even though 1/3 has no terminating decimal expansion.
 */
import { D, Decimal, toDec } from './decimal.js';
import { mpe } from './mpe.js';
import type { R111Class, Rulepack, WeightTable } from './rulepack.js';
import type { Dec, InstrumentMetrology, Issue } from './types.js';

export interface WeightPiece {
  /** Nominal mass, in grams. */
  nominal: Dec;
  weightClass: R111Class;
  /** How many identical pieces are available; default unlimited. */
  count?: number;
  /** ISO date; an expired piece cannot be used to certify adequacy. */
  calibrationExpiresAt?: string;
}

export interface DecomposedPiece {
  nominal: Dec;
  weightClass: R111Class;
  calibrationExpiresAt?: string;
}

/**
 * Decompose `load` into pieces of `weightSet` by greedily taking the largest
 * available piece that still fits, then the next largest, and so on. Returns
 * `null` when the set cannot reach `load` exactly.
 */
export function decomposeLoad(
  load: Decimal,
  weightSet: readonly WeightPiece[],
): DecomposedPiece[] | null {
  const inventory = weightSet
    .map((piece) => ({
      ...piece,
      nominalDec: D(piece.nominal),
      remaining: piece.count ?? Number.POSITIVE_INFINITY,
    }))
    .filter((piece) => piece.nominalDec.isPositive())
    .sort((a, b) => b.nominalDec.comparedTo(a.nominalDec));

  let remainingLoad = load;
  const used: DecomposedPiece[] = [];

  for (const piece of inventory) {
    while (piece.remaining > 0 && piece.nominalDec.lte(remainingLoad)) {
      used.push({
        nominal: piece.nominal,
        weightClass: piece.weightClass,
        ...(piece.calibrationExpiresAt !== undefined
          ? { calibrationExpiresAt: piece.calibrationExpiresAt }
          : {}),
      });
      remainingLoad = remainingLoad.minus(piece.nominalDec);
      piece.remaining -= 1;
    }
  }

  return remainingLoad.isZero() ? used : null;
}

/** R 111 MPE (mg) for one nominal + class, or `undefined` if not in the table. */
export function lookupWeightMpe(
  table: WeightTable,
  nominal: Decimal,
  weightClass: R111Class,
): Decimal | undefined {
  const row = table.rows.find((r) => D(r.nominal).eq(nominal));
  return row ? D(row.mpeMg[weightClass]) : undefined;
}

export interface StandardsAdequacyResult {
  adequate: boolean;
  decomposition: DecomposedPiece[] | null;
  /** Sum of the decomposed pieces' R 111 MPE, in grams. */
  sumOfMpe: Dec;
  /** `mpe(L) / divisor`, in grams — shown to the tester, not used for the comparison itself. */
  limit: Dec;
  issues: Issue[];
}

export interface StandardsAdequacyOptions {
  rangeIndex?: number;
  /** Defaults to `new Date()`; pass a fixed date in tests for determinism. */
  asOf?: Date;
}

/**
 * Clause 3.7.1: the standard weights used at `load` must have combined MPE
 * no greater than ⅓ of the instrument's own MPE at that load.
 */
export function standardsAdequacy(
  load: Dec,
  weightSet: readonly WeightPiece[],
  instrument: InstrumentMetrology,
  rulepack: Rulepack,
  weightTable: WeightTable,
  opts: StandardsAdequacyOptions = {},
): StandardsAdequacyResult {
  const L = D(load);
  const issues: Issue[] = [];
  const asOf = opts.asOf ?? new Date();

  const decomposition = decomposeLoad(L, weightSet);
  if (!decomposition) {
    issues.push({
      code: 'STD_INADEQUATE',
      severity: 'error',
      clause: '3.7.1',
      params: { reason: 'cannot-decompose-load', load },
    });
    return { adequate: false, decomposition: null, sumOfMpe: '0', limit: '0', issues };
  }

  let sumMg = new Decimal(0);
  for (const piece of decomposition) {
    const mg = lookupWeightMpe(weightTable, D(piece.nominal), piece.weightClass);
    if (mg === undefined) {
      issues.push({
        code: 'STD_INADEQUATE',
        severity: 'error',
        clause: '3.7.1',
        params: {
          reason: 'unknown-nominal',
          nominal: piece.nominal,
          weightClass: piece.weightClass,
        },
      });
      return { adequate: false, decomposition, sumOfMpe: '0', limit: '0', issues };
    }
    sumMg = sumMg.plus(mg);

    if (piece.calibrationExpiresAt !== undefined && new Date(piece.calibrationExpiresAt) < asOf) {
      issues.push({
        code: 'STD_EXPIRED',
        severity: 'error',
        clause: '3.7.1',
        params: {
          nominal: piece.nominal,
          weightClass: piece.weightClass,
          expiredAt: piece.calibrationExpiresAt,
        },
      });
    }
  }

  const sumGrams = sumMg.dividedBy(1000);
  const mpeResult = mpe(
    instrument,
    load,
    rulepack,
    opts.rangeIndex !== undefined ? { rangeIndex: opts.rangeIndex } : {},
  );
  const mpeValue = D(mpeResult.value);
  const divisor = rulepack.limits.standardsAdequacyDivisor;
  const adequate =
    sumGrams.times(divisor).lte(mpeValue) && !issues.some((i) => i.code === 'STD_EXPIRED');

  if (!sumGrams.times(divisor).lte(mpeValue)) {
    issues.push({
      code: 'STD_INADEQUATE',
      severity: 'error',
      clause: '3.7.1',
      params: { sum: toDec(sumGrams), limit: toDec(mpeValue.dividedBy(divisor)) },
    });
  }

  return {
    adequate,
    decomposition,
    sumOfMpe: toDec(sumGrams),
    limit: toDec(mpeValue.dividedBy(divisor)),
    issues,
  };
}

export interface SubstitutionCheckResult {
  adequate: boolean;
  issues: Issue[];
}

/**
 * Clause 3.7.3: for substitution material on large instruments, the standard
 * weights used must be ≥ 50 % of Max — 35 % is enough if repeatability error
 * ≤ 0.3 e, 20 % if ≤ 0.2 e.
 */
export function substitutionCheck(
  weightSharePct: Dec,
  repeatabilityErrorInE: Dec,
  rulepack: Rulepack,
): SubstitutionCheckResult {
  const share = D(weightSharePct);
  const repeatability = D(repeatabilityErrorInE);
  const { substitution } = rulepack.limits;

  const adequate =
    share.gte(D(substitution.fullSharePct)) ||
    (share.gte(D(substitution.reducedSharePct)) &&
      repeatability.lte(D(substitution.reducedRepeatabilityMaxE))) ||
    (share.gte(D(substitution.minimalSharePct)) &&
      repeatability.lte(D(substitution.minimalRepeatabilityMaxE)));

  const issues: Issue[] = adequate
    ? []
    : [
        {
          code: 'SUB_SHARE_LOW',
          severity: 'error',
          clause: '3.7.3',
          params: { share: weightSharePct, repeatabilityErrorInE },
        },
      ];

  return { adequate, issues };
}
