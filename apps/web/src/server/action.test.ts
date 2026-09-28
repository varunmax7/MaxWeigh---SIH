import { auditHead, auditLog } from '@tula/db';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ActionError, action } from './action.js';
import { db, sql } from './db.js';

// No cookies at all ⇒ `getSession()` resolves to null, exercising the
// "no session" branch of the FORBIDDEN path (implementation.md §10 P2
// acceptance: "A forbidden action returns FORBIDDEN and writes an audit
// entry"). This is a real, un-mocked round trip to the ledger.
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}));

const schema = z.object({ name: z.string().min(1) });

afterAll(async () => {
  await sql`ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only_trigger`;
  await sql`DELETE FROM audit_log`;
  await sql`ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only_trigger`;
  // Reset audit_head too, not just the rows — otherwise it keeps pointing at
  // a hash that no longer exists, and the next process to touch the ledger
  // (packages/db's own audit-ledger tests, run first by turbo.json's
  // dependency ordering, but still a separate `pnpm test` invocation) would
  // wrongly inherit a non-genesis starting point. Found via a real flaky
  // failure, not by inspection — see docs/QUESTIONS.md.
  await db.update(auditHead).set({ lastId: null, lastHash: null }).where(eq(auditHead.id, 1));
  await sql.end();
});

describe('action()', () => {
  it('returns VALIDATION and never touches the database for bad input', async () => {
    const testAction = action(
      {
        schema,
        permission: 'evaluation.create',
        audit: { action: 'test.noop', entityType: 'test' },
      },
      async () => 'unreachable',
    );

    const result = await testAction({ name: '' });
    expect(result).toEqual({ ok: false, code: 'VALIDATION', issues: expect.any(Array) });
  });

  it('returns FORBIDDEN and writes an audit entry when there is no session', async () => {
    const auditAction = 'test.forbidden.no-session';
    const testAction = action(
      {
        schema,
        permission: 'evaluation.create',
        audit: { action: auditAction, entityType: 'test', entityId: (input) => input.name },
      },
      async () => 'unreachable',
    );

    const result = await testAction({ name: 'probe-1' });
    expect(result).toEqual({ ok: false, code: 'FORBIDDEN' });

    const [row] = await db
      .select({ diff: auditLog.diff, entityId: auditLog.entityId, actorId: auditLog.actorId })
      .from(auditLog)
      .where(and(eq(auditLog.action, auditAction), eq(auditLog.entityId, 'probe-1')));

    expect(row).toBeDefined();
    expect(row?.actorId).toBeNull();
    expect(row?.diff).toMatchObject({ denied: true, reason: 'NO_SESSION' });
  });

  it('propagates an ActionError thrown by the handler as its own code, once permission would have passed', () => {
    // ActionError itself, independent of the session/permission gate it is
    // normally thrown behind — the wrapper's catch clause is what the
    // handler-level CONFLICT/NOT_FOUND/RULE codes rely on.
    const error = new ActionError('CONFLICT', 'row_version mismatch');
    expect(error.code).toBe('CONFLICT');
    expect(error).toBeInstanceOf(Error);
  });
});
