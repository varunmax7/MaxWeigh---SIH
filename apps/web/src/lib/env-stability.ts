/**
 * Environmental stability across a test's duration (implementation.md §10
 * P10: "stability check across the test duration using stored readings").
 * This is informational, not a blocking OIML rule — §4.6's actual static
 * temperature-sequence test (`TEMP_STATIC`) is a distinct, unimplemented
 * evaluator (docs/QUESTIONS.md #12); this is a lighter "did conditions
 * drift while you were reading this test" signal shown in the Inspector
 * panel for every load-based test, using whatever sensor readings were
 * actually stored during it.
 */
export interface EnvReadingSample {
  tempC: number;
  rhPct: number;
  ts: string;
}

export interface EnvStabilitySummary {
  sampleCount: number;
  maxTempDeltaC: number;
  maxRhDeltaPct: number;
  /** A conservative default — §4.6's own temperature-stability limits are per-test and not yet registered against this check (see module doc). */
  stable: boolean;
}

const MAX_TEMP_DELTA_C = 2;
const MAX_RH_DELTA_PCT = 10;

export function computeEnvStability(
  readings: readonly EnvReadingSample[],
): EnvStabilitySummary | null {
  if (readings.length === 0) return null;

  const temps = readings.map((r) => r.tempC);
  const rhs = readings.map((r) => r.rhPct);
  const maxTempDeltaC = Math.max(...temps) - Math.min(...temps);
  const maxRhDeltaPct = Math.max(...rhs) - Math.min(...rhs);

  return {
    sampleCount: readings.length,
    maxTempDeltaC,
    maxRhDeltaPct,
    stable: maxTempDeltaC <= MAX_TEMP_DELTA_C && maxRhDeltaPct <= MAX_RH_DELTA_PCT,
  };
}
