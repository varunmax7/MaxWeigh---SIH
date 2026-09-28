'use client';

import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listTestEvidenceAction } from '@/server/actions/execution';
import { FileDrop } from './FileDrop';

type Evidence = Awaited<ReturnType<typeof listTestEvidenceAction>>[number];

/** Evidence thumbnails + upload (implementation.md §7.5 Inspector panel: "Evidence  1 photo"). */
export function EvidenceGallery({
  testId,
  disabled = false,
}: {
  testId: string;
  disabled?: boolean;
}) {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setEvidence(await listTestEvidenceAction(testId));
    setLoading(false);
  };

  useEffect(() => {
    void listTestEvidenceAction(testId).then((rows) => {
      setEvidence(rows);
      setLoading(false);
    });
  }, [testId]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        Evidence {evidence.length > 0 ? `(${evidence.length})` : ''}
      </p>
      {!loading && evidence.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {evidence.map((item) => (
            <li key={item.id}>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-[var(--radius-control)] border border-border"
              >
                {item.mime.startsWith('image/') ? (
                  // biome-ignore lint/performance/noImgElement: presigned S3 URL, not a static asset next/image can optimize.
                  <img
                    src={item.thumbUrl ?? item.url}
                    alt={item.caption ?? item.filename}
                    className="aspect-square size-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-muted">
                    <FileText className="size-6 text-muted-foreground" aria-hidden="true" />
                  </div>
                )}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {!disabled ? (
        <FileDrop testId={testId} onUploaded={() => void refresh()} disabled={disabled} />
      ) : null}
    </div>
  );
}
