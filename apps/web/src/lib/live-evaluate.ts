/**
 * Client-side "live preview" evaluation (implementation.md §7.5: "Live
 * verdicts from the client engine as you type; the server recomputes on
 * save and its result is what gets stored"). Same pattern as `classify.ts`:
 * the one place that calls `@tula/engine` so the exact same evaluation logic
 * runs in the browser and on the server — never two implementations to
 * drift apart (§11).
 */
import { evaluateTest, type InstrumentMetrology, type TestResult } from '@tula/engine';
import { OIML_R76_1_2006 } from '@tula/rulepacks';

/** Evaluates `obs` against `spec` the same way the server will on save. Returns `null` if `obs` doesn't parse for this test code. */
export function liveEvaluate(
  testCode: string,
  obs: unknown,
  spec: InstrumentMetrology,
): TestResult | null {
  try {
    return evaluateTest(testCode, obs, { instrument: spec, rulepack: OIML_R76_1_2006 });
  } catch {
    return null;
  }
}
