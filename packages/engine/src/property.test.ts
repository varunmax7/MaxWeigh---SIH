/**
 * Property tests (implementation.md §4, P1 acceptance criteria):
 *   - mpe is non-decreasing with load inside a range
 *   - in-service MPE = 2 × initial MPE
 *   - shifting I and L by the same amount leaves E unchanged
 *   - Dec serialize/parse round-trips
 *   - evaluators are deterministic
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { goldenClassIII } from './__fixtures__/instruments.js';
import { getRulepack } from './__fixtures__/rulepack.js';
import { D, Decimal, isMultipleOf, toDec } from './decimal.js';
import { errorOfIndication } from './error.js';
import { mpe } from './mpe.js';
import { evaluateWeighing, type WeighingObservation } from './tests/weighing.js';

const rulepack = getRulepack();
const range = goldenClassIII.ranges[0];
if (!range) throw new Error('fixture instrument has no range');

// Loads within [0, Max] for the golden class III instrument (Max = 30000 g).
const loadArb = fc.integer({ min: 0, max: 30000 }).map((n) => n.toString());

describe('property: mpe is non-decreasing with load inside a range', () => {
  it('mpe(a) ≤ mpe(b) whenever a ≤ b', () => {
    fc.assert(
      fc.property(loadArb, loadArb, (a, b) => {
        const [lo, hi] = D(a).lte(D(b)) ? [a, b] : [b, a];
        const mpeLo = D(mpe(goldenClassIII, lo, rulepack).value);
        const mpeHi = D(mpe(goldenClassIII, hi, rulepack).value);
        expect(mpeHi.gte(mpeLo)).toBe(true);
      }),
    );
  });
});

describe('property: in-service MPE = 2 × initial MPE', () => {
  it('holds for every load', () => {
    fc.assert(
      fc.property(loadArb, (load) => {
        const initial = D(mpe(goldenClassIII, load, rulepack, { context: 'initial' }).value);
        const inService = D(mpe(goldenClassIII, load, rulepack, { context: 'in_service' }).value);
        expect(inService.eq(initial.times(rulepack.inServiceFactor))).toBe(true);
      }),
    );
  });
});

describe('property: shifting I and L by the same amount leaves E unchanged', () => {
  // I and the shift must land on multiples of d (= 5 g here) to stay a valid indication.
  const dMultiple = fc.integer({ min: -2000, max: 2000 }).map((n) => (n * 5).toString());
  const shiftMultiple = fc.integer({ min: -500, max: 500 }).map((n) => (n * 5).toString());
  const loadDec = fc.integer({ min: 0, max: 30000 }).map((n) => n.toString());
  const deltaLArb = fc.integer({ min: 1, max: 50 }).map((n) => (n * 0.1).toFixed(1)); // multiples of 0.1 e = 0.5 g, in (0, e]

  it('holds under the change-point method', () => {
    fc.assert(
      fc.property(dMultiple, loadDec, deltaLArb, shiftMultiple, (I, L, deltaL, shift) => {
        const before = errorOfIndication({ L, I, deltaL }, range, rulepack);
        const after = errorOfIndication(
          { L: D(L).plus(D(shift)).toFixed(), I: D(I).plus(D(shift)).toFixed(), deltaL },
          range,
          rulepack,
        );
        expect(D(after.E).eq(D(before.E))).toBe(true);
      }),
    );
  });

  it('holds under the direct method', () => {
    fc.assert(
      fc.property(dMultiple, loadDec, shiftMultiple, (I, L, shift) => {
        const before = errorOfIndication({ L, I, method: 'direct' }, range, rulepack);
        const after = errorOfIndication(
          { L: D(L).plus(D(shift)).toFixed(), I: D(I).plus(D(shift)).toFixed(), method: 'direct' },
          range,
          rulepack,
        );
        expect(D(after.E).eq(D(before.E))).toBe(true);
      }),
    );
  });
});

describe('property: Dec serialize/parse round-trip', () => {
  it('D(toDec(x)) equals x in value, for arbitrary decimals', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }),
          fc.integer({ min: 0, max: 9 }),
        ),
        ([whole, decimalDigit]) => {
          const value = new Decimal(`${whole}.${decimalDigit}`);
          const roundTripped = D(toDec(value));
          expect(roundTripped.eq(value)).toBe(true);
        },
      ),
    );
  });

  it('isMultipleOf is preserved across a round-trip', () => {
    fc.assert(
      fc.property(fc.integer({ min: -2000, max: 2000 }), (n) => {
        const value = D((n * 5).toString());
        const roundTripped = D(toDec(value));
        expect(isMultipleOf(roundTripped, D('5'))).toBe(isMultipleOf(value, D('5')));
      }),
    );
  });
});

describe('property: evaluators are deterministic', () => {
  it('evaluateWeighing produces identical output for identical input', () => {
    const obsArb = fc.record({
      L: fc.integer({ min: 100, max: 30000 }).map((n) => n.toString()),
      I: fc.integer({ min: 100, max: 30000 }).map((n) => n.toString()),
      deltaL: fc.integer({ min: 1, max: 50 }).map((n) => (n * 0.1).toFixed(1)),
    });

    fc.assert(
      fc.property(obsArb, (row) => {
        const obs: WeighingObservation = {
          zeroRef: { L: '50', I: '50', deltaL: '3.0' },
          ascending: [{ rowId: 'a', ...row }],
          descending: [],
        };
        const ctx = {
          instrument: goldenClassIII,
          rulepack,
          params: { minLoads: 1, stepFractionOfE: '0.1' },
        };
        const first = evaluateWeighing(obs, ctx);
        const second = evaluateWeighing(obs, ctx);
        expect(second).toEqual(first);
      }),
    );
  });
});
