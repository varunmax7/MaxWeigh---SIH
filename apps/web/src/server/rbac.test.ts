import { describe, expect, it } from 'vitest';
import { can, PERMISSIONS, permissionsFor } from './rbac.js';

describe('rbac', () => {
  it('lets an ADMIN manage users but never execute a test (implementation.md §6.2)', () => {
    expect(can('ADMIN', 'users.manage')).toBe(true);
    expect(can('ADMIN', 'test.execute')).toBe(false);
  });

  it('lets a TESTING_OFFICER execute tests and submit, but not review tier 1', () => {
    expect(can('TESTING_OFFICER', 'test.execute')).toBe(true);
    expect(can('TESTING_OFFICER', 'evaluation.submit')).toBe(true);
    expect(can('TESTING_OFFICER', 'review.tier1')).toBe(false);
  });

  it('gives the AUDITOR export but not share (§6.2: "✓ (export only)")', () => {
    expect(can('AUDITOR', 'report.export')).toBe(true);
    expect(can('AUDITOR', 'report.share')).toBe(false);
  });

  it('gives every role evaluation.read (own labs)', () => {
    for (const role of permissionsForEveryRole()) {
      expect(can(role, 'evaluation.read')).toBe(true);
    }
  });

  it('gives ADMIN and CONTROLLER — and only them — rulepack.publish', () => {
    for (const role of permissionsForEveryRole()) {
      const expected = role === 'ADMIN' || role === 'CONTROLLER';
      expect(can(role, 'rulepack.publish')).toBe(expected);
    }
  });

  it('permissionsFor returns exactly what can() would say yes to', () => {
    for (const role of permissionsForEveryRole()) {
      const granted = permissionsFor(role);
      for (const permission of PERMISSIONS) {
        expect(granted.has(permission)).toBe(can(role, permission));
      }
    }
  });
});

function permissionsForEveryRole() {
  return [
    'ADMIN',
    'INTAKE_OFFICER',
    'TESTING_OFFICER',
    'SENIOR_TESTING_OFFICER',
    'CHIEF_METROLOGY_OFFICER',
    'CONTROLLER',
    'AUDITOR',
  ] as const;
}
