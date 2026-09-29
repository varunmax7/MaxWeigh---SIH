/**
 * Synthetic instrument specs and observation builders for the `--volume`
 * seed extension (implementation.md §10 P9). See `seed-volume.ts` for the
 * orchestration; this module is only the "what does a plausible, and a
 * deliberately out-of-tolerance, reading look like" half.
 *
 * Every spec here is a scaled variant of `review.test.ts`'s `goldenSpec` —
 * same shape (`kind: 'single'`, one range, `e = d`, electronic, no tare, no
 * zero-tracking, 4-support platform, mains power), proven end-to-end through
 * the real workflow. Classes are restricted to II/III/IIII (never I):
 * `CREEP`/`ZERO_RETURN` only apply to those three (`rulepack.json`'s
 * `applicability.classes`), so every synthetic evaluation reaches the exact
 * same 11-test-code applicable set the golden spec does — see
 * `seed-volume.ts`'s own comment on why that set matters.
 */
import type { InstrumentMetrology } from '@tula/engine';

export interface SpecArchetype {
  label: string;
  spec: InstrumentMetrology;
}

function archetype(
  label: string,
  accuracyClass: InstrumentMetrology['accuracyClass'],
  maxG: number,
  eG: number,
): SpecArchetype {
  return {
    label,
    spec: {
      accuracyClass,
      kind: 'single',
      ranges: [{ max: String(maxG), e: String(eG), d: String(eG) }],
      min: String(eG * 20),
      tempRange: { lowC: -10, highC: 40 },
      isElectronic: true,
      hasTareDevice: false,
      hasZeroTracking: false,
      loadReceptor: { kind: 'platform', supports: 4 },
      levelIndicator: true,
      tiltSusceptible: false,
      powerSupply: { mains: { vNom: 230, fNomHz: 50 } },
      displayUnit: 'g',
    },
  };
}

/** Scaled proportionally to `goldenSpec` (Max 30 kg, e = d = 5 g → n = 6 000). */
export const SPEC_ARCHETYPES: SpecArchetype[] = [
  archetype('bench scale', 'III', 30_000, 5),
  archetype('precision bench scale', 'II', 15_000, 1),
  archetype('counter scale', 'III', 6_000, 1),
  archetype('platform scale', 'III', 300_000, 100),
  archetype('heavy platform scale', 'IIII', 500_000, 500),
  archetype('weighbridge', 'IIII', 3_000_000, 1_000),
];

/**
 * §4.5's change-point method computes `P = I + ½e − ΔL`, then `E = P − L` —
 * *not* simply `I − L`. So `I = L` alone does not give a zero error; `ΔL`
 * must cancel the `½e` term too. `ΔL = ½e` does that (`P = L`, `E = 0`) and
 * satisfies `errorOfIndication`'s own required range `0 < ΔL ≤ e`.
 */
function halfE(e: string): string {
  return String(Number(e) / 2);
}

/** Nearest multiple of `e` — `errorOfIndication` blocks (`OBS_NOT_MULTIPLE_OF_D`) on anything else, and `d = e` on every archetype here. */
function roundToE(value: number, e: string): string {
  const step = Number(e);
  return String(Math.round(value / step) * step);
}

/** A zero-error, no-drift `{L, I, deltaL}` triple — always PASSes an error-in-e evaluator (§4.5's E/E0/Ec chain is 0 either way). */
function exactRow(
  rowId: string,
  L: string,
  e: string,
): { rowId: string; L: string; I: string; deltaL: string } {
  return { rowId, L, I: L, deltaL: halfE(e) };
}

/**
 * Builds observations for every one of the 11 implemented test codes that
 * `planTests()` marks applicable on a `SPEC_ARCHETYPES` spec, plus the
 * `evaluation_tests.params` a real plan would have stored alongside them.
 * `forceFail`, when true, perturbs the WEIGHING range's top row by
 * `20 × e` — comfortably outside any class's MPE band at that load — so the
 * real `evaluateTest('WEIGHING', ...)` call legitimately returns FAIL rather
 * than one being fabricated (implementation.md §11: never re-implement or
 * fake a verdict the engine could compute).
 */
export function buildObservationsByCode(
  spec: InstrumentMetrology,
  plans: {
    weighing: { zeroRef: string; ascending: { L: string }[]; descending: { L: string }[] };
    eccentricity: { load: string; positions: string[] };
    repeatability: { loads: string[]; readingsPerSeries: number };
    discrimination: { loads: string[]; extraLoad: string };
    creep: { load: string; scheduleMin: number[] };
    tempSequenceC: number[];
  },
  forceFail: boolean,
): Record<string, unknown> {
  const e = spec.ranges[0]?.e ?? '1';
  const d = spec.ranges[0]?.d ?? e;

  const ascending = plans.weighing.ascending.map((row, i) => {
    const isTopRow = i === plans.weighing.ascending.length - 1;
    if (forceFail && isTopRow) {
      // P = I + ½e − ΔL with ΔL = ½e still gives P = I, so a plain `+20e`
      // offset on I lands 20e away from L exactly, comfortably outside any
      // class's MPE band at this load.
      const badI = String(Number(row.L) + Number(e) * 20);
      return { rowId: `asc-${i}`, L: row.L, I: badI, deltaL: halfE(e) };
    }
    return exactRow(`asc-${i}`, row.L, e);
  });
  const descending = plans.weighing.descending.map((row, i) => exactRow(`desc-${i}`, row.L, e));

  const eccentricityZeroRef = roundToE(Number(e) * 10, e);
  return {
    WEIGHING: {
      zeroRef: { L: plans.weighing.zeroRef, I: plans.weighing.zeroRef, deltaL: halfE(e) },
      ascending,
      descending,
    },
    ECCENTRICITY: {
      zeroRef: { L: eccentricityZeroRef, I: eccentricityZeroRef, deltaL: halfE(e) },
      positions: plans.eccentricity.positions.map((position) => {
        const load = roundToE(Number(plans.eccentricity.load), e);
        return { position, L: load, I: load, deltaL: halfE(e) };
      }),
    },
    REPEATABILITY: {
      series: plans.repeatability.loads.map((L) => ({
        L,
        readings: Array.from({ length: plans.repeatability.readingsPerSeries }, (_, i) => ({
          rowId: `r${i}`,
          I: L,
          deltaL: halfE(e),
        })),
      })),
    },
    DISCRIMINATION: {
      rows: plans.discrimination.loads.map((L, i) => ({
        rowId: `d${i}`,
        iBefore: L,
        iAfter: String(Number(L) + Number(d)),
      })),
    },
    TEMP_NO_LOAD: {
      referenceIndex: 0,
      readings: plans.tempSequenceC.map((tempC) => ({ tempC, i0: '0' })),
    },
    CREEP: {
      L: plans.creep.load,
      readings: plans.creep.scheduleMin.map((tMin) => ({ tMin, i: plans.creep.load })),
    },
    ZERO_RETURN: { i0Before: '0', i0After: '0' },
    ZERO_ACCURACY: { L: eccentricityZeroRef, I: eccentricityZeroRef, deltaL: halfE(e) },
    EXAM_MARKINGS: {
      items: [
        'manufacturer_mark',
        'accuracy_class',
        'max',
        'min',
        'e',
        'type_approval_sign',
        'serial_no',
      ].map((key) => ({ key, status: 'ok' })),
    },
    EXAM_CONSTRUCTION: {
      items: ['construction', 'sealing', 'software_identification'].map((key) => ({
        key,
        status: 'ok',
      })),
    },
  };
}
