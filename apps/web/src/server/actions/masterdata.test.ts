import {
  auditLog,
  envSensors,
  instrumentModels,
  labs,
  manufacturers,
  user as userTable,
} from '@tula/db';
import type { InstrumentMetrology } from '@tula/engine';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AppSession } from '@/server/session';
import { db, sql } from '../db.js';

// A real ADMIN session, backed by the seeded RRSL-BLR admin user — not a
// blanket mock of `action()` itself, so permission checks, lab-membership
// checks and the audit-ledger write all run for real (implementation.md §10
// P4 acceptance: "An invalid spec shows engine issues... errors block
// saving", "Every mutation has an audit entry").
vi.mock('@/server/session', () => ({ getSession: vi.fn() }));

const { getSession } = await import('@/server/session');
const { createManufacturerAction, createInstrumentModelAction, registerEnvSensorAction } =
  await import('./masterdata.js');

let labId: string;
const createdManufacturerIds: string[] = [];
const createdInstrumentModelIds: string[] = [];
const createdEnvSensorIds: string[] = [];

const goldenSpec: InstrumentMetrology = {
  accuracyClass: 'III',
  kind: 'single',
  ranges: [{ max: '30000', e: '5', d: '5' }],
  min: '100',
  tempRange: { lowC: -10, highC: 40 },
  isElectronic: true,
  hasTareDevice: false,
  hasZeroTracking: false,
  loadReceptor: { kind: 'platform', supports: 4 },
  levelIndicator: true,
  tiltSusceptible: false,
  powerSupply: { mains: { vNom: 230, fNomHz: 50 } },
  displayUnit: 'g',
};

beforeAll(async () => {
  const [lab] = await db.select({ id: labs.id }).from(labs).where(eq(labs.code, 'RRSL-BLR'));
  if (!lab) throw new Error('seed data missing: run pnpm db:seed first');
  labId = lab.id;

  const [admin] = await db
    .select({ id: userTable.id, email: userTable.email, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.email, 'admin@tula.test'));
  if (!admin) throw new Error('seed data missing: admin@tula.test not found');

  const session: AppSession = {
    session: {} as AppSession['session'],
    user: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: 'ADMIN',
      designation: null,
      employeeId: null,
      isActive: true,
      twoFactorEnabled: false,
    },
  };
  vi.mocked(getSession).mockResolvedValue(session);
});

afterAll(async () => {
  if (createdInstrumentModelIds.length > 0) {
    for (const id of createdInstrumentModelIds) {
      await db.delete(instrumentModels).where(eq(instrumentModels.id, id));
    }
  }
  if (createdManufacturerIds.length > 0) {
    for (const id of createdManufacturerIds) {
      await db.delete(manufacturers).where(eq(manufacturers.id, id));
    }
  }
  if (createdEnvSensorIds.length > 0) {
    for (const id of createdEnvSensorIds) {
      await db.delete(envSensors).where(eq(envSensors.id, id));
    }
  }
  await sql.end();
});

describe('masterdata actions (real DB, real ADMIN session)', () => {
  it('creates a manufacturer and writes an audit entry', async () => {
    const result = await createManufacturerAction({ name: 'Test Manufacturer QA' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdManufacturerIds.push(result.data.id);

    const rows = await db
      .select({ diff: auditLog.diff })
      .from(auditLog)
      .where(eq(auditLog.action, 'manufacturer.create'));
    expect(rows.some((row) => (row.diff as { id?: string } | null)?.id === result.data.id)).toBe(
      true,
    );
  });

  it('rejects an instrument model whose spec has a blocking classification issue', async () => {
    const [mfr] = await db
      .insert(manufacturers)
      .values({ name: 'Test Manufacturer QA — invalid spec' })
      .returning({ id: manufacturers.id });
    if (!mfr) throw new Error('setup insert failed');
    createdManufacturerIds.push(mfr.id);

    // Min far below the class III floor of 20e = 100 g (Table 3) — a real
    // blocking classification issue, not a fabricated error path.
    const invalidSpec: InstrumentMetrology = { ...goldenSpec, min: '1' };

    const result = await createInstrumentModelAction({
      manufacturerId: mfr.id,
      modelName: 'Invalid Spec Model QA',
      instrumentType: 'bench',
      variantNames: [],
      defaultSpec: invalidSpec,
    });

    expect(result).toEqual({ ok: false, code: 'RULE' });

    const rows = await db
      .select({ id: instrumentModels.id })
      .from(instrumentModels)
      .where(eq(instrumentModels.modelName, 'Invalid Spec Model QA'));
    expect(rows).toHaveLength(0);
  });

  it('accepts an instrument model whose spec classifies cleanly', async () => {
    const [mfr] = await db
      .insert(manufacturers)
      .values({ name: 'Test Manufacturer QA — valid spec' })
      .returning({ id: manufacturers.id });
    if (!mfr) throw new Error('setup insert failed');
    createdManufacturerIds.push(mfr.id);

    const result = await createInstrumentModelAction({
      manufacturerId: mfr.id,
      modelName: 'Valid Spec Model QA',
      instrumentType: 'bench',
      variantNames: [],
      defaultSpec: goldenSpec,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdInstrumentModelIds.push(result.data.id);
  });

  it('registers an env sensor, returns the device key once, and never writes it to the audit log', async () => {
    const result = await registerEnvSensorAction({ labId, hubCode: `QA-HUB-${Date.now()}` });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdEnvSensorIds.push(result.data.id);
    expect(result.data.deviceKey).toMatch(/^[\w-]+$/);

    const rows = await db
      .select({ diff: auditLog.diff })
      .from(auditLog)
      .where(eq(auditLog.action, 'env_sensor.register'));
    const entry = rows.find((row) => (row.diff as { id?: string } | null)?.id === result.data.id);
    expect(entry).toBeDefined();
    expect(JSON.stringify(entry?.diff ?? {})).not.toContain(result.data.deviceKey);
  });
});
