/**
 * `POST /api/v1/env/readings` (implementation.md §10 P10) — device-key
 * bearer auth, rate-limited. Not behind `action()`: the caller is a lab
 * device, not a signed-in user, so there is no session to check permission
 * or lab scope against — the device key itself *is* the lab scope
 * (implementation.md §11 pattern, replicated by hand the same way
 * `files/route.ts` does for its own non-`action()` route).
 */
import { envReadings, insertAuditEntry } from '@tula/db';
import { envReadingIngestSchema } from '@tula/schemas';
import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { checkIngestRateLimit, extractBearerToken, resolveDeviceKey } from '@/server/env-ingest';

export async function POST(request: Request): Promise<NextResponse> {
  const deviceKey = extractBearerToken(request.headers.get('authorization'));
  if (!deviceKey) {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN' }, { status: 401 });
  }

  const sensor = await resolveDeviceKey(deviceKey);
  if (!sensor) {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'VALIDATION' }, { status: 400 });
  }

  const parsed = envReadingIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: 'VALIDATION', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const allowed = await checkIngestRateLimit(sensor.sensorId);
  if (!allowed) {
    return NextResponse.json({ ok: false, code: 'RULE', issue: 'rate limited' }, { status: 429 });
  }

  const ts = parsed.data.ts ? new Date(parsed.data.ts) : new Date();

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(envReadings)
      .values({
        sensorId: sensor.sensorId,
        labId: sensor.labId,
        ts,
        tempC: parsed.data.tempC.toFixed(2),
        rhPct: parsed.data.rhPct.toFixed(2),
        pressureHpa: parsed.data.pressureHpa.toFixed(1),
      })
      .returning({ id: envReadings.id });
    if (!row) throw new Error('env_readings insert returned no row');

    await insertAuditEntry(tx, {
      actorId: null,
      actorRole: null,
      labId: sensor.labId,
      action: 'env_reading.ingest',
      entityType: 'env_sensor',
      entityId: sensor.sensorId,
      diff: { tempC: parsed.data.tempC, rhPct: parsed.data.rhPct },
      ip: null,
      userAgent: null,
    });

    return row;
  });

  return NextResponse.json({ ok: true, data: { id: result.id.toString() } });
}
