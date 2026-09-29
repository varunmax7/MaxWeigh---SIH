import { envReadings, envSensors, labs } from '@tula/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, sql } from './db.js';
import {
  checkIngestRateLimit,
  extractBearerToken,
  hashDeviceKey,
  MIN_INGEST_INTERVAL_MS,
  resolveDeviceKey,
} from './env-ingest.js';

describe('extractBearerToken', () => {
  it('extracts the token from a well-formed header', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
  });

  it('returns null for a missing or malformed header', () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken('Basic abc123')).toBeNull();
    expect(extractBearerToken('')).toBeNull();
  });
});

describe('hashDeviceKey', () => {
  it('is deterministic and never returns the plaintext', () => {
    const hash = hashDeviceKey('super-secret-key');
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain('super-secret-key');
    expect(hashDeviceKey('super-secret-key')).toBe(hash);
  });
});

describe('resolveDeviceKey / checkIngestRateLimit (real DB)', () => {
  let labId: string;
  let sensorId: string;
  const plaintextKey = 'test-device-key-p10';

  beforeAll(async () => {
    const [lab] = await db.select({ id: labs.id }).from(labs).where(eq(labs.code, 'RRSL-BLR'));
    if (!lab) throw new Error('seed data missing: run pnpm db:seed first');
    labId = lab.id;

    const [sensor] = await db
      .insert(envSensors)
      .values({ labId, hubCode: 'TEST-HUB-P10', deviceKeyHash: hashDeviceKey(plaintextKey) })
      .returning({ id: envSensors.id });
    if (!sensor) throw new Error('env_sensors insert returned no row');
    sensorId = sensor.id;
  });

  afterAll(async () => {
    await db.delete(envReadings).where(eq(envReadings.sensorId, sensorId));
    await db.delete(envSensors).where(eq(envSensors.id, sensorId));
    await sql.end();
  });

  it('resolves a valid device key to its sensor and lab', async () => {
    await expect(resolveDeviceKey(plaintextKey)).resolves.toEqual({ sensorId, labId });
  });

  it('resolves an unknown key to null', async () => {
    await expect(resolveDeviceKey('not-a-real-key')).resolves.toBeNull();
  });

  it('allows the first reading with no history', async () => {
    await expect(checkIngestRateLimit(sensorId)).resolves.toBe(true);
  });

  it('rejects a reading inside the minimum interval since the last one', async () => {
    await db.insert(envReadings).values({
      sensorId,
      labId,
      ts: new Date(),
      tempC: '22.00',
      rhPct: '54.00',
      pressureHpa: '1013.0',
    });

    await expect(checkIngestRateLimit(sensorId)).resolves.toBe(false);
  });

  it('allows a reading once the sensor has been quiet for the full interval', async () => {
    await db.delete(envReadings).where(eq(envReadings.sensorId, sensorId));
    await db.insert(envReadings).values({
      sensorId,
      labId,
      ts: new Date(Date.now() - MIN_INGEST_INTERVAL_MS - 500),
      tempC: '22.00',
      rhPct: '54.00',
      pressureHpa: '1013.0',
    });
    await expect(checkIngestRateLimit(sensorId)).resolves.toBe(true);
  });
});
