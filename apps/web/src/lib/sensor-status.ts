/**
 * Environment sensor freshness (implementation.md §10 P10: "sensor status:
 * live / stale (> 2 min) / offline"). Pure function of "how long ago was
 * the last reading" so the client can recompute it every few seconds
 * without a round trip, and the acceptance criterion ("stopping the
 * simulator shows 'Sensor offline' within 2 min") is a single threshold
 * check, not a guess.
 *
 * `scripts/sim-env.ts` posts every 10 s (§10 P10), so `LIVE` allows a couple
 * of missed beats before dropping to `STALE`, and `STALE` extends to the
 * exact 2-minute mark the acceptance criterion names — past that, `OFFLINE`.
 */
export const SENSOR_LIVE_MS = 30_000;
export const SENSOR_OFFLINE_MS = 120_000;

export type SensorStatus = 'live' | 'stale' | 'offline' | 'unknown';

/** `lastReadingAt: null` means no reading has ever arrived — reported as `unknown`, not `offline`, since offline implies "went quiet", not "never connected". */
export function deriveSensorStatus(
  lastReadingAt: Date | null,
  now: Date = new Date(),
): SensorStatus {
  if (!lastReadingAt) return 'unknown';
  const ageMs = now.getTime() - lastReadingAt.getTime();
  if (ageMs <= SENSOR_LIVE_MS) return 'live';
  if (ageMs <= SENSOR_OFFLINE_MS) return 'stale';
  return 'offline';
}
