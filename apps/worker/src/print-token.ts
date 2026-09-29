/**
 * Mints the short-lived signed token the worker uses to reach the print
 * route (implementation.md §8.2: "GET /print/reports/{versionId}?token=…
 * (short-lived signed token)"). Verified by `apps/web/src/server/
 * print-token.ts` — the same HMAC construction, kept in sync by hand for
 * the same reason `server/queues.ts` mirrors `worker/src/queues.ts`: an app
 * isn't a workspace package another app can import from.
 *
 * The token itself is the authorization — the print route has no session
 * to check — so it is scoped to one `versionId` and expires quickly (the
 * whole point of a 40-page render finishing in ≤ 10 s, per §8.2's
 * performance target, is that a wide window is never needed).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_SECONDS = 120;

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function mintPrintToken(
  secret: string,
  versionId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${versionId}.${expiresAt}`;
  return `${expiresAt}.${sign(secret, payload)}`;
}

/** Re-exported so a single worker-side test can pin both mint and verify against each other. */
export function verifyPrintToken(secret: string, versionId: string, token: string): boolean {
  const [expiresAtRaw, hmac] = token.split('.');
  if (!expiresAtRaw || !hmac) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;

  const expected = sign(secret, `${versionId}.${expiresAtRaw}`);
  const a = Buffer.from(hmac, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
