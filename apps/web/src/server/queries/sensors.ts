/**
 * Read queries for environment sensor readings (implementation.md §5
 * `env_readings`, §10 P10). Every query is scoped to a `labId` (§11) —
 * readings themselves carry `lab_id` directly (denormalized from the
 * sensor at ingest time), so no join is needed to enforce that.
 */
import { envReadings, envSensors } from '@tula/db';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/server/db';

export interface LatestEnvReading {
  sensorId: string;
  hubCode: string;
  tempC: string;
  rhPct: string;
  pressureHpa: string;
  ts: Date;
}

/** The most recent reading from any active sensor in `labId`, if any. */
export async function getLatestEnvReading(labId: string): Promise<LatestEnvReading | null> {
  const [row] = await db
    .select({
      sensorId: envReadings.sensorId,
      hubCode: envSensors.hubCode,
      tempC: envReadings.tempC,
      rhPct: envReadings.rhPct,
      pressureHpa: envReadings.pressureHpa,
      ts: envReadings.ts,
    })
    .from(envReadings)
    .innerJoin(envSensors, eq(envReadings.sensorId, envSensors.id))
    .where(and(eq(envReadings.labId, labId), eq(envSensors.status, 'active')))
    .orderBy(desc(envReadings.ts))
    .limit(1);
  return row ?? null;
}

/** The timestamp of the sensor's own most recent reading — used to rate-limit ingest (see `apps/web/src/server/env-ingest.ts`). */
export async function getLastReadingTsForSensor(sensorId: string): Promise<Date | null> {
  const [row] = await db
    .select({ ts: envReadings.ts })
    .from(envReadings)
    .where(eq(envReadings.sensorId, sensorId))
    .orderBy(desc(envReadings.ts))
    .limit(1);
  return row?.ts ?? null;
}

/** Every reading stored for `labId` between two timestamps — feeds `computeEnvStability` for a completed test's duration. */
export async function listEnvReadingsBetween(
  labId: string,
  fromTs: Date,
  toTs: Date,
): Promise<{ tempC: string; rhPct: string; ts: Date }[]> {
  return db
    .select({ tempC: envReadings.tempC, rhPct: envReadings.rhPct, ts: envReadings.ts })
    .from(envReadings)
    .where(
      and(eq(envReadings.labId, labId), gte(envReadings.ts, fromTs), lte(envReadings.ts, toTs)),
    )
    .orderBy(envReadings.ts);
}
