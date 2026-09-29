/**
 * The short-lived signed token that gates `/print/reports/[versionId]`
 * (implementation.md §8.2). Mirrors `apps/worker/src/print-token.ts` byte
 * for byte — kept in sync by hand, the same reason `server/queues.ts`
 * mirrors the worker's queue names: an app isn't a workspace package
 * another app can import from, and this is a dozen lines, not a package.
 *
 * Two callers mint one: the worker (before fetching the route to capture a
 * PDF) and this app itself (before embedding the route in an `<iframe>` for
 * the Report view's live preview — §7.5 "same print route the PDF uses").
 * Both verify against the identical `PRINT_TOKEN_SECRET`, so either token
 * works at the route regardless of who minted it.
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
