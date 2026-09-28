import { createHash } from 'node:crypto';
import { attachments, evaluations, evaluationTests, insertAuditEntry, labMembers } from '@tula/db';
import { and, eq } from 'drizzle-orm';
import { fileTypeFromBuffer } from 'file-type';
import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { enqueue } from '@/server/jobs';
import { QUEUES } from '@/server/queues';
import { can } from '@/server/rbac';
import { getSession } from '@/server/session';
import { putObject } from '@/server/storage';

/** implementation.md §9: "≤ 20 MB". */
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

/** implementation.md §9: "allowlist JPEG/PNG/WebP/PDF". */
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const UPLOAD_KIND_PERMISSION = {
  calibration_cert: 'standards.manage',
  lab_logo: 'settings.manage',
  photo: 'test.execute',
  document: 'test.execute',
} as const;

/** `photo`/`document` (P6): evidence tied to a test, scoped to the evaluation's lab. */
const TEST_SCOPED_KINDS = new Set(['photo', 'document']);

/**
 * Looks up the lab a `photo`/`document` upload's `testId` belongs to, and
 * confirms the uploader is a member of it — the same lab-scope guarantee
 * `action()`'s `assertLabAccess` gives server actions (implementation.md
 * §11: "every read/write query is scoped to the user's labs"), replicated
 * here by hand because a Route Handler doesn't go through that wrapper.
 */
async function resolveTestScope(
  testId: unknown,
  userId: string,
): Promise<{ evaluationId: string } | { error: NextResponse }> {
  if (typeof testId !== 'string') {
    return { error: NextResponse.json({ ok: false, code: 'VALIDATION' }, { status: 400 }) };
  }
  const [row] = await db
    .select({ evaluationId: evaluationTests.evaluationId, labId: evaluations.labId })
    .from(evaluationTests)
    .innerJoin(evaluations, eq(evaluationTests.evaluationId, evaluations.id))
    .where(eq(evaluationTests.id, testId));
  if (!row) {
    return { error: NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 }) };
  }
  const [membership] = await db
    .select({ userId: labMembers.userId })
    .from(labMembers)
    .where(and(eq(labMembers.userId, userId), eq(labMembers.labId, row.labId)));
  if (!membership) {
    return { error: NextResponse.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 }) };
  }
  return { evaluationId: row.evaluationId };
}

/**
 * File upload (implementation.md §9, §10 P4/P6). `calibration_cert` (P4:
 * reference weight sets' certificate) and `lab_logo` (P4: lab settings) are
 * not tied to an evaluation; `photo`/`document` (P6: test evidence) require
 * `testId` and are lab-scoped through it. `other` stays unhandled — no
 * phase has defined who may upload it or what it attaches to.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const kind = form.get('kind');
  const caption = form.get('caption');
  const testId = form.get('testId');

  if (!(file instanceof File) || typeof kind !== 'string') {
    return NextResponse.json({ ok: false, code: 'VALIDATION' }, { status: 400 });
  }

  const permission = UPLOAD_KIND_PERMISSION[kind as keyof typeof UPLOAD_KIND_PERMISSION];
  if (!permission) {
    return NextResponse.json(
      { ok: false, code: 'VALIDATION', issue: 'unsupported kind' },
      { status: 400 },
    );
  }
  if (!can(session.user.role, permission)) {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 });
  }

  let evaluationId: string | null = null;
  if (TEST_SCOPED_KINDS.has(kind)) {
    const scope = await resolveTestScope(testId, session.user.id);
    if ('error' in scope) return scope.error;
    evaluationId = scope.evaluationId;
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { ok: false, code: 'VALIDATION', issue: 'file too large' },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Magic-byte check (implementation.md §9) — the declared MIME type from
  // the browser is never trusted on its own.
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    return NextResponse.json(
      { ok: false, code: 'VALIDATION', issue: 'file type not allowed' },
      { status: 400 },
    );
  }

  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const storageKey = `attachments/${crypto.randomUUID()}/${file.name}`;

  await putObject(storageKey, buffer, detected.mime);

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(attachments)
      .values({
        evaluationId,
        testId: typeof testId === 'string' ? testId : null,
        kind,
        caption: typeof caption === 'string' && caption ? caption : null,
        filename: file.name,
        mime: detected.mime,
        sizeBytes: file.size,
        storageKey,
        sha256,
        uploadedBy: session.user.id,
      })
      .returning({ id: attachments.id });

    if (!row) throw new Error('attachments insert returned no row');

    await insertAuditEntry(tx, {
      actorId: session.user.id,
      actorRole: session.user.role,
      labId: null,
      action: 'attachment.upload',
      entityType: 'attachment',
      entityId: row.id,
      diff: { kind, filename: file.name, sizeBytes: file.size, sha256 },
      ip: null,
      userAgent: null,
    });

    return row;
  });

  // Thumbnails only make sense for images (implementation.md §9: "thumbnails separate").
  if (detected.mime.startsWith('image/')) {
    await enqueue(QUEUES.thumbMake, { attachmentId: result.id, storageKey, mime: detected.mime });
  }

  return NextResponse.json({ ok: true, data: { id: result.id, sha256 } });
}
