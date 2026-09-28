/**
 * Transactional reference-number allocation (implementation.md §5
 * `number_sequences`, §10 P5).
 *
 * `next_val` is "the next number to hand out" for a given `(lab_id, year,
 * kind)`. One `INSERT ... ON CONFLICT DO UPDATE` both takes the row lock and
 * advances the counter atomically — no separate `SELECT ... FOR UPDATE` is
 * needed, and it works whether or not the row exists yet for this lab/year.
 * `RETURNING next_val` gives the value *after* the increment, so the number
 * this call allocates is `returned - 1`.
 */
import { sql } from 'drizzle-orm';
import type { DbTx } from './audit-ledger.js';
import { type NumberSequenceKind, numberSequences } from './schema/rules.js';

/** Allocates and returns the next integer for `(labId, year, kind)`. Must run inside a transaction. */
export async function allocateNumber(
  tx: DbTx,
  labId: string,
  year: number,
  kind: NumberSequenceKind,
): Promise<number> {
  const [row] = await tx
    .insert(numberSequences)
    .values({ labId, year, kind, nextVal: 2 })
    .onConflictDoUpdate({
      target: [numberSequences.labId, numberSequences.year, numberSequences.kind],
      set: { nextVal: sql`${numberSequences.nextVal} + 1` },
    })
    .returning({ nextVal: numberSequences.nextVal });

  if (!row) throw new Error('number_sequences upsert returned no row');
  return row.nextVal - 1;
}
