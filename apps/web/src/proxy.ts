/**
 * Route protection for the `(app)` group (implementation.md §5, §9, §10 P2).
 *
 * Next 16 renamed `middleware.ts` to `proxy.ts`, but it is still the same
 * middleware runtime underneath (confirmed against the installed Next
 * source: `proxy.ts` compiles to the same `middleware.js` the Edge runtime
 * loads) — not a Node.js runtime as docs/QUESTIONS.md #3 had guessed. A
 * first attempt at calling `auth.api.getSession` here (a real Postgres round
 * trip) failed to even bundle, because that pulls in `postgres`/`node:tls`,
 * which the Edge runtime this file loads into cannot resolve.
 *
 * So this stays a cookie-presence check only — `getSessionCookie` reads and
 * verifies the signed cookie without touching the database — to redirect an
 * obviously signed-out visitor before any protected UI renders. It is not
 * the authoritative check: session validity, the 8-hour absolute cap, and
 * the mandatory-TOTP-enrolment redirect all happen in `(app)/layout.tsx`
 * and `requireSession()`, which run as Server Components in the Node.js
 * runtime and can reach Postgres.
 */
import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';
import { ROUTES } from '@/lib/routes';

const PUBLIC_PATHS = [ROUTES.login, ROUTES.verifyTwoFactor];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path) || getSessionCookie(request)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(ROUTES.login, request.url));
}

export const config = {
  matcher: [
    /*
     * Everything except: API routes, the public verify/print routes, the
     * dev-only component gallery (implementation.md §10 P3 — it 404s itself
     * in production), and Next's own static/asset paths.
     */
    '/((?!api|verify/|print/|dev/|_next/static|_next/image|favicon.ico).*)',
  ],
};
