import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_RULEPACK_IDS,
  getRulepack,
  OIML_R76_1_2006,
  OIML_R111_WEIGHTS,
} from './index.js';

describe('@tula/rulepacks', () => {
  it('ships the R 76-1:2006 pack, already validated', () => {
    expect(AVAILABLE_RULEPACK_IDS).toContain('oiml-r76-1-2006');
    expect(OIML_R76_1_2006.id).toBe('oiml-r76-1-2006');
    expect(getRulepack('oiml-r76-1-2006')).toBe(OIML_R76_1_2006);
  });

  it('defines every accuracy class in classification and MPE bands', () => {
    for (const cls of ['I', 'II', 'III', 'IIII'] as const) {
      expect(OIML_R76_1_2006.classification[cls]?.length).toBeGreaterThan(0);
      expect(OIML_R76_1_2006.mpeBands[cls]?.length).toBe(3);
    }
  });

  it('lists every test code named in implementation.md §4.6', () => {
    const codes = OIML_R76_1_2006.tests.map((t) => t.code);
    expect(codes).toEqual([
      'EXAM_MARKINGS',
      'EXAM_CONSTRUCTION',
      'ZERO_RANGE',
      'ZERO_ACCURACY',
      'ZERO_TRACKING',
      'WEIGHING',
      'WEIGHING_SUPPL',
      'ECCENTRICITY',
      'DISCRIMINATION',
      'REPEATABILITY',
      'TARE_ACCURACY',
      'WEIGHING_TARE',
      'TILTING',
      'WARM_UP',
      'TEMP_STATIC',
      'TEMP_NO_LOAD',
      'DAMP_HEAT',
      'POWER_SUPPLY',
      'CREEP',
      'ZERO_RETURN',
      'DURABILITY',
      'DISTURBANCES',
      'SPAN_STABILITY',
      'MODULE_COMPAT',
    ]);
  });

  it('ships the R 111 weight table with a full row for 200 g', () => {
    const row = OIML_R111_WEIGHTS.rows.find((r) => r.nominal === '200');
    expect(row?.mpeMg.M1).toBe('10');
    expect(row?.mpeMg.F2).toBe('3');
  });
});
