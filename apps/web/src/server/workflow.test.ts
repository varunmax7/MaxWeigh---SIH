import { ROLES } from '@tula/db';
import { EVALUATION_STATUSES } from '@tula/schemas';
import { describe, expect, it } from 'vitest';
import { can } from './rbac.js';
import {
  assertModelCurrent,
  assertReadyToSubmit,
  assertSod1,
  assertSod2,
  assertSod3,
  assertTransition,
  canTransition,
  EVALUATION_TRANSITIONS,
  pendingTier,
  statusAfterApproval,
  testsAreLocked,
  testsToUnlock,
  WorkflowError,
} from './workflow.js';

function complete(completedBy: string | null, testCode = 'WEIGHING') {
  return { testCode, applicability: 'APPLICABLE', status: 'COMPLETED', completedBy };
}

describe('EVALUATION_TRANSITIONS', () => {
  it('covers every status in the enum, so no status is silently a dead end by omission', () => {
    expect(Object.keys(EVALUATION_TRANSITIONS).sort()).toEqual([...EVALUATION_STATUSES].sort());
  });

  it('only ever targets statuses that exist', () => {
    for (const targets of Object.values(EVALUATION_TRANSITIONS)) {
      for (const target of targets) {
        expect(EVALUATION_STATUSES).toContain(target);
      }
    }
  });

  it('walks the §6.3 happy path and refuses skipping a tier', () => {
    expect(canTransition('IN_TESTING', 'PENDING_T1')).toBe(true);
    expect(canTransition('PENDING_T1', 'PENDING_T2')).toBe(true);
    expect(canTransition('PENDING_T2', 'PENDING_T3')).toBe(true);
    expect(canTransition('PENDING_T3', 'ISSUED')).toBe(true);

    expect(canTransition('IN_TESTING', 'PENDING_T2')).toBe(false);
    expect(canTransition('PENDING_T1', 'ISSUED')).toBe(false);
    expect(canTransition('RETURNED', 'PENDING_T1')).toBe(false);
  });

  it('lets every pending tier return, and a returned evaluation only re-enter testing', () => {
    expect(canTransition('PENDING_T1', 'RETURNED')).toBe(true);
    expect(canTransition('PENDING_T2', 'RETURNED')).toBe(true);
    expect(canTransition('PENDING_T3', 'RETURNED')).toBe(true);
    expect(EVALUATION_TRANSITIONS.RETURNED).toEqual(['IN_TESTING']);
  });

  it('names the offending states in the message it throws', () => {
    expect(() => assertTransition('DRAFT', 'ISSUED')).toThrow(WorkflowError);
    expect(() => assertTransition('DRAFT', 'ISSUED')).toThrow(/draft/);
  });
});

describe('testsAreLocked', () => {
  it('locks tests from PENDING_T1 onward and nowhere earlier (§6.3 "Locking")', () => {
    expect(testsAreLocked('PLANNED')).toBe(false);
    expect(testsAreLocked('IN_TESTING')).toBe(false);
    expect(testsAreLocked('RETURNED')).toBe(false);

    expect(testsAreLocked('PENDING_T1')).toBe(true);
    expect(testsAreLocked('PENDING_T2')).toBe(true);
    expect(testsAreLocked('PENDING_T3')).toBe(true);
    expect(testsAreLocked('ISSUED')).toBe(true);
  });
});

describe('pendingTier / statusAfterApproval', () => {
  it('maps each pending status to its tier and back to where an approval lands', () => {
    expect(pendingTier('PENDING_T1')).toBe(1);
    expect(pendingTier('PENDING_T2')).toBe(2);
    expect(pendingTier('PENDING_T3')).toBe(3);
    expect(pendingTier('IN_TESTING')).toBeNull();

    expect(statusAfterApproval(1)).toBe('PENDING_T2');
    expect(statusAfterApproval(2)).toBe('PENDING_T3');
    expect(statusAfterApproval(3)).toBe('ISSUED');
  });
});

describe('assertReadyToSubmit', () => {
  it('passes once every applicable test is complete, ignoring N/A rows', () => {
    expect(() =>
      assertReadyToSubmit([
        complete('u1'),
        {
          testCode: 'ZERO_TRACKING',
          applicability: 'NOT_APPLICABLE',
          status: 'PENDING',
          completedBy: null,
        },
      ]),
    ).not.toThrow();
  });

  it('names the open tests rather than just refusing', () => {
    expect(() =>
      assertReadyToSubmit([
        complete('u1'),
        {
          testCode: 'CREEP',
          applicability: 'APPLICABLE',
          status: 'IN_PROGRESS',
          completedBy: null,
        },
      ]),
    ).toThrow(/CREEP/);
  });

  it('refuses an evaluation with no applicable tests at all', () => {
    expect(() =>
      assertReadyToSubmit([
        {
          testCode: 'CREEP',
          applicability: 'NOT_APPLICABLE',
          status: 'PENDING',
          completedBy: null,
        },
      ]),
    ).toThrow(/no applicable tests/);
  });
});

describe('SoD-1 — a test executor cannot verify at tier 1', () => {
  it('blocks the user who completed a test on this evaluation', () => {
    expect(() => assertSod1(1, 'u1', [complete('u1')])).toThrow(WorkflowError);
    expect(() => assertSod1(1, 'u1', [complete('u1')])).toThrow(/cannot verify it at tier 1/);
  });

  it('allows a senior officer who completed nothing here', () => {
    expect(() => assertSod1(1, 'u2', [complete('u1')])).not.toThrow();
  });

  it('is a tier-1 rule only — §6.2 scopes it there', () => {
    expect(() => assertSod1(2, 'u1', [complete('u1')])).not.toThrow();
  });
});

describe('SoD-2 — the three tiers are three distinct users', () => {
  const sha = 'a'.repeat(64);

  it('blocks a tier-1 signer from also signing tier 2', () => {
    const approvals = [{ tier: 1, userId: 'u1', decision: 'APPROVED', modelSha256: sha }];
    expect(() => assertSod2(2, 'u1', approvals, sha)).toThrow(/three different people/);
    expect(() => assertSod2(2, 'u2', approvals, sha)).not.toThrow();
  });

  it('blocks a second decision at a tier that already signed this version', () => {
    const approvals = [{ tier: 1, userId: 'u1', decision: 'APPROVED', modelSha256: sha }];
    expect(() => assertSod2(1, 'u9', approvals, sha)).toThrow(/tier 1 has already signed/i);
  });

  it('ignores approvals bound to a superseded model hash — the chain starts over', () => {
    const approvals = [
      { tier: 1, userId: 'u1', decision: 'APPROVED', modelSha256: 'b'.repeat(64) },
    ];
    expect(() => assertSod2(1, 'u1', approvals, sha)).not.toThrow();
  });

  it('ignores RETURNED decisions — returning is not signing', () => {
    const approvals = [{ tier: 1, userId: 'u1', decision: 'RETURNED', modelSha256: sha }];
    expect(() => assertSod2(1, 'u1', approvals, sha)).not.toThrow();
  });
});

describe('SoD-3 — rule pack publish needs two people', () => {
  it('blocks the initiator confirming their own publish', () => {
    expect(() => assertSod3('u1', 'u1')).toThrow(/two people/);
    expect(() => assertSod3('u1', 'u2')).not.toThrow();
  });
});

describe('ADMIN can never execute, approve, seal or revoke (§6.2)', () => {
  it('holds for every decision permission in the matrix', () => {
    for (const permission of [
      'test.execute',
      'review.tier1',
      'review.tier2',
      'report.seal',
      'report.revoke',
    ] as const) {
      expect(can('ADMIN', permission)).toBe(false);
    }
  });

  it('gives exactly one role each tier decision', () => {
    expect(ROLES.filter((r) => can(r, 'review.tier1'))).toEqual(['SENIOR_TESTING_OFFICER']);
    expect(ROLES.filter((r) => can(r, 'review.tier2'))).toEqual(['CHIEF_METROLOGY_OFFICER']);
    expect(ROLES.filter((r) => can(r, 'report.seal'))).toEqual(['CONTROLLER']);
  });
});

describe('assertModelCurrent', () => {
  it('refuses a decision taken against a snapshot that has since changed', () => {
    expect(() => assertModelCurrent('a'.repeat(64), 'a'.repeat(64))).not.toThrow();
    expect(() => assertModelCurrent('a'.repeat(64), 'b'.repeat(64))).toThrow(/Reload/);
  });
});

describe('testsToUnlock', () => {
  it('reopens only completed tests that carry an unresolved comment', () => {
    const tests = [
      { id: 't1', status: 'COMPLETED' },
      { id: 't2', status: 'COMPLETED' },
      { id: 't3', status: 'PENDING' },
    ];
    expect(testsToUnlock(tests, ['t1', 't3'])).toEqual(['t1']);
  });

  it('unlocks nothing when the comments are evaluation-level', () => {
    expect(testsToUnlock([{ id: 't1', status: 'COMPLETED' }], [])).toEqual([]);
  });
});
