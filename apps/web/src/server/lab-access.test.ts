import { labs, user as userTable } from '@tula/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, sql } from './db.js';
import { assertLabMember } from './lab-access.js';

let memberLabId: string;
let outsideLabId: string;
let userId: string;

/**
 * `assertLabMember` guards a real cross-tenant leak: without it, any
 * signed-in user who knew (or guessed) another lab's evaluation id could
 * open that evaluation's overview or draft — the read had no lab-scope
 * check at all before this fix. See docs/PROGRESS.md P6 Decisions.
 */
describe("assertLabMember (implementation.md §11: reads scoped to the user's labs)", () => {
  beforeAll(async () => {
    const [member, outside, adminUser] = await Promise.all([
      db.select({ id: labs.id }).from(labs).where(eq(labs.code, 'RRSL-BLR')),
      db.select({ id: labs.id }).from(labs).where(eq(labs.code, 'RRSL-AMD')),
      db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, 'admin@tula.test')),
    ]);
    const memberLab = member[0];
    const outsideLab = outside[0];
    const admin = adminUser[0];
    if (!memberLab || !outsideLab || !admin)
      throw new Error('seed data missing: run pnpm db:seed first');
    memberLabId = memberLab.id;
    outsideLabId = outsideLab.id;
    userId = admin.id;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('resolves for a lab the user is a member of', async () => {
    await expect(assertLabMember(userId, memberLabId)).resolves.toBeUndefined();
  });

  it('throws (Next.js notFound) for a lab the user is not a member of', async () => {
    await expect(assertLabMember(userId, outsideLabId)).rejects.toThrow();
  });
});
