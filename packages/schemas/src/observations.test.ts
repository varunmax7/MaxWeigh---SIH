import { describe, expect, it } from 'vitest';
import {
  creepObservationSchema,
  discriminationObservationSchema,
  eccentricityObservationSchema,
  examMarkingsObservationSchema,
  isImplementedTestCode,
  OBSERVATION_SCHEMA_VERSION,
  OBSERVATION_SCHEMAS,
  repeatabilityObservationSchema,
  tempNoLoadObservationSchema,
  weighingObservationSchema,
  zeroAccuracyObservationSchema,
  zeroReturnObservationSchema,
} from './observations.js';

describe('OBSERVATION_SCHEMA_VERSION', () => {
  it('starts at 1', () => {
    expect(OBSERVATION_SCHEMA_VERSION).toBe(1);
  });
});

describe('isImplementedTestCode', () => {
  it('recognises every schema key and rejects an unknown code', () => {
    for (const code of Object.keys(OBSERVATION_SCHEMAS)) {
      expect(isImplementedTestCode(code)).toBe(true);
    }
    expect(isImplementedTestCode('MODULE_COMPAT')).toBe(false);
  });
});

describe('zeroAccuracyObservationSchema', () => {
  it('accepts a minimal valid payload', () => {
    expect(
      zeroAccuracyObservationSchema.safeParse({ L: '50', I: '50', deltaL: '3.0' }).success,
    ).toBe(true);
  });

  it('rejects a comma-separated decimal', () => {
    expect(zeroAccuracyObservationSchema.safeParse({ L: '50', I: '10,000' }).success).toBe(false);
  });

  it('rejects a missing required field', () => {
    expect(zeroAccuracyObservationSchema.safeParse({ L: '50' }).success).toBe(false);
  });
});

describe('zeroReturnObservationSchema', () => {
  it('accepts a valid payload and rejects a missing one', () => {
    expect(zeroReturnObservationSchema.safeParse({ i0Before: '0', i0After: '2.5' }).success).toBe(
      true,
    );
    expect(zeroReturnObservationSchema.safeParse({ i0Before: '0' }).success).toBe(false);
  });
});

describe('weighingObservationSchema', () => {
  const valid = {
    zeroRef: { L: '50', I: '50', deltaL: '3.0' },
    ascending: [{ rowId: 'a', L: '10000', I: '10000', deltaL: '1.5' }],
    descending: [],
  };

  it('accepts a valid payload', () => {
    expect(weighingObservationSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a row missing rowId', () => {
    const broken = { ...valid, ascending: [{ L: '10000', I: '10000' }] };
    expect(weighingObservationSchema.safeParse(broken).success).toBe(false);
  });

  it('rejects an unknown mpeContext', () => {
    const broken = { ...valid, mpeContext: 'sometimes' };
    expect(weighingObservationSchema.safeParse(broken).success).toBe(false);
  });
});

describe('eccentricityObservationSchema', () => {
  it('accepts a valid payload', () => {
    const valid = {
      zeroRef: { L: '50', I: '50', deltaL: '3.0' },
      positions: [{ position: 'centre', L: '10000', I: '10000', deltaL: '1.5' }],
    };
    expect(eccentricityObservationSchema.safeParse(valid).success).toBe(true);
  });
});

describe('discriminationObservationSchema', () => {
  it('accepts a valid payload and rejects a missing iAfter', () => {
    expect(
      discriminationObservationSchema.safeParse({
        rows: [{ rowId: 'a', iBefore: '100', iAfter: '105' }],
      }).success,
    ).toBe(true);
    expect(
      discriminationObservationSchema.safeParse({ rows: [{ rowId: 'a', iBefore: '100' }] }).success,
    ).toBe(false);
  });
});

describe('repeatabilityObservationSchema', () => {
  it('accepts a valid payload', () => {
    const valid = {
      series: [{ L: '15000', readings: [{ rowId: 'r1', I: '15000', deltaL: '2.5' }] }],
    };
    expect(repeatabilityObservationSchema.safeParse(valid).success).toBe(true);
  });
});

describe('tempNoLoadObservationSchema', () => {
  it('accepts a valid payload', () => {
    const valid = {
      readings: [
        { tempC: 20, i0: '1000' },
        { tempC: 21, i0: '1001' },
      ],
    };
    expect(tempNoLoadObservationSchema.safeParse(valid).success).toBe(true);
  });
});

describe('creepObservationSchema', () => {
  it('accepts a valid payload and rejects a negative time', () => {
    const valid = { L: '30000', readings: [{ tMin: 0, i: '30000' }] };
    expect(creepObservationSchema.safeParse(valid).success).toBe(true);
    const broken = { L: '30000', readings: [{ tMin: -5, i: '30000' }] };
    expect(creepObservationSchema.safeParse(broken).success).toBe(false);
  });
});

describe('examMarkingsObservationSchema', () => {
  it('requires at least one checklist item', () => {
    expect(examMarkingsObservationSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      examMarkingsObservationSchema.safeParse({
        items: [{ key: 'manufacturer_mark', status: 'ok' }],
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(
      examMarkingsObservationSchema.safeParse({ items: [{ key: 'x', status: 'maybe' }] }).success,
    ).toBe(false);
  });
});
