/**
 * Thumbnail generation (implementation.md §2, §9 P4: "thumbnails separate").
 * Only images are enqueued (the web app skips PDFs); the original stays
 * immutable — this only ever writes a new `thumb_key`, never touches the
 * original object or row beyond that one column.
 */
import { attachments, type Db } from '@tula/db';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { logger } from '../logger.js';
import type { Storage } from '../storage.js';

const THUMB_WIDTH_PX = 400;

export interface ThumbMakePayload {
  attachmentId: string;
  storageKey: string;
  mime: string;
}

export function makeThumbMake(db: Db, storage: Storage) {
  return async function thumbMake(jobs: { data: ThumbMakePayload }[]): Promise<void> {
    for (const job of jobs) {
      const { attachmentId, storageKey } = job.data;
      const original = await storage.getObject(storageKey);
      const thumbnail = await sharp(original)
        .resize({ width: THUMB_WIDTH_PX, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const thumbKey = `${storageKey}.thumb.webp`;
      await storage.putObject(thumbKey, thumbnail, 'image/webp');

      await db.update(attachments).set({ thumbKey }).where(eq(attachments.id, attachmentId));

      logger.info({ attachmentId, thumbKey }, 'thumbnail generated');
    }
  };
}
