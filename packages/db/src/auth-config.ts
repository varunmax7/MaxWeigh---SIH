/**
 * Shared Better Auth configuration (implementation.md §5, §6.1, §9).
 *
 * `apps/web/src/server/auth.ts` builds the real server instance from this;
 * `seed.ts` builds a throwaway instance sharing the same database so seeded
 * users get properly hashed passwords through Better Auth's own sign-up path
 * instead of a hand-rolled hash. Keeping the shape here (not duplicated in
 * both places) is what keeps them from drifting apart.
 */
import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';
import type { Db } from './client.js';
import {
  account,
  rateLimit,
  session,
  twoFactor as twoFactorTable,
  user,
  verification,
} from './schema/auth.js';

export interface AuthConfigDeps {
  db: Db;
  secret: string;
  baseURL: string;
  trustedOrigins?: string[];
}

/** Idle session timeout (implementation.md §9): 30 minutes of inactivity ends the session. */
export const SESSION_IDLE_SECONDS = 30 * 60;

/**
 * Absolute session lifetime (implementation.md §9): 8 hours from login, even
 * with continuous activity. Better Auth's own `session.expiresIn`/`updateAge`
 * pair only expresses a single sliding window, so this cap is enforced
 * separately in `apps/web/src/server/session.ts`, which compares the
 * session's `createdAt` (set once, never refreshed) against this constant.
 * See docs/QUESTIONS.md.
 */
export const SESSION_ABSOLUTE_SECONDS = 8 * 60 * 60;

/** Step-up window (implementation.md §9): tier approvals/seal/revoke need a TOTP code no older than this. */
export const SESSION_FRESH_SECONDS = 5 * 60;

export function buildAuthOptions(deps: AuthConfigDeps) {
  return {
    database: drizzleAdapter(deps.db, {
      provider: 'pg',
      schema: { user, session, account, verification, twoFactor: twoFactorTable, rateLimit },
    }),
    secret: deps.secret,
    baseURL: deps.baseURL,
    trustedOrigins: deps.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      // No public self-service reset: resets are admin-initiated (implementation.md §9).
    },
    user: {
      additionalFields: {
        role: { type: 'string', required: true, input: true },
        designation: { type: 'string', required: false, input: true },
        employeeId: { type: 'string', required: false, input: true },
        isActive: { type: 'boolean', required: false, defaultValue: true, input: false },
      },
    },
    session: {
      expiresIn: SESSION_IDLE_SECONDS,
      updateAge: 0,
      freshAge: SESSION_FRESH_SECONDS,
    },
    advanced: {
      database: {
        // The uuid_generate_v7() column default mints the id; Better Auth must not generate one itself.
        generateId: false,
      },
    },
    plugins: [twoFactor({ issuer: 'Tula' })],
  } satisfies BetterAuthOptions;
}
