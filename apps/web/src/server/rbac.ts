/**
 * The permission matrix (implementation.md §6.2) — the single source of
 * truth every server action, query and the sidebar nav (P3) check against.
 * Nothing here knows about specific evaluations or reports; separation-of-
 * duties rules that need that context (SoD-1..3) are enforced where the
 * action itself runs, not by `can()`.
 */
import type { Role } from '@tula/db';

export const PERMISSIONS = [
  'users.manage',
  'settings.manage',
  'masterdata.manage',
  'standards.manage',
  'evaluation.create',
  'evaluation.read',
  'evaluation.assign',
  'test.execute',
  'evaluation.submit',
  'test.reopen',
  'review.tier1',
  'review.tier2',
  'report.seal',
  'report.revoke',
  'report.export',
  'report.share',
  'rulepack.draft',
  /**
   * A two-person action (SoD-3): granted to both ADMIN (who may only
   * initiate) and CONTROLLER (who may only confirm, as a *different* user
   * from the initiator). `can()` only says a role may take part; the publish
   * action itself must still check that the confirmer differs from the
   * initiator.
   */
  'rulepack.publish',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([
    'users.manage',
    'settings.manage',
    'masterdata.manage',
    'standards.manage',
    'evaluation.read',
    'report.export',
    'report.share',
    'rulepack.draft',
    'rulepack.publish',
    'audit.read',
  ]),
  INTAKE_OFFICER: new Set<Permission>([
    'masterdata.manage',
    'evaluation.create',
    'evaluation.read',
    'evaluation.assign',
    'report.export',
    'report.share',
  ]),
  TESTING_OFFICER: new Set<Permission>([
    'evaluation.create',
    'evaluation.read',
    'test.execute',
    'evaluation.submit',
    'report.export',
    'report.share',
  ]),
  SENIOR_TESTING_OFFICER: new Set<Permission>([
    'masterdata.manage',
    'standards.manage',
    'evaluation.create',
    'evaluation.read',
    'evaluation.assign',
    'test.execute',
    'evaluation.submit',
    'test.reopen',
    'review.tier1',
    'report.export',
    'report.share',
    'audit.read',
  ]),
  CHIEF_METROLOGY_OFFICER: new Set<Permission>([
    'evaluation.read',
    'evaluation.assign',
    'test.reopen',
    'review.tier2',
    'rulepack.draft',
    'report.export',
    'report.share',
    'audit.read',
  ]),
  CONTROLLER: new Set<Permission>([
    'evaluation.read',
    'report.seal',
    'report.revoke',
    'report.export',
    'report.share',
    'rulepack.publish',
    'audit.read',
  ]),
  AUDITOR: new Set<Permission>(['evaluation.read', 'report.export', 'audit.read']),
};

/** Whether `role` holds `permission`, per the static matrix (implementation.md §6.2). */
export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].has(permission);
}

/** Every permission a role holds — used to filter the sidebar nav (P3). */
export function permissionsFor(role: Role): ReadonlySet<Permission> {
  return MATRIX[role];
}
