import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { insertAuditEntry, verifyChain } from './audit-ledger.js';
import { createDb } from './client.js';
import { AUDIT_GENESIS_HASH, auditHead, auditLog } from './schema/audit.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set (see .env.example)');

const { db, sql } = createDb(databaseUrl);

function entry(action: string) {
  return {
    actorId: null,
    actorRole: 'AUDITOR',
    labId: null,
    action,
    entityType: 'test',
    entityId: null,
    diff: { note: action },
    ip: null,
    userAgent: null,
  };
}

/**
 * These tests append real rows to the shared dev database's audit_log, so
 * every test run resets it to empty afterwards — restoring the append-only
 * trigger's own bypass mechanism (disable → clean up → re-enable) is the only
 * way to do that, since the trigger (correctly) refuses a plain DELETE.
 * Resetting `audit_head` too, not just the rows, matters just as much: any
 * other test file that also exercises the ledger (`apps/web`'s
 * `action.test.ts`) must leave the exact same pristine state behind, or the
 * next `pnpm test` run inherits a `prev_hash` pointing at a row that no
 * longer exists.
 */
afterAll(async () => {
  await sql`ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only_trigger`;
  await sql`DELETE FROM audit_log`;
  await sql`ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only_trigger`;
  await db.update(auditHead).set({ lastId: null, lastHash: null }).where(eq(auditHead.id, 1));
  await sql.end();
});

describe('audit ledger', () => {
  it('chains entries by hash, starting from genesis', async () => {
    const first = await db.transaction((tx) => insertAuditEntry(tx, entry('chain.first')));
    const second = await db.transaction((tx) => insertAuditEntry(tx, entry('chain.second')));

    expect(first.hash).toHaveLength(64);
    expect(second.hash).not.toBe(first.hash);

    const [firstRow] = await db.select().from(auditLog).where(eq(auditLog.id, first.id));
    const [secondRow] = await db.select().from(auditLog).where(eq(auditLog.id, second.id));
    expect(firstRow?.prevHash).toBe(AUDIT_GENESIS_HASH);
    expect(secondRow?.prevHash).toBe(first.hash);

    const [head] = await db.select().from(auditHead).where(eq(auditHead.id, 1));
    expect(head?.lastHash).toBe(second.hash);

    const result = await verifyChain(db);
    expect(result.ok).toBe(true);
  });

  it('rejects a plain UPDATE against audit_log', async () => {
    const { id } = await db.transaction((tx) => insertAuditEntry(tx, entry('reject.update')));
    await expect(
      sql`UPDATE audit_log SET action = 'tampered' WHERE id = ${String(id)}`,
    ).rejects.toThrow(/append-only/);
  });

  it('rejects a plain DELETE against audit_log', async () => {
    const { id } = await db.transaction((tx) => insertAuditEntry(tx, entry('reject.delete')));
    await expect(sql`DELETE FROM audit_log WHERE id = ${String(id)}`).rejects.toThrow(
      /append-only/,
    );
  });

  it('verifyChain reports the exact row tampered with by a superuser bypassing the trigger', async () => {
    await db.transaction((tx) => insertAuditEntry(tx, entry('tamper.before')));
    const target = await db.transaction((tx) => insertAuditEntry(tx, entry('tamper.target')));
    await db.transaction((tx) => insertAuditEntry(tx, entry('tamper.after')));

    expect((await verifyChain(db)).ok).toBe(true);

    await sql`ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only_trigger`;
    await sql`UPDATE audit_log SET diff = '{"note":"tampered"}'::jsonb WHERE id = ${String(target.id)}`;
    await sql`ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only_trigger`;

    const result = await verifyChain(db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.brokenId).toBe(target.id);
      expect(result.reason).toBe('hash_mismatch');
    }
  });
});
