/**
 * Evaluation intake wizard schemas (implementation.md §5, §7.5, §10 P5).
 *
 * Split in two because the wizard itself is split in two: steps 1–3 (who,
 * what instrument, what spec) are enough to satisfy every NOT NULL column
 * `evaluations` has, so that's where a DRAFT row is first written and
 * autosaved; steps 4–5 (test-plan overrides, assignment) only ever apply to
 * an existing draft, at the final "Create evaluation" submit.
 */
import { z } from 'zod';
import { instrumentMetrologySchema } from './masterdata.js';

/**
 * `evaluations.status`/`.overallVerdict` enums (implementation.md §6.3,
 * §5), defined here rather than in `@tula/db` so a client component can
 * import them without pulling in that package's barrel — which re-exports
 * `client.ts`'s live `postgres` connection (`net`/`tls`) and breaks the
 * client build outright (the same class of bug `@tula/rulepacks` had, see
 * docs/PROGRESS.md P4). `packages/db/src/schema/evaluations.ts` imports
 * these back rather than defining its own copy.
 */
export const EVALUATION_STATUSES = [
  'DRAFT',
  'PLANNED',
  'IN_TESTING',
  'PENDING_T1',
  'PENDING_T2',
  'PENDING_T3',
  'ISSUED',
  'RETURNED',
  'REVOKED',
  'AMENDING',
  'CANCELLED',
] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

export const OVERALL_VERDICTS = ['CONFORMS', 'DOES_NOT_CONFORM', 'INCOMPLETE'] as const;
export type OverallVerdict = (typeof OVERALL_VERDICTS)[number];

export const evaluationDraftInputSchema = z.object({
  /** Present when updating an existing draft; absent to create one. */
  id: z.uuid().optional(),
  labId: z.uuid(),
  applicantId: z.uuid(),
  manufacturerId: z.uuid(),
  modelId: z.uuid(),
  sampleSerials: z.array(z.string().min(1)).default([]),
  /** Prefilled from the model's `defaultSpec`, editable for this evaluation only. */
  defaultSpec: instrumentMetrologySchema,
});

export const EVALUATION_PRIORITIES = ['normal', 'urgent'] as const;

export const evaluationTestOverrideSchema = z.object({
  code: z.string().min(1),
  /** Required — implementation.md §10 P5: "N/A toggle requires ReasonDialog". */
  naReason: z.string().min(1),
});

export const evaluationSubmitInputSchema = z.object({
  draftId: z.uuid(),
  /** Tests the engine marked APPLICABLE that the user overrides to N/A, with a reason each. */
  testOverrides: z.array(evaluationTestOverrideSchema).default([]),
  assignedTesterId: z.uuid().optional(),
  dueAt: z.iso.date().optional(),
  priority: z.enum(EVALUATION_PRIORITIES).default('normal'),
});

export const evaluationCancelInputSchema = z.object({
  id: z.uuid(),
  reason: z.string().min(1),
});
