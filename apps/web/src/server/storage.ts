/**
 * S3-compatible object storage (implementation.md §2, §9). One client for
 * the whole process; `forcePathStyle` is required for SeaweedFS/MinIO-style
 * endpoints, which don't support virtual-hosted-style bucket addressing.
 */

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@tula/config';

const config = env();

export const s3 = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY,
    secretAccessKey: config.S3_SECRET_KEY,
  },
});

/** Uploads a private object. There is no public-read path (implementation.md §9: "Private bucket"). */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** A short-lived GET URL — implementation.md §9: "presigned GET URLs, 5 min TTL, issued only after permission check". */
export async function presignGetUrl(key: string, ttlSeconds = 300): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }), {
    expiresIn: ttlSeconds,
  });
}
