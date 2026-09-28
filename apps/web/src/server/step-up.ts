/**
 * Step-up authentication (implementation.md §9): a tier decision, a seal and
 * a revocation each need a *fresh* TOTP code, not just a live session.
 *
 * Better Auth's `verifyTOTP` endpoint behaves differently depending on
 * whether a session cookie is present: with no session it is the second leg
 * of sign-in and mints one, while with a session it does nothing but check
 * the code against the enrolled secret. This module only ever calls it in the
 * second mode, so verifying a step-up never touches the session.
 *
 * It is a module of its own rather than inlined into the review actions so
 * that `actions/review.test.ts` can exercise the workflow against a real
 * database without enrolling an authenticator, while `step-up.test.ts` pins
 * the verification behaviour itself.
 */
import { headers as nextHeaders } from 'next/headers';
import { ActionError } from '@/server/action';
// The `@/` alias — see the comment in server/auth.ts on why a relative
// import here can fail to resolve under Turbopack (Next 16.3.6).
import { auth } from '@/server/auth';

/**
 * Throws `ActionError('FORBIDDEN', …)` unless `code` is the current TOTP for
 * the signed-in user. Any failure — a wrong code, a user with no
 * authenticator enrolled, a locked account — is one refusal to the caller:
 * the reason is in the audit ledger's denial entry, not in a response that
 * would tell an attacker which of those it was.
 */
export async function assertStepUp(code: string): Promise<void> {
  try {
    await auth.api.verifyTOTP({ body: { code }, headers: await nextHeaders() });
  } catch {
    throw new ActionError(
      'FORBIDDEN',
      'That code was not accepted. Open your authenticator app and enter the current 6-digit code.',
    );
  }
}
