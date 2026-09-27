/**
 * Evaluator registry — maps a rule pack's `evaluator` id (e.g. `"weighing@1"`)
 * to the function that runs it (implementation.md §4.10). Rule packs
 * reference evaluators by id; `evaluateTest` looks up the test's evaluator id
 * from the rule pack and dispatches by test *code* — the id a caller cares
 * about.
 */
import type { Rulepack } from './rulepack.js';
import { evaluateCreep } from './tests/creep.js';
import { evaluateDiscrimination } from './tests/discrimination.js';
import { evaluateEccentricity } from './tests/eccentricity.js';
import { evaluateExamConstruction } from './tests/examConstruction.js';
import { evaluateExamMarkings } from './tests/examMarkings.js';
import { evaluateRepeatability } from './tests/repeatability.js';
import { evaluateTareAccuracy } from './tests/tareAccuracy.js';
import { evaluateTempNoLoad } from './tests/tempNoLoad.js';
import { evaluateWeighing } from './tests/weighing.js';
import { evaluateZeroAccuracy } from './tests/zeroAccuracy.js';
import { evaluateZeroReturn } from './tests/zeroReturn.js';
import type { Evaluator, InstrumentMetrology, TestResult } from './types.js';

// The registry is intentionally erased to a uniform shape — each evaluator's
// real observation/params types are exported from its own tests/*.ts module,
// and are what a caller building `obs` for `evaluateTest` should import.
// biome-ignore lint/suspicious/noExplicitAny: erased on purpose, see above
type AnyEvaluator = Evaluator<any, any>;

export const EVALUATOR_REGISTRY: Record<string, AnyEvaluator> = {
  'examMarkings@1': evaluateExamMarkings,
  'examConstruction@1': evaluateExamConstruction,
  'zeroAccuracy@1': evaluateZeroAccuracy,
  'weighing@1': evaluateWeighing,
  'eccentricity@1': evaluateEccentricity,
  'discrimination@1': evaluateDiscrimination,
  'repeatability@1': evaluateRepeatability,
  'tareAccuracy@1': evaluateTareAccuracy,
  'tempNoLoad@1': evaluateTempNoLoad,
  'creep@1': evaluateCreep,
  'zeroReturn@1': evaluateZeroReturn,
};

export class UnknownTestCodeError extends Error {
  constructor(code: string) {
    super(`Unknown test code: ${code}`);
    this.name = 'UnknownTestCodeError';
  }
}

export class UnregisteredEvaluatorError extends Error {
  constructor(evaluatorId: string) {
    super(`No evaluator registered for id: ${evaluatorId}`);
    this.name = 'UnregisteredEvaluatorError';
  }
}

/**
 * Run the evaluator the rule pack names for `code`.
 *
 * @param code a test code from the rule pack's `tests[]` (e.g. `"WEIGHING"`)
 * @param obs the observation shape that test code's evaluator expects (see its tests/*.ts module)
 * @param ctx instrument + rule pack; `params` defaults to the rule pack's own `params` for this test
 */
export function evaluateTest(
  code: string,
  obs: unknown,
  ctx: { instrument: InstrumentMetrology; rulepack: Rulepack; params?: unknown },
): TestResult {
  const testDef = ctx.rulepack.tests.find((t) => t.code === code);
  if (!testDef) throw new UnknownTestCodeError(code);

  const evaluatorFn = EVALUATOR_REGISTRY[testDef.evaluator];
  if (!evaluatorFn) throw new UnregisteredEvaluatorError(testDef.evaluator);

  return evaluatorFn(obs, {
    instrument: ctx.instrument,
    rulepack: ctx.rulepack,
    params: ctx.params ?? testDef.params,
  });
}
