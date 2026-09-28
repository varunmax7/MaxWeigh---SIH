/**
 * Hash-chained append-only audit ledger (implementation.md §5, §9).
 *
 * `insertAuditEntry` must run inside the same transaction as the state
 * change it records (implementation.md §3.2 principle 3). It locks
 * `audit_head` first (`SELECT ... FOR UPDATE`) so concurrent writers append
 * to the chain one at a time instead of racing on `prev_hash`.
 *
 * `apps/web/src/server/audit.ts` wraps this with session/request context;
 * the primitive lives here because it is pure data-layer logic, tested
 * directly against a real Postgres instance (the trigger it depends on is
 * SQL, not Drizzle).
 */

import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';
import { asc, eq } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { Db } from './client.js';
import { AUDIT_GENESIS_HASH, auditHead, auditLog } from './schema/audit.js';

// biome-ignore lint/suspicious/noExplicitAny: transaction generics vary by caller; we only use .select/.insert/.update.
export type DbTx = PgTransaction<any, any, any> | Db;

export interface AuditEntryInput {
  actorId: string | null;
  actorRole: string | null;
  labId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  diff: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
}

interface AuditCanonicalPayload {
  ts: string;
  actorId: string | null;
  actorRole: string | null;
  labId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  diff: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
}

function canonicalPayload(ts: Date, entry: AuditEntryInput): AuditCanonicalPayload {
  return {
    ts: ts.toISOString(),
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    labId: entry.labId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    diff: entry.diff,
    ip: entry.ip,
    userAgent: entry.userAgent,
  };
}

function chainHash(prevHash: string, payload: AuditCanonicalPayload): string {
  const canonical = canonicalize(payload);
  if (canonical === undefined) {
    throw new TypeError('audit entry payload must be JSON-serializable');
  }
  return createHash('sha256').update(prevHash, 'utf8').update(canonical, 'utf8').digest('hex');
}

/** Appends one entry to the ledger and advances `audit_head`. Must run inside a transaction. */
export async function insertAuditEntry(
  tx: DbTx,
  entry: AuditEntryInput,
): Promise<{ id: bigint; ts: Date; hash: string }> {
  const [head] = await tx
    .select({ lastHash: auditHead.lastHash })
    .from(auditHead)
    .where(eq(auditHead.id, 1))
    .for('update');

  const prevHash = head?.lastHash ?? AUDIT_GENESIS_HASH;
  const ts = new Date();
  const hash = chainHash(prevHash, canonicalPayload(ts, entry));

  const [row] = await tx
    .insert(auditLog)
    .values({
      ts,
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      labId: entry.labId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      diff: entry.diff,
      ip: entry.ip,
      userAgent: entry.userAgent,
      prevHash,
      hash,
    })
    .returning({ id: auditLog.id });

  if (!row) throw new Error('audit_log insert returned no row');

  await tx
    .insert(auditHead)
    .values({ id: 1, lastId: row.id, lastHash: hash })
    .onConflictDoUpdate({
      target: auditHead.id,
      set: { lastId: row.id, lastHash: hash },
    });

  return { id: row.id, ts, hash };
}

export interface ChainOk {
  ok: true;
  rowsChecked: number;
}

export interface ChainBroken {
  ok: false;
  brokenId: bigint;
  reason: 'hash_mismatch' | 'prev_hash_mismatch';
}

/**
 * Walks `audit_log` in id order, recomputing the hash chain from genesis and
 * comparing it against what is stored. Returns the id of the first row whose
 * stored `hash`/`prev_hash` no longer matches what the recorded fields hash
 * to — the signature of a row tampered with directly in the database.
 */
export async function verifyChain(db: Db): Promise<ChainOk | ChainBroken> {
  const rows = await db
    .select({
      id: auditLog.id,
      ts: auditLog.ts,
      actorId: auditLog.actorId,
      actorRole: auditLog.actorRole,
      labId: auditLog.labId,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      diff: auditLog.diff,
      ip: auditLog.ip,
      userAgent: auditLog.userAgent,
      prevHash: auditLog.prevHash,
      hash: auditLog.hash,
    })
    .from(auditLog)
    .orderBy(asc(auditLog.id));

  let expectedPrevHash = AUDIT_GENESIS_HASH;
  for (const row of rows) {
    if (row.prevHash !== expectedPrevHash) {
      return { ok: false, brokenId: row.id, reason: 'prev_hash_mismatch' };
    }
    const payload = canonicalPayload(row.ts, {
      actorId: row.actorId,
      actorRole: row.actorRole,
      labId: row.labId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      diff: row.diff,
      ip: row.ip,
      userAgent: row.userAgent,
    });
    const expectedHash = chainHash(expectedPrevHash, payload);
    if (row.hash !== expectedHash) {
      return { ok: false, brokenId: row.id, reason: 'hash_mismatch' };
    }
    expectedPrevHash = row.hash;
  }

  return { ok: true, rowsChecked: rows.length };
}
