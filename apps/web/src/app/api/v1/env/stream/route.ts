/**
 * `GET /api/v1/env/stream?lab=<labId>` (implementation.md §10 P10) — an SSE
 * stream of the lab's latest environment reading, polled from `env_readings`
 * every `POLL_INTERVAL_MS`. Session-authenticated (a signed-in lab member),
 * unlike the device-keyed ingest route — this is read by the workspace UI,
 * not a sensor.
 *
 * No precedent for SSE existed in this codebase before P10 (`NotificationBell`
 * polls client-side every 30s instead) — this is genuinely a new pattern,
 * chosen because implementation.md's task list names it explicitly ("`GET
 * /api/v1/env/stream?lab=` (SSE)"), not a poll. Polling `env_readings`
 * server-side inside the stream (rather than LISTEN/NOTIFY) keeps this
 * consistent with every other "live" read in the app being a plain query.
 */
import { labMembers } from '@tula/db';
import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { getLatestEnvReading } from '@/server/queries/sensors';
import { getSession } from '@/server/session';

const POLL_INTERVAL_MS = 2_000;
const HEARTBEAT_EVERY = 15;

async function isLabMember(userId: string, labId: string): Promise<boolean> {
  const [membership] = await db
    .select({ userId: labMembers.userId })
    .from(labMembers)
    .where(and(eq(labMembers.userId, userId), eq(labMembers.labId, labId)));
  return Boolean(membership);
}

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return new Response('Forbidden', { status: 403 });
  }

  const labId = new URL(request.url).searchParams.get('lab');
  if (!labId) {
    return new Response('Missing lab', { status: 400 });
  }
  if (!(await isLabMember(session.user.id, labId))) {
    return new Response('Forbidden', { status: 403 });
  }

  let lastSensorId: string | null = null;
  let lastTs: string | null = null;
  let ticks = 0;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const tick = async () => {
        if (closed) return;
        try {
          const reading = await getLatestEnvReading(labId);
          if (reading && reading.ts.toISOString() !== lastTs) {
            lastSensorId = reading.sensorId;
            lastTs = reading.ts.toISOString();
            send('reading', {
              sensorId: reading.sensorId,
              hubCode: reading.hubCode,
              tempC: Number(reading.tempC),
              rhPct: Number(reading.rhPct),
              pressureHpa: Number(reading.pressureHpa),
              ts: lastTs,
            });
          } else {
            ticks += 1;
            if (ticks % HEARTBEAT_EVERY === 0) send('heartbeat', { lastSensorId });
          }
        } catch {
          // A transient query failure shouldn't kill the stream — the next
          // tick tries again; the client's own staleness check (§10 P10's
          // live/stale/offline derivation) already covers "no data for a
          // while" without this route needing to distinguish the reason.
        }
      };

      await tick();
      const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);

      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
