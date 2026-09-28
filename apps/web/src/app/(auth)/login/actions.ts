'use server';

import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/routes';
import { auth } from '@/server/auth';

/**
 * Better Auth's declared return type for `/sign-in/email` does not include
 * `twoFactorRedirect` — that field is added at runtime by the `twoFactor`
 * plugin hooking into this same endpoint's response, which its static types
 * do not model. See implementation.md §9 ("TOTP mandatory for …").
 */
type SignInEmailResult = { twoFactorRedirect: true } | { redirect: boolean; token: string };

export async function signInAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect(`${ROUTES.login}?error=missing`);
  }

  let result: SignInEmailResult;
  try {
    result = (await auth.api.signInEmail({
      body: { email, password },
      headers: await nextHeaders(),
    })) as SignInEmailResult;
  } catch {
    redirect(`${ROUTES.login}?error=invalid`);
  }

  if ('twoFactorRedirect' in result && result.twoFactorRedirect) {
    redirect(ROUTES.verifyTwoFactor);
  }

  redirect(ROUTES.dashboard);
}
