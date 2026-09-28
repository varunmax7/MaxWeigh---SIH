/** S3-compatible object storage (implementation.md §2, §9) — mirrors apps/web/src/server/storage.ts. */

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Env } from '@tula/config';

export function createStorage(config: Env) {
  const s3 = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY,
      secretAccessKey: config.S3_SECRET_KEY,
    },
  });

  return {
    async getObject(key: string): Promise<Buffer> {
      const result = await s3.send(new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) throw new Error(`empty object body for key ${key}`);
      return Buffer.from(bytes);
    },
    async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
      await s3.send(
        new PutObjectCommand({
          Bucket: config.S3_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },
  };
}

export type Storage = ReturnType<typeof createStorage>;
