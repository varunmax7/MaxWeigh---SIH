#!/usr/bin/env tsx
/**
 * Environment sensor simulator (implementation.md §10 P10: "posting
 * realistic readings every 10 s with slow drift"). Posts real HTTP requests
 * to `POST /api/v1/env/readings` against a running dev server — exercising
 * the real device-key auth and rate limit, not a DB shortcut — so this is
 * as close to a real sensor hub as this environment can get without actual
 * hardware.
 *
 * On first run for a given lab, registers a new `env_sensors` row directly
 * (the same insert `registerEnvSensorAction` does) and caches its device
 * key at `tmp/sim-env-<labCode>.json` (gitignored) so re-runs reuse the
 * same sensor instead of accumulating one per run.
 *
 * Run: `pnpm tsx scripts/sim-env.ts [--lab RRSL-BLR] [--interval-ms 10000]`
 * Stop with Ctrl+C — implementation.md's acceptance criterion is that the
 * workspace shows "Sensor offline" within 2 minutes of that.
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, loadRootEnv } from '@tula/config';
import { createDb, envSensors, labs } from '@tula/db';
import { eq } from 'drizzle-orm';

loadRootEnv();
const config = env();
const { db, sql } = createDb(config.DATABASE_URL);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function argValue(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1] as string;
}

const labCode = argValue('--lab', 'RRSL-BLR');
const intervalMs = Number(argValue('--interval-ms', '10000'));
const stateFile = join(repoRoot, 'tmp', `sim-env-${labCode}.json`);

interface State {
  sensorId: string;
  deviceKey: string;
}

function loadState(): State | null {
  if (!existsSync(stateFile)) return null;
  return JSON.parse(readFileSync(stateFile, 'utf8')) as State;
}

function saveState(state: State): void {
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

async function ensureSensor(): Promise<State> {
  const cached = loadState();
  if (cached) {
    const [row] = await db
      .select({ id: envSensors.id })
      .from(envSensors)
      .where(eq(envSensors.id, cached.sensorId));
    if (row) return cached;
    console.info('Cached sensor no longer exists — registering a new one.');
  }

  const [lab] = await db.select({ id: labs.id }).from(labs).where(eq(labs.code, labCode));
  if (!lab) throw new Error(`Lab ${labCode} not found — run pnpm db:seed first.`);

  const deviceKey = randomBytes(32).toString('base64url');
  const deviceKeyHash = createHash('sha256').update(deviceKey).digest('hex');
  const [sensor] = await db
    .insert(envSensors)
    .values({ labId: lab.id, hubCode: `SIM-${labCode}`, deviceKeyHash })
    .returning({ id: envSensors.id });
  if (!sensor) throw new Error('env_sensors insert returned no row');

  const state: State = { sensorId: sensor.id, deviceKey };
  saveState(state);
  console.info(`Registered simulator sensor ${sensor.id} for ${labCode}.`);
  return state;
}

/** A slow random walk, clamped to a realistic indoor lab range. */
function drift(current: number, step: number, min: number, max: number): number {
  const next = current + (Math.random() - 0.5) * 2 * step;
  return Math.min(max, Math.max(min, next));
}

async function main() {
  const state = await ensureSensor();
  console.info(
    `Posting to ${config.APP_URL}/api/v1/env/readings every ${intervalMs}ms. Ctrl+C to stop.`,
  );

  let tempC = 22.3;
  let rhPct = 54.0;
  let pressureHpa = 1013.2;

  const tick = async () => {
    tempC = drift(tempC, 0.05, 15, 30);
    rhPct = drift(rhPct, 0.3, 30, 70);
    pressureHpa = drift(pressureHpa, 0.1, 990, 1030);

    try {
      const response = await fetch(`${config.APP_URL}/api/v1/env/readings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${state.deviceKey}` },
        body: JSON.stringify({
          tempC: Number(tempC.toFixed(2)),
          rhPct: Number(rhPct.toFixed(2)),
          pressureHpa: Number(pressureHpa.toFixed(1)),
        }),
      });
      if (!response.ok) {
        console.error(`Ingest rejected (${response.status}): ${await response.text()}`);
      } else {
        console.info(
          `Posted ${tempC.toFixed(1)}°C ${rhPct.toFixed(0)}% RH ${pressureHpa.toFixed(1)} hPa`,
        );
      }
    } catch (error) {
      console.error('Could not reach the dev server — is it running?', error);
    }
  };

  await tick();
  const interval = setInterval(() => void tick(), intervalMs);

  process.on('SIGINT', async () => {
    clearInterval(interval);
    await sql.end();
    process.exit(0);
  });
}

void main();
