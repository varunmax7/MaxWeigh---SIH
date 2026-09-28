'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { ACTIVE_LAB_COOKIE } from '@/server/active-lab';

/** Sets the active lab (implementation.md §7.4: "Every query is scoped to the active lab"). */
export async function setActiveLabAction(labId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_LAB_COOKIE, labId, { httpOnly: true, sameSite: 'lax', path: '/' });
  revalidatePath('/', 'layout');
}
