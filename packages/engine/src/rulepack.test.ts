import { describe, expect, it } from 'vitest';
import { getRulepack } from './__fixtures__/rulepack.js';
import {
  classificationBandsFor,
  loadRulepack,
  loadWeightTable,
  mpeBandsFor,
  RulepackValidationError,
} from './rulepack.js';

const validRulepack = getRulepack();

describe('loadRulepack', () => {
  it('returns the parsed pack for valid input', () => {
    expect(loadRulepack(validRulepack).id).toBe('oiml-r76-1-2006');
  });

  it('throws RulepackValidationError with every issue named, for invalid input', () => {
    try {
      loadRulepack({ id: 'x' });
      expect.unreachable('loadRulepack should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RulepackValidationError);
      expect((error as RulepackValidationError).issues.length).toBeGreaterThan(0);
      expect((error as Error).message).toContain('Invalid rule pack');
    }
  });

  it('rejects a decimal string in the wrong form', () => {
    const broken = {
      ...validRulepack,
      inServiceFactor: 2,
      limits: { ...validRulepack.limits, zeroSettingAccuracyE: '0.25.1' },
    };
    expect(() => loadRulepack(broken)).toThrow(RulepackValidationError);
  });
});

describe('loadWeightTable', () => {
  it('validates a well-formed table', () => {
    const table = loadWeightTable({
      id: 't',
      title: 'test',
      unit: 'mg',
      rows: [
        { nominal: '1', mpeMg: { E2: '0.03', F1: '0.10', F2: '0.3', M1: '1', M2: '3', M3: '10' } },
      ],
    });
    expect(table.rows).toHaveLength(1);
  });

  it('rejects a malformed table', () => {
    expect(() => loadWeightTable({ id: 't', title: 'test', unit: 'kg' })).toThrow(
      RulepackValidationError,
    );
  });
});

describe('classificationBandsFor / mpeBandsFor', () => {
  it('returns the bands for a defined class', () => {
    expect(classificationBandsFor(validRulepack, 'III')?.length).toBeGreaterThan(0);
    expect(mpeBandsFor(validRulepack, 'III')?.length).toBe(3);
  });
});
