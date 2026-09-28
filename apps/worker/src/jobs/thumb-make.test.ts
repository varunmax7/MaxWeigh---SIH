import type { Db } from '@tula/db';
import { describe, expect, it, vi } from 'vitest';
import type { Storage } from '../storage.js';
import { makeThumbMake } from './thumb-make.js';

// A real 1x1 transparent PNG — exercises the actual `sharp` resize/webp
// pipeline (implementation.md §9 P4: "thumbnails separate") rather than
// mocking it away, since a fake buffer would just make `sharp` throw.
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('makeThumbMake', () => {
  it('resizes the original, puts a webp thumbnail and records thumb_key', async () => {
    const getObject = vi.fn().mockResolvedValue(ONE_PIXEL_PNG);
    const putObject = vi.fn().mockResolvedValue(undefined);
    const storage = { getObject, putObject } as unknown as Storage;

    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const db = { update } as unknown as Db;

    const thumbMake = makeThumbMake(db, storage);
    await thumbMake([
      { data: { attachmentId: 'a1', storageKey: 'attachments/a1/photo.png', mime: 'image/png' } },
    ]);

    expect(getObject).toHaveBeenCalledWith('attachments/a1/photo.png');

    expect(putObject).toHaveBeenCalledTimes(1);
    const [thumbKey, thumbBuffer, contentType] = putObject.mock.calls[0] as [
      string,
      Buffer,
      string,
    ];
    expect(thumbKey).toBe('attachments/a1/photo.png.thumb.webp');
    expect(contentType).toBe('image/webp');
    // A real WebP-encoded buffer, not a pass-through of the PNG input.
    expect(thumbBuffer.subarray(8, 12).toString('ascii')).toBe('WEBP');

    expect(set).toHaveBeenCalledWith({ thumbKey: 'attachments/a1/photo.png.thumb.webp' });
    expect(where).toHaveBeenCalledTimes(1);
  });
});
