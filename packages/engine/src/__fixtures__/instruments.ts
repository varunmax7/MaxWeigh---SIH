/**
 * Reusable instrument fixtures for the engine's test suite. `goldenClassIII`
 * is the class III, Max 30 kg, e = d = 5 g instrument used throughout §4's
 * worked examples and golden fixtures (implementation.md §4.5, §4.7).
 */
import type { InstrumentMetrology } from '../types.js';

const DEFAULT_TEMP_RANGE = { lowC: -10, highC: 40 };
const DEFAULT_LOAD_RECEPTOR = { kind: 'platform' as const, supports: 4 };
const DEFAULT_POWER = { mains: { vNom: 230, fNomHz: 50 } };

/** Build a single-interval instrument with sensible defaults, overridable per test. */
export function makeInstrument(
  overrides: Partial<InstrumentMetrology> & {
    max: string;
    e: string;
    d?: string;
    min: string;
    accuracyClass: InstrumentMetrology['accuracyClass'];
  },
): InstrumentMetrology {
  const { max, e, d, min, accuracyClass, ...rest } = overrides;
  return {
    accuracyClass,
    kind: 'single',
    ranges: [{ max, e, d: d ?? e }],
    min,
    tempRange: DEFAULT_TEMP_RANGE,
    isElectronic: true,
    hasTareDevice: false,
    hasZeroTracking: false,
    loadReceptor: DEFAULT_LOAD_RECEPTOR,
    levelIndicator: true,
    tiltSusceptible: false,
    powerSupply: DEFAULT_POWER,
    displayUnit: 'g',
    ...rest,
  };
}

/** Class III, Max 30 kg, e = d = 5 g — the worked example of §4.5 and the golden plan of §4.7. */
export const goldenClassIII: InstrumentMetrology = makeInstrument({
  accuracyClass: 'III',
  max: '30000',
  e: '5',
  min: '100',
});

/** Class III, Max 6 kg / 15 kg, e 2 g / 5 g multi-interval instrument (MPE fixture, §4.4). */
export const multiIntervalClassIII: InstrumentMetrology = {
  ...makeInstrument({ accuracyClass: 'III', max: '15000', e: '5', min: '100' }),
  kind: 'multi_interval',
  ranges: [
    { max: '6000', e: '2', d: '2' },
    { max: '15000', e: '5', d: '5' },
  ],
};
