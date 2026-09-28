/**
 * Identity tables (implementation.md §5, §6.1, §9).
 *
 * `user`, `session`, `account` and `verification` are shaped to match Better
 * Auth's core schema plus its `twoFactor` plugin exactly (field-for-field,
 * checked against the installed `better-auth@1.7.6` source) so the Drizzle
 * adapter can read and write them without a translation layer. `user` is
 * extended with the application's own fields per the P2 task list: `role`,
 * `designation`, `employee_id`, `is_active`.
 */
import { bigint, boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createdAtColumn, enumCheck, fkUuid, idColumn, updatedAtColumn } from './columns.js';

export const ROLES = [
  'ADMIN',
  'INTAKE_OFFICER',
  'TESTING_OFFICER',
  'SENIOR_TESTING_OFFICER',
  'CHIEF_METROLOGY_OFFICER',
  'CONTROLLER',
  'AUDITOR',
] as const;
export type Role = (typeof ROLES)[number];

/** Roles for which TOTP enrolment is mandatory (implementation.md §9). */
export const TOTP_MANDATORY_ROLES: readonly Role[] = [
  'ADMIN',
  'SENIOR_TESTING_OFFICER',
  'CHIEF_METROLOGY_OFFICER',
  'CONTROLLER',
];

export const user = pgTable(
  'user',
  {
    id: idColumn(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    // --- application fields (not part of Better Auth's core schema) ---
    role: text('role').notNull(),
    designation: text('designation'),
    employeeId: text('employee_id'),
    isActive: boolean('is_active').notNull().default(true),
    // --- added by the `twoFactor` plugin schema ---
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [enumCheck('user_role_check', table.role, ROLES)],
);

export const session = pgTable('session', {
  id: idColumn(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: fkUuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const account = pgTable('account', {
  id: idColumn(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: fkUuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  /** Only populated for the `credential` (email + password) provider. */
  password: text('password'),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const verification = pgTable('verification', {
  id: idColumn(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

/** One TOTP enrolment per user, written by Better Auth's `twoFactor` plugin. */
export const twoFactor = pgTable('two_factor', {
  id: idColumn(),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  userId: fkUuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  verified: boolean('verified').notNull().default(true),
  failedVerificationCount: integer('failed_verification_count').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
});

/**
 * Postgres-backed rate limiting used by Better Auth for `/sign-in`,
 * `/two-factor/verify-totp` etc. (implementation.md §9).
 */
export const rateLimit = pgTable('rate_limit', {
  id: idColumn(),
  key: text('key').notNull(),
  count: integer('count').notNull(),
  /** Epoch milliseconds — Better Auth's rate-limit schema types this as a plain number, not a date. */
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});
