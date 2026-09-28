import { auditHead } from '@tula/db';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';

export interface LedgerStatus {
  /** `null` when the ledger has no entries yet. */
  headHash: string | null;
}

/**
 * The sidebar footer's ledger status (implementation.md §7.4: "Ledger: ✓
 * 9F4C"). A single indexed-row read of `audit_head`, not a full
 * `verifyChain()` walk — that runs nightly in the worker (implementation.md
 * §9, §10 P2) and is too heavy to repeat on every page render.
 */
export async function getLedgerStatus(): Promise<LedgerStatus> {
  const [head] = await db
    .select({ lastHash: auditHead.lastHash })
    .from(auditHead)
    .where(eq(auditHead.id, 1));
  return { headHash: head?.lastHash ?? null };
}
