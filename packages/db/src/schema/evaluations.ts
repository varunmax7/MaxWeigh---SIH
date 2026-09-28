/**
 * Evaluations, their per-test rows, attachments and review comments
 * (implementation.md §5, §6.3).
 *
 * `spec_snapshot`, `rulepack_id`/`rulepack_version` and `engine_version` are
 * copied at evaluation-creation time (implementation.md §3.2 principle 2):
 * editing master data or publishing a new rule pack later never changes a
 * past evaluation.
 */
import { EVALUATION_PRIORITIES, EVALUATION_STATUSES, OVERALL_VERDICTS } from '@tula/schemas';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  char,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import {
  createdAtColumn,
  enumCheck,
  fkUuid,
  idColumn,
  rowVersionColumn,
  updatedAtColumn,
} from './columns.js';
import { labs } from './labs.js';
import { applicants, instrumentModels, manufacturers } from './masterdata.js';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// `EVALUATION_STATUSES`/`OVERALL_VERDICTS`/`EVALUATION_PRIORITIES` live in
// @tula/schemas (client-safe) and are re-exported here for server code that
// already imports them from @tula/db — see the comment on their definition.
export type { EvaluationStatus, OverallVerdict } from '@tula/schemas';
export { EVALUATION_PRIORITIES, EVALUATION_STATUSES, OVERALL_VERDICTS };

export const evaluations = pgTable(
  'evaluations',
  {
    id: idColumn(),
    /** e.g. EV-BLR-2026-0142 */
    refNo: text('ref_no').notNull().unique(),
    labId: fkUuid('lab_id')
      .notNull()
      .references(() => labs.id),
    applicantId: fkUuid('applicant_id')
      .notNull()
      .references(() => applicants.id),
    manufacturerId: fkUuid('manufacturer_id')
      .notNull()
      .references(() => manufacturers.id),
    modelId: fkUuid('model_id')
      .notNull()
      .references(() => instrumentModels.id),
    sampleSerials: text('sample_serials').array(),
    /** Frozen `InstrumentMetrology` (@tula/engine, §4.2). */
    specSnapshot: jsonb('spec_snapshot').$type<Record<string, unknown>>().notNull(),
    rulepackId: text('rulepack_id').notNull(),
    rulepackVersion: text('rulepack_version').notNull(),
    engineVersion: text('engine_version').notNull(),
    status: text('status').notNull().default('DRAFT'),
    priority: text('priority').notNull().default('normal'),
    overallVerdict: text('overall_verdict'),
    assignedTesterId: fkUuid('assigned_tester_id').references(() => user.id),
    createdBy: fkUuid('created_by')
      .notNull()
      .references(() => user.id),
    dueAt: timestamp('due_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    rowVersion: rowVersionColumn(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    /**
     * `ref_no` only: a stored generated column can only read other columns
     * of the same row, so it cannot index the model/manufacturer/applicant
     * names that live on joined tables. See docs/QUESTIONS.md.
     */
    search: tsvector('search').generatedAlwaysAs(
      () => sql`to_tsvector('simple', coalesce(ref_no, ''))`,
    ),
  },
  (table) => [
    enumCheck('evaluations_status_check', table.status, EVALUATION_STATUSES),
    enumCheck('evaluations_priority_check', table.priority, EVALUATION_PRIORITIES),
    enumCheck('evaluations_verdict_check', table.overallVerdict, OVERALL_VERDICTS),
    index('evaluations_lab_status_idx').on(table.labId, table.status),
    index('evaluations_search_idx').using('gin', table.search),
  ],
);

export const TEST_APPLICABILITY = ['APPLICABLE', 'NOT_APPLICABLE'] as const;
export const TEST_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REOPENED'] as const;
export const TEST_VERDICTS = ['PASS', 'FAIL', 'INCOMPLETE', 'NOT_APPLICABLE'] as const;

export const evaluationTests = pgTable(
  'evaluation_tests',
  {
    id: idColumn(),
    evaluationId: fkUuid('evaluation_id')
      .notNull()
      .references(() => evaluations.id, { onDelete: 'cascade' }),
    testCode: text('test_code').notNull(),
    rangeIndex: integer('range_index').notNull().default(0),
    sequence: integer('sequence').notNull(),
    applicability: text('applicability').notNull(),
    naReason: text('na_reason'),
    status: text('status').notNull().default('PENDING'),
    verdict: text('verdict'),
    /** Planned loads, positions, schedule. */
    params: jsonb('params').$type<Record<string, unknown>>(),
    /** Validated by `@tula/schemas` per test code + `schemaVersion`. */
    observations: jsonb('observations').$type<Record<string, unknown>>(),
    /** `TestResult` from the server-side engine run. */
    result: jsonb('result').$type<Record<string, unknown>>(),
    envStart: jsonb('env_start').$type<Record<string, unknown>>(),
    envEnd: jsonb('env_end').$type<Record<string, unknown>>(),
    weightSetIds: fkUuid('weight_set_ids').array(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: fkUuid('completed_by').references(() => user.id),
    rowVersion: rowVersionColumn(),
  },
  (table) => [
    enumCheck('evaluation_tests_applicability_check', table.applicability, TEST_APPLICABILITY),
    enumCheck('evaluation_tests_status_check', table.status, TEST_STATUSES),
    enumCheck('evaluation_tests_verdict_check', table.verdict, TEST_VERDICTS),
    unique('evaluation_tests_unique').on(table.evaluationId, table.testCode, table.rangeIndex),
  ],
);

export const ATTACHMENT_KINDS = ['photo', 'document', 'calibration_cert', 'other'] as const;

export const attachments = pgTable(
  'attachments',
  {
    id: idColumn(),
    /**
     * Nullable — most attachments belong to an evaluation, but a lab
     * equipment calibration certificate (`kind: 'calibration_cert'`,
     * referenced by `reference_weight_sets.cert_attachment_id` or
     * `env_sensors.cert_attachment_id`) belongs to no evaluation at all.
     * Was `.notNull()` in P2; loosened here — see docs/QUESTIONS.md #17.
     */
    evaluationId: fkUuid('evaluation_id').references(() => evaluations.id, { onDelete: 'cascade' }),
    testId: fkUuid('test_id').references(() => evaluationTests.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    caption: text('caption'),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storageKey: text('storage_key').notNull(),
    thumbKey: text('thumb_key'),
    sha256: char('sha256', { length: 64 }).notNull(),
    exif: jsonb('exif').$type<Record<string, unknown>>(),
    uploadedBy: fkUuid('uploaded_by')
      .notNull()
      .references(() => user.id),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [enumCheck('attachments_kind_check', table.kind, ATTACHMENT_KINDS)],
);

export const comments = pgTable('comments', {
  id: idColumn(),
  evaluationId: fkUuid('evaluation_id')
    .notNull()
    .references(() => evaluations.id, { onDelete: 'cascade' }),
  testId: fkUuid('test_id').references(() => evaluationTests.id, { onDelete: 'cascade' }),
  rowRef: text('row_ref'),
  parentId: fkUuid('parent_id').references((): AnyPgColumn => comments.id),
  authorId: fkUuid('author_id')
    .notNull()
    .references(() => user.id),
  tier: smallint('tier'),
  body: text('body').notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: createdAtColumn(),
});
