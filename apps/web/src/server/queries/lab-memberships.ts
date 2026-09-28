import { labMembers, labs } from '@tula/db';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';

export interface LabMembership {
  id: string;
  code: string;
  name: string;
}

/** Every lab the user belongs to (implementation.md §5 `lab_members`), for the topbar's lab switcher. */
export async function getLabMemberships(userId: string): Promise<LabMembership[]> {
  const rows = await db
    .select({ id: labs.id, code: labs.code, name: labs.name })
    .from(labMembers)
    .innerJoin(labs, eq(labMembers.labId, labs.id))
    .where(eq(labMembers.userId, userId))
    .orderBy(labs.name);
  return rows;
}
