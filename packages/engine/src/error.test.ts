import { describe, expect, it } from 'vitest';
import { goldenClassIII } from './__fixtures__/instruments.js';
import { getRulepack } from './__fixtures__/rulepack.js';
import { correctedError, errorOfIndication } from './error.js';
import { mpe } from './mpe.js';

const rulepack = getRulepack();
const range = goldenClassIII.ranges[0];
if (!range) throw new Error('fixture instrument has no range');

describe('errorOfIndication — golden worked example (§4.5, class III, Max 30 kg, e = d = 5 g)', () => {
  it('computes the zero reference: L=50g, I=50g, ΔL=3.0g → E0 = −0.5 g (≤ 1.25 g)', () => {
    const { P, E } = errorOfIndication({ L: '50', I: '50', deltaL: '3.0' }, range, rulepack);
    expect(P).toBe('49.5');
    expect(E).toBe('-0.5');
    // zero-setting accuracy limit is 0.25e = 1.25 g at this e
    expect(Math.abs(Number(E))).toBeLessThanOrEqual(1.25);
  });

  it.each([
    // L, I, ΔL, expected P, expected E, expected Ec, expected mpe, expected verdict
    ['10000', '10000', '1.5', '10001', '1', '1.5', '5', 'PASS'],
    ['30000', '30005', '0.5', '30007', '7', '7.5', '7.5', 'PASS'], // inclusive boundary
    ['2500', '2505', '4.5', '2503', '3', '3.5', '2.5', 'FAIL'],
  ] as const)(
    'L=%s I=%s ΔL=%s → P=%s E=%s Ec=%s (mpe=%s g) → %s',
    (L, I, deltaL, expectedP, expectedE, expectedEc, expectedMpe, expectedVerdict) => {
      const { P, E } = errorOfIndication({ L, I, deltaL }, range, rulepack);
      expect(P).toBe(expectedP);
      expect(E).toBe(expectedE);

      const E0 = '-0.5';
      const Ec = correctedError(E, E0);
      expect(Ec.toFixed()).toBe(expectedEc);

      const mpeResult = mpe(goldenClassIII, L, rulepack);
      expect(mpeResult.value).toBe(expectedMpe);

      const verdict = Ec.abs().lte(mpeResult.value) ? 'PASS' : 'FAIL';
      expect(verdict).toBe(expectedVerdict);
    },
  );
});

describe('errorOfIndication — row validation', () => {
  it('flags an indication that is not a multiple of d', () => {
    const { issues } = errorOfIndication({ L: '10000', I: '10001', deltaL: '1' }, range, rulepack);
    expect(issues.map((i) => i.code)).toContain('OBS_NOT_MULTIPLE_OF_D');
  });

  it('flags ΔL outside (0, e]', () => {
    const { issues } = errorOfIndication({ L: '10000', I: '10000', deltaL: '6' }, range, rulepack);
    expect(issues.map((i) => i.code)).toContain('OBS_DELTA_L_RANGE');
  });

  it('warns when ΔL is not a multiple of the step (0.1 e = 0.5 g)', () => {
    const { issues } = errorOfIndication(
      { L: '10000', I: '10000', deltaL: '0.3' },
      range,
      rulepack,
    );
    const issue = issues.find((i) => i.code === 'OBS_DELTA_L_STEP');
    expect(issue?.severity).toBe('warning');
  });

  it('flags a missing ΔL under the change-point method', () => {
    const { issues } = errorOfIndication({ L: '10000', I: '10000' }, range, rulepack);
    expect(issues.map((i) => i.code)).toContain('OBS_MISSING');
  });

  it('uses the direct method (P = I) when requested', () => {
    const { P, E, issues } = errorOfIndication(
      { L: '10000', I: '10001.0', method: 'direct' },
      range,
      rulepack,
    );
    expect(P).toBe('10001');
    expect(E).toBe('1');
    // I=10001 is not a multiple of d=5 for this instrument's normal indication,
    // but the direct method is meant for a higher-resolution service indication —
    // the row-validation check still runs and will flag it; that's expected here.
    expect(issues.map((i) => i.code)).toContain('OBS_NOT_MULTIPLE_OF_D');
  });
});

describe('correctedError', () => {
  it('subtracts E0 from E', () => {
    expect(correctedError('7.0', '-0.5').toFixed()).toBe('7.5');
  });
});
