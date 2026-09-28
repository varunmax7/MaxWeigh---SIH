import { cookies } from 'next/headers';

export const ACTIVE_LAB_COOKIE = 'active_lab_id';

/** Reads the visitor's chosen lab, if any (set by the topbar's lab switcher). Server-only. */
export async function getActiveLabId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_LAB_COOKIE)?.value ?? null;
}
