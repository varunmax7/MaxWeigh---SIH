import { labs, user as userTable } from '@tula/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const cookieStore = { get: vi.fn(), set: vi.fn() };
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const getSession = vi.fn();
vi.mock('@/server/session', () => ({ getSession }));

const { setActiveLabAction } = await import('./actions.js');
const { db, sql } = await import('@/server/db');

let memberLabId: string;
let outsideLabId: string;
let userId: string;

/**
 * Regression test for the P9 fix (docs/PROGRESS.md P9 Decisions):
 * `setActiveLabAction` used to write `active_lab_id` for any lab id at all,
 * with no membership check — every lab-scoped read that trusts the cookie
 * (§11) was only as safe as the LabSwitcher UI never offering a lab the
 * user isn't in, which a hand-set cookie trivially bypassed.
 */
describe('setActiveLabAction (implementation.md §11, §7.4)', () => {
  beforeAll(async () => {
    const [member, outside, admin] = await Promise.all([
      db.select({ id: labs.id }).from(labs).where(eq(labs.code, 'RRSL-BLR')),
      db.select({ id: labs.id }).from(labs).where(eq(labs.code, 'RRSL-AMD')),
      db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, 'admin@tula.test')),
    ]);
    if (!member[0] || !outside[0] || !admin[0]) {
      throw new Error('seed data missing: run pnpm db:seed first');
    }
    memberLabId = member[0].id;
    outsideLabId = outside[0].id;
    userId = admin[0].id;
    getSession.mockResolvedValue({ user: { id: userId } });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('writes the cookie for a lab the user is a member of', async () => {
    cookieStore.set.mockClear();
    await setActiveLabAction(memberLabId);
    expect(cookieStore.set).toHaveBeenCalledWith(
      'active_lab_id',
      memberLabId,
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('silently does nothing for a lab the user is not a member of', async () => {
    cookieStore.set.mockClear();
    await setActiveLabAction(outsideLabId);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it('silently does nothing with no session', async () => {
    getSession.mockResolvedValueOnce(null);
    cookieStore.set.mockClear();
    await setActiveLabAction(memberLabId);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});
