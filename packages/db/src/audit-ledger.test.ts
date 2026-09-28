import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
 * Disables the append-only trigger just long enough to wipe `audit_log` and
 * reset `audit_head` to genesis — the trigger correctly refuses a plain
 * DELETE, so this is the only way to clear the ledger at all.
 */
async function resetLedgerToGenesis() {
  await sql`ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only_trigger`;
  await sql`DELETE FROM audit_log`;
  await sql`ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only_trigger`;
  await db.update(auditHead).set({ lastId: null, lastHash: null }).where(eq(auditHead.id, 1));
}

/**
 * These tests append real rows to the shared dev database's audit_log and
 * assert the very first one chains from `AUDIT_GENESIS_HASH` — true only if
 * the ledger is actually empty when this suite starts. `turbo.json` orders
 * `@tula/db#test` before every other package's tests specifically so that
 * holds under `pnpm test`, but normal application usage (every P4/P5+
 * mutation writes a real, permanent audit entry — by design, an audit trail
 * is not something tests should scrub) and ad hoc `vitest run` invocations
 * during development both leave real rows behind. `beforeAll` resets to
 * genesis explicitly rather than assuming it, so this suite is correct
 * regardless of what ran against this database before it, not just under
 * turbo's own ordering.
 */
beforeAll(resetLedgerToGenesis);
afterAll(async () => {
  await resetLedgerToGenesis();
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
