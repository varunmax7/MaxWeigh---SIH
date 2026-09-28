import { createHash } from 'node:crypto';
import { attachments, insertAuditEntry } from '@tula/db';
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
} as const;

/**
 * File upload (implementation.md §9, §10 P4). Only `calibration_cert`
 * (reference weight sets' certificate) and `lab_logo` (lab settings) are
 * wired up in P4; `photo`/`document`/`other` — the evaluation-attachment
 * kinds — are P6 scope and rejected here until that phase defines who may
 * upload them.
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
        evaluationId: null,
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
