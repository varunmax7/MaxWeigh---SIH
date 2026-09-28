import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from './client.js';
import { allocateNumber } from './number-sequences.js';
import { labs } from './schema/labs.js';
import { numberSequences } from './schema/rules.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set (see .env.example)');

const { db, sql } = createDb(databaseUrl);

// A year far from any real evaluation, so this test can never collide with
// (or be affected by) real usage of the counter it shares a row with.
const TEST_YEAR = 9999;

let labId: string;

beforeAll(async () => {
  const [lab] = await db.select({ id: labs.id }).from(labs).where(eq(labs.code, 'RRSL-BLR'));
  if (!lab) throw new Error('seed data missing: run pnpm db:seed first');
  labId = lab.id;
});

afterAll(async () => {
  await db
    .delete(numberSequences)
    .where(and(eq(numberSequences.labId, labId), eq(numberSequences.year, TEST_YEAR)));
  await sql.end();
});

describe('allocateNumber', () => {
  it('starts at 1 for a lab/year/kind with no existing row', async () => {
    const n = await db.transaction((tx) => allocateNumber(tx, labId, TEST_YEAR, 'EVAL'));
    expect(n).toBe(1);
  });

  it('increments monotonically for the same lab/year/kind', async () => {
    const second = await db.transaction((tx) => allocateNumber(tx, labId, TEST_YEAR, 'EVAL'));
    const third = await db.transaction((tx) => allocateNumber(tx, labId, TEST_YEAR, 'EVAL'));
    expect(second).toBe(2);
    expect(third).toBe(3);
  });

  it('keeps separate counters per kind', async () => {
    const report = await db.transaction((tx) => allocateNumber(tx, labId, TEST_YEAR, 'REPORT'));
    expect(report).toBe(1);
  });

  it('allocates distinct, gap-free numbers under concurrent callers', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        db.transaction((tx) => allocateNumber(tx, labId, TEST_YEAR, 'CERT')),
      ),
    );
    expect([...results].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
