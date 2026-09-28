import { env } from '@tula/config';
import { NextResponse } from 'next/server';
import { sql } from '@/server/db';

interface CheckResult {
  status: 'ok' | 'error';
  error?: string;
}

async function checkDb(): Promise<CheckResult> {
  try {
    await sql`select 1`;
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : String(error) };
  }
}

/** Any response at all — even an unsigned-request 403 — proves the object store is reachable. */
async function checkS3(): Promise<CheckResult> {
  try {
    await fetch(env().S3_ENDPOINT, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : String(error) };
  }
}

/** implementation.md §10 P2: DB + S3 reachability, used by the deployment's own health probe. */
export async function GET(): Promise<NextResponse> {
  const [db, s3] = await Promise.all([checkDb(), checkS3()]);
  const healthy = db.status === 'ok' && s3.status === 'ok';

  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', checks: { db, s3 } },
    { status: healthy ? 200 : 503 },
  );
}
