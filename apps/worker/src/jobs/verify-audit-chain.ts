/**
 * Nightly audit-ledger integrity check (implementation.md §9, §10 P2).
 *
 * Walks the whole hash chain and logs the result; a broken chain is logged
 * at `error` level with the exact row id `verifyChain` found tampered.
 * Surfacing this on the dashboard and emailing the Controller the daily
 * head hash (§9) is P9/P10 scope — this job only produces the fact.
 */
import type { Db } from '@tula/db';
import { verifyChain } from '@tula/db';
import { logger } from '../logger.js';

export function makeVerifyAuditChain(db: Db) {
  return async function verifyAuditChain(): Promise<void> {
    const result = await verifyChain(db);
    if (result.ok) {
      logger.info({ rowsChecked: result.rowsChecked }, 'audit chain verified');
    } else {
      logger.error(
        { brokenId: result.brokenId.toString(), reason: result.reason },
        'audit chain integrity check FAILED',
      );
    }
  };
}
