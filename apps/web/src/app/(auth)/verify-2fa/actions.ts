'use server';

import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/routes';
import { auth } from '@/server/auth';

export async function verifyTotpAction(formData: FormData): Promise<void> {
  const code = String(formData.get('code') ?? '').trim();
  if (!code) {
    redirect(`${ROUTES.verifyTwoFactor}?error=missing`);
  }

  try {
    await auth.api.verifyTOTP({ body: { code }, headers: await nextHeaders() });
  } catch {
    redirect(`${ROUTES.verifyTwoFactor}?error=invalid`);
  }

  redirect(ROUTES.dashboard);
}
