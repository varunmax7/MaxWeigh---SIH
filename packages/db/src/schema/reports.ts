/** Reports, their signed versions, tiered approvals and share links (implementation.md §5, §6.3, §8). */
import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { createdAtColumn, enumCheck, fkUuid, idColumn } from './columns.js';
import { evaluations } from './evaluations.js';

export const REPORT_STATUSES = ['DRAFT', 'IN_REVIEW', 'ISSUED', 'REVOKED', 'SUPERSEDED'] as const;

export const reports = pgTable(
  'reports',
  {
    id: idColumn(),
    evaluationId: fkUuid('evaluation_id')
      .notNull()
      .unique()
      .references(() => evaluations.id),
    reportNo: text('report_no').notNull().unique(),
    certificateNo: text('certificate_no').unique(),
    status: text('status').notNull().default('DRAFT'),
    currentVersionId: fkUuid('current_version_id'),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokeReason: text('revoke_reason'),
  },
  (table) => [enumCheck('reports_status_check', table.status, REPORT_STATUSES)],
);

export const REPORT_VERSION_STATUSES = ['DRAFT', 'SIGNED', 'SUPERSEDED'] as const;

export const reportVersions = pgTable(
  'report_versions',
  {
    id: idColumn(),
    reportId: fkUuid('report_id')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    /** '1.0', '1.1', '2.0' */
    version: text('version').notNull(),
    /** The immutable `ReportModel` snapshot (implementation.md §3.2 principle 5). */
    model: jsonb('model').$type<Record<string, unknown>>().notNull(),
    modelSha256: char('model_sha256', { length: 64 }).notNull(),
    pdfKey: text('pdf_key'),
    pdfSha256: char('pdf_sha256', { length: 64 }),
    docxKey: text('docx_key'),
    changeSummary: text('change_summary'),
    status: text('status').notNull().default('DRAFT'),
    createdBy: fkUuid('created_by')
      .notNull()
      .references(() => user.id),
    createdAt: createdAtColumn(),
  },
  (table) => [
    enumCheck('report_versions_status_check', table.status, REPORT_VERSION_STATUSES),
    unique('report_versions_report_version_unique').on(table.reportId, table.version),
  ],
);

export const APPROVAL_DECISIONS = ['APPROVED', 'RETURNED', 'REJECTED'] as const;

export const approvals = pgTable(
  'approvals',
  {
    id: idColumn(),
    reportVersionId: fkUuid('report_version_id')
      .notNull()
      .references(() => reportVersions.id, { onDelete: 'cascade' }),
    tier: smallint('tier').notNull(),
    decision: text('decision').notNull(),
    userId: fkUuid('user_id')
      .notNull()
      .references(() => user.id),
    comment: text('comment'),
    /** What exactly was approved. */
    modelSha256: char('model_sha256', { length: 64 }).notNull(),
    stepUpVerified: boolean('step_up_verified').notNull().default(false),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    enumCheck('approvals_decision_check', table.decision, APPROVAL_DECISIONS),
    check('approvals_tier_check', sql`${table.tier} between 1 and 3`),
    // SoD-2 reads every approval on a version to check the three tiers are
    // three distinct users (implementation.md §6.2).
    index('approvals_version_idx').on(table.reportVersionId),
  ],
);

export const shareLinks = pgTable('share_links', {
  id: idColumn(),
  reportVersionId: fkUuid('report_version_id')
    .notNull()
    .references(() => reportVersions.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdBy: fkUuid('created_by')
    .notNull()
    .references(() => user.id),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
