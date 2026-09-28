/**
 * Session reads for Server Components and Server Actions (implementation.md
 * §5, §9).
 *
 * Better Auth's own `session.expiresIn`/`updateAge` pair (see
 * `@tula/db`'s `buildAuthOptions`) gives the 30-minute idle timeout as a
 * native sliding window. It has no separate primitive for an 8-hour
 * *absolute* cap on top of that, so this module enforces the second half:
 * a session whose `createdAt` (set once, never refreshed) is older than
 * `SESSION_ABSOLUTE_SECONDS` is revoked and treated as signed out, even
 * though continuous activity would otherwise have kept it alive forever.
 */
import { ROLES, type Role, SESSION_ABSOLUTE_SECONDS } from '@tula/db';
import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { ENTRY_ROUTE } from '@/lib/routes';
// The `@/` alias — see the comment in server/auth.ts on why a relative
// import here can fail to resolve under Turbopack (Next 16.3.6).
import { auth } from '@/server/auth';

type RawSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  designation: string | null;
  employeeId: string | null;
  isActive: boolean;
  twoFactorEnabled: boolean;
}

export interface AppSession {
  session: RawSession['session'];
  user: AppUser;
}

/**
 * Better Auth types `role` as the plain `string` its field config declared
 * (`additionalFields.role.type = 'string'`) — it has no way to know about our
 * literal `Role` union. This re-validates against that union at the one
 * place a raw session becomes an `AppSession`, rather than casting blindly.
 */
function toAppUser(raw: RawSession['user']): AppUser {
  const candidate = (raw as { role?: unknown }).role;
  if (typeof candidate !== 'string' || !(ROLES as readonly string[]).includes(candidate)) {
    throw new Error(`user ${raw.id} has an unrecognised role: ${String(candidate)}`);
  }
  const extra = raw as unknown as {
    designation?: string | null;
    employeeId?: string | null;
    isActive?: boolean;
    twoFactorEnabled?: boolean;
  };
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role: candidate as Role,
    designation: extra.designation ?? null,
    employeeId: extra.employeeId ?? null,
    isActive: extra.isActive ?? true,
    twoFactorEnabled: extra.twoFactorEnabled ?? false,
  };
}

/** Returns the current session, or `null` if there is none, it is stale, or the account is deactivated. */
export async function getSession(): Promise<AppSession | null> {
  const requestHeaders = await nextHeaders();
  const result = await auth.api.getSession({ headers: requestHeaders });
  if (!result) return null;

  const ageSeconds = (Date.now() - result.session.createdAt.getTime()) / 1000;
  if (ageSeconds > SESSION_ABSOLUTE_SECONDS) {
    await auth.api.revokeSession({
      headers: requestHeaders,
      body: { token: result.session.token },
    });
    return null;
  }

  const user = toAppUser(result.user);
  if (!user.isActive) return null;

  return { session: result.session, user };
}

/** Redirects to `/login` when there is no valid session; otherwise returns it. */
export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) redirect(ENTRY_ROUTE);
  return session;
}
