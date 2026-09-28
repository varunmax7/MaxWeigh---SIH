'use server';

import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/routes';
import { auth } from '@/server/auth';

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await nextHeaders() });
  redirect(ROUTES.login);
}
