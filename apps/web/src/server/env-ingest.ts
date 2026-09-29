/**
 * Device-key authentication and rate limiting for `POST /api/v1/env/readings`
 * (implementation.md §10 P10). Not a Route Handler itself — see
 * `apps/web/src/app/api/v1/env/readings/route.ts` — because the same
 * device-key hashing scheme also needs to be exercised from unit tests
 * without spinning up a request.
 *
 * Rate limiting is DB-backed rather than an in-memory token bucket: it
 * rejects a reading if the same sensor already has one within
 * `MIN_INTERVAL_MS`, checked against `env_readings` itself (see
 * `getLastReadingTsForSensor`). That survives a multi-instance deployment
 * for free (no shared cache needed) — the honest limitation is that it
 * only throttles *this* endpoint's write rate per device key, not a
 * general per-IP abuse limiter; a broader one is P11 scope (docs/QUESTIONS.md #38).
 */
import { createHash } from 'node:crypto';
import { envSensors } from '@tula/db';
import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { getLastReadingTsForSensor } from '@/server/queries/sensors';

/** A real sensor is expected to post every ~10s (`scripts/sim-env.ts`); anything faster than this is rejected. */
export const MIN_INGEST_INTERVAL_MS = 2_000;

export function hashDeviceKey(deviceKey: string): string {
  return createHash('sha256').update(deviceKey).digest('hex');
}

export interface AuthenticatedSensor {
  sensorId: string;
  labId: string;
}

/** Resolves a bearer device key to its active sensor, or `null` if it doesn't match one. */
export async function resolveDeviceKey(deviceKey: string): Promise<AuthenticatedSensor | null> {
  const [row] = await db
    .select({ id: envSensors.id, labId: envSensors.labId })
    .from(envSensors)
    .where(
      and(eq(envSensors.deviceKeyHash, hashDeviceKey(deviceKey)), eq(envSensors.status, 'active')),
    );
  if (!row) return null;
  return { sensorId: row.id, labId: row.labId };
}

/** `true` if `sensorId` may write another reading right now. */
export async function checkIngestRateLimit(sensorId: string): Promise<boolean> {
  const lastTs = await getLastReadingTsForSensor(sensorId);
  if (!lastTs) return true;
  return Date.now() - lastTs.getTime() >= MIN_INGEST_INTERVAL_MS;
}

/** Extracts `Bearer <key>` from an Authorization header, or `null`. */
export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header.trim());
  return match?.[1] ?? null;
}
