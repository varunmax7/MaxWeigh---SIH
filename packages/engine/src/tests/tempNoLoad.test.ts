import { describe, expect, it } from 'vitest';
import { makeInstrument } from '../__fixtures__/instruments.js';
import { getRulepack } from '../__fixtures__/rulepack.js';
import { evaluateTempNoLoad, type TempNoLoadObservation } from './tempNoLoad.js';

const rulepack = getRulepack();

// Same physical drift (1 e over 1 °C) reads differently by class:
//   class I:   ≤ 1 e per 1 °C → 1 e allowed at ΔT = 1 °C → boundary PASS
//   class III: ≤ 1 e per 5 °C → only 0.2 e allowed at ΔT = 1 °C → FAIL
describe('evaluateTempNoLoad (§4.6 TEMP_NO_LOAD, class I vs class III)', () => {
  const readings: TempNoLoadObservation['readings'] = [
    { tempC: 20, i0: '1000' },
    { tempC: 21, i0: '1001' }, // ΔI0 = 1 g = 1 e (e = 1 g)
  ];

  it('class I: passes at the boundary (1 e per 1 °C)', () => {
    const classI = makeInstrument({ accuracyClass: 'I', max: '2200', e: '1', min: '100' });
    const result = evaluateTempNoLoad({ readings }, { instrument: classI, rulepack, params: {} });
    expect(result.rows[1]?.verdict).toBe('PASS');
  });

  it('class III: fails the same drift (only 0.2 e allowed per °C)', () => {
    const classIII = makeInstrument({ accuracyClass: 'III', max: '30000', e: '1', min: '100' });
    const result = evaluateTempNoLoad({ readings }, { instrument: classIII, rulepack, params: {} });
    expect(result.rows[1]?.verdict).toBe('FAIL');
  });

  it('is INCOMPLETE for a rangeIndex the instrument does not declare', () => {
    const classIII = makeInstrument({ accuracyClass: 'III', max: '30000', e: '1', min: '100' });
    const result = evaluateTempNoLoad(
      { readings, rangeIndex: 3 },
      { instrument: classIII, rulepack, params: {} },
    );
    expect(result.verdict).toBe('INCOMPLETE');
  });

  it('is INCOMPLETE when referenceIndex points past the supplied readings', () => {
    const classIII = makeInstrument({ accuracyClass: 'III', max: '30000', e: '1', min: '100' });
    const result = evaluateTempNoLoad(
      { readings, referenceIndex: 9 },
      { instrument: classIII, rulepack, params: {} },
    );
    expect(result.verdict).toBe('INCOMPLETE');
  });
});
