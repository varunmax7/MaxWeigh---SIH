import { labs, referenceWeightSets } from '@tula/db';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, sql } from '../db.js';
import { listActiveUnexpiredWeightSets, listReferenceWeightSets } from './masterdata.js';

let labId: string;
const createdIds: string[] = [];

beforeAll(async () => {
  const [lab] = await db.select({ id: labs.id }).from(labs).where(eq(labs.code, 'RRSL-BLR'));
  if (!lab) throw new Error('seed data missing: run pnpm db:seed first');
  labId = lab.id;
});

afterAll(async () => {
  if (createdIds.length > 0) {
    await db.delete(referenceWeightSets).where(inArray(referenceWeightSets.id, createdIds));
  }
  await sql.end();
});

/**
 * implementation.md §10 P4 acceptance: "Expired weight sets are excluded
 * from pickers (query-level test) and flagged in lists."
 */
describe('reference weight set expiry', () => {
  it('excludes an expired set from the picker but flags it in the full list', async () => {
    const suffix = Date.now();
    const [active, expired] = await db
      .insert(referenceWeightSets)
      .values([
        {
          labId,
          setCode: `QA-ACTIVE-${suffix}`,
          oimlClass: 'F2',
          items: [{ id: '1', nominal_g: '1000' }],
          dueOn: '2099-01-01',
          status: 'active',
        },
        {
          labId,
          setCode: `QA-EXPIRED-${suffix}`,
          oimlClass: 'F2',
          items: [{ id: '1', nominal_g: '1000' }],
          dueOn: '2000-01-01',
          status: 'active',
        },
      ])
      .returning({ id: referenceWeightSets.id });
    if (!active || !expired) throw new Error('setup insert failed');
    createdIds.push(active.id, expired.id);

    const picker = await listActiveUnexpiredWeightSets(labId);
    expect(picker.some((s) => s.id === active.id)).toBe(true);
    expect(picker.some((s) => s.id === expired.id)).toBe(false);

    const fullList = await listReferenceWeightSets(labId);
    const activeRow = fullList.find((s) => s.id === active.id);
    const expiredRow = fullList.find((s) => s.id === expired.id);
    expect(activeRow?.expired).toBe(false);
    expect(expiredRow?.expired).toBe(true);
  });
});
