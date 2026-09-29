'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getReportDownloadUrlsAction } from '@/server/actions/report';

/**
 * Presigned downloads (implementation.md §9: "presigned GET URLs, 5 min
 * TTL, issued only after permission check"). Fetched on click, not on page
 * load, so a stale URL is never sitting in the DOM past its own TTL.
 */
export function DownloadButtons({ evaluationId, ready }: { evaluationId: string; ready: boolean }) {
  const [loading, setLoading] = useState<'pdf' | 'docx' | null>(null);

  async function download(kind: 'pdf' | 'docx') {
    setLoading(kind);
    const urls = await getReportDownloadUrlsAction(evaluationId);
    setLoading(null);
    const url = kind === 'pdf' ? urls?.pdfUrl : urls?.docxUrl;
    if (!url) {
      toast.error('That file is not ready yet.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Preparing the signed document…</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => download('pdf')} disabled={loading === 'pdf'}>
        {loading === 'pdf' ? 'Preparing…' : 'Download signed PDF'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => download('docx')}
        disabled={loading === 'docx'}
      >
        {loading === 'docx' ? 'Preparing…' : 'Download Word (DOCX)'}
      </Button>
    </div>
  );
}
