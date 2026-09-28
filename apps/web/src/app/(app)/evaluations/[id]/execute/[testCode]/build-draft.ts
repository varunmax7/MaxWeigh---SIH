/**
 * Turns a planned `evaluation_tests` row (`params`, from `submitEvaluationAction`)
 * plus any previously-saved `observations` back into the draft shape each
 * form's inputs render — never the reverse of a form's own `toEngineObs`.
 * Every field defaults to an empty/null "not yet entered" value rather than
 * `0` or `''` treated as a real reading, so a grid always shows exactly the
 * planned rows with nothing prefilled beyond `L`.
 */
import { D, type InstrumentMetrology, toDec } from '@tula/engine';
import { OIML_R76_1_2006 } from '@tula/rulepacks';
import type { CHECKLIST_ITEMS, ChecklistDraft } from './forms/ChecklistForm';
import type { CreepDraft } from './forms/CreepForm';
import type { DiscriminationDraft } from './forms/DiscriminationForm';
import type { EccentricityDraft } from './forms/EccentricityForm';
import type { RepeatabilityDraft } from './forms/RepeatabilityForm';
import type { SingleMeasurementDraft } from './forms/SingleMeasurementForm';
import type { TempNoLoadDraft } from './forms/TempNoLoadForm';
import type { WeighingDraft } from './forms/WeighingForm';
import type { ZeroReturnDraft } from './forms/ZeroReturnForm';

type Json = Record<string, unknown> | null;

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}
function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

/** The near-zero reference load a form defaults to when the plan itself carries none (§4.5's "zero ref at 10 e" convention). */
function defaultZeroRefL(spec: InstrumentMetrology): string {
  const range = spec.ranges[0];
  return range ? toDec(D(range.e).times(10)) : '0';
}

export function buildWeighingDraft(params: Json, observations: Json): WeighingDraft {
  const p = asRecord(params);
  const obs = asRecord(observations);
  const zeroRefL = asString(p.zeroRef) ?? '0';
  const savedZeroRef = asRecord(obs.zeroRef);
  const savedAscending = asArray(obs.ascending);
  const savedDescending = asArray(obs.descending);

  function rows(planned: unknown[], saved: unknown[]) {
    return planned.map((row, i) => {
      const L = asString(asRecord(row).L) ?? '0';
      const savedRow = asRecord(saved[i]);
      return { rowId: `r${i}`, L, I: asString(savedRow.I), deltaL: asString(savedRow.deltaL) };
    });
  }

  return {
    zeroRef: {
      L: zeroRefL,
      I: asString(savedZeroRef.I) ?? '',
      deltaL: asString(savedZeroRef.deltaL) ?? '',
    },
    ascending: rows(asArray(p.ascending), savedAscending),
    descending: rows(asArray(p.descending), savedDescending),
  };
}

export function buildEccentricityDraft(
  params: Json,
  observations: Json,
  spec: InstrumentMetrology,
): EccentricityDraft {
  const p = asRecord(params);
  const obs = asRecord(observations);
  const load = asString(p.load) ?? '0';
  const positions = asArray(p.positions).filter((x): x is string => typeof x === 'string');
  const savedPositions = asArray(obs.positions).map((x) => asRecord(x));
  const savedZeroRef = asRecord(obs.zeroRef);

  return {
    zeroRef: {
      L: defaultZeroRefL(spec),
      I: asString(savedZeroRef.I) ?? '',
      deltaL: asString(savedZeroRef.deltaL) ?? '',
    },
    positions: positions.map((position) => {
      const saved = savedPositions.find((s) => s.position === position);
      return {
        position,
        L: load,
        I: asString(saved?.I ?? null),
        deltaL: asString(saved?.deltaL ?? null),
      };
    }),
  };
}

export function buildZeroBasedDraft(
  observations: Json,
  spec: InstrumentMetrology,
): SingleMeasurementDraft {
  const obs = asRecord(observations);
  return {
    L: defaultZeroRefL(spec),
    I: asString(obs.I) ?? '',
    deltaL: asString(obs.deltaL) ?? '',
  };
}

export function buildZeroReturnDraft(observations: Json): ZeroReturnDraft {
  const obs = asRecord(observations);
  return { i0Before: asString(obs.i0Before) ?? '', i0After: asString(obs.i0After) ?? '' };
}

export function buildDiscriminationDraft(params: Json, observations: Json): DiscriminationDraft {
  const p = asRecord(params);
  const obs = asRecord(observations);
  const loads = asArray(p.loads).filter((x): x is string => typeof x === 'string');
  const savedRows = asArray(obs.rows).map((x) => asRecord(x));

  return {
    rows: loads.map((L, i) => {
      const saved = savedRows[i];
      return {
        rowId: `r${i}`,
        L,
        iBefore: asString(saved?.iBefore),
        iAfter: asString(saved?.iAfter),
      };
    }),
    extraLoad: asString(p.extraLoad) ?? '0',
  };
}

export function buildRepeatabilityDraft(params: Json, observations: Json): RepeatabilityDraft {
  const p = asRecord(params);
  const obs = asRecord(observations);
  const loads = asArray(p.loads).filter((x): x is string => typeof x === 'string');
  const readingsPerSeries = typeof p.readingsPerSeries === 'number' ? p.readingsPerSeries : 0;
  const savedSeries = asArray(obs.series).map((x) => asRecord(x));

  return {
    series: loads.map((L, si) => {
      const savedReadings = asArray(savedSeries[si]?.readings).map((x) => asRecord(x));
      return {
        L,
        readings: Array.from({ length: readingsPerSeries }, (_, ri) => ({
          rowId: `r${ri}`,
          I: asString(savedReadings[ri]?.I),
        })),
      };
    }),
  };
}

export function buildCreepDraft(params: Json, observations: Json): CreepDraft {
  const p = asRecord(params);
  const obs = asRecord(observations);
  const load = asString(p.load) ?? '0';
  const scheduleMin = asArray(p.scheduleMin).filter((x): x is number => typeof x === 'number');
  const savedReadings = asArray(obs.readings).map((x) => asRecord(x));
  const extendedT = OIML_R76_1_2006.limits.creepExtendedTimeMin;
  const allTimes = [...scheduleMin, extendedT];

  return {
    L: load,
    readings: allTimes.map((tMin) => ({
      tMin,
      i: asString(savedReadings.find((r) => r.tMin === tMin)?.i),
    })),
  };
}

export function buildTempNoLoadDraft(params: Json, observations: Json): TempNoLoadDraft {
  const p = asRecord(params);
  const obs = asRecord(observations);
  const sequenceC = asArray(p.sequenceC).filter((x): x is number => typeof x === 'number');
  const savedReadings = asArray(obs.readings).map((x) => asRecord(x));

  return {
    readings: sequenceC.map((tempC, i) => ({ tempC, i0: asString(savedReadings[i]?.i0) })),
  };
}

export function buildChecklistDraft(
  testCode: 'EXAM_MARKINGS' | 'EXAM_CONSTRUCTION',
  observations: Json,
  items: typeof CHECKLIST_ITEMS,
): ChecklistDraft {
  const obs = asRecord(observations);
  const savedItems = asArray(obs.items).map((x) => asRecord(x));
  const definedItems = items[testCode] ?? [];

  return {
    items: definedItems.map((item) => {
      const saved = savedItems.find((s) => s.key === item.key);
      const status = asString(saved?.status);
      return {
        key: item.key,
        status: status === 'ok' || status === 'fail' || status === 'not_applicable' ? status : '',
        note: asString(saved?.note) ?? '',
      };
    }),
  };
}
