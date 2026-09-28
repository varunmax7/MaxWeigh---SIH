/**
 * The server's Better Auth instance (implementation.md §5, §6.1, §9).
 *
 * `@tula/db`'s `buildAuthOptions` supplies everything shared with the seed
 * script (schema wiring, session policy, the `role`/`designation`/
 * `employee_id`/`is_active` user fields, the TOTP plugin); `nextCookies()` is
 * added here because it is specific to calling `auth.api.*` from Next.js
 * Server Actions.
 */
import { env } from '@tula/config';
import { buildAuthOptions } from '@tula/db';
import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
// The `@/` alias, not a relative `./db.js` — Turbopack's module resolution
// (Next 16.3.6) fails to resolve a relative sibling import from a file that
// is compiled into more than one layer (this one is both a Route Handler,
// via api/auth/[...all], and a Server Action dependency, via the (auth)
// pages), even though the same relative import works from a single-layer
// file. The path alias sidesteps whatever cache keys on. See docs/QUESTIONS.md.
import { db } from '@/server/db';

const config = env();

const options = buildAuthOptions({
  db,
  secret: config.AUTH_SECRET,
  baseURL: config.APP_URL,
});

export const auth = betterAuth({
  ...options,
  plugins: [...options.plugins, nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
