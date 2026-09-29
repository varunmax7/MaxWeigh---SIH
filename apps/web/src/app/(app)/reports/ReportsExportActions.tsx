'use client';

import { Download, FileArchive } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { exportReportsZipAction } from '@/server/actions/reports-export';
import { reportsSearchParams } from './search-params';

/**
 * "row actions... bulk ZIP export, CSV export" (implementation.md §7.5).
 * CSV is a plain link (the route streams it synchronously); ZIP is queued
 * (`reports.export`) and arrives as a `reports.export_ready` notification —
 * building thousands of PDF/DOCX bytes into an archive doesn't fit one
 * request/response cycle.
 */
export function ReportsExportActions({ labId }: { labId: string }) {
  const [filters] = useQueryStates(reportsSearchParams);
  const [pending, startTransition] = useTransition();

  const csvParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && key !== 'page' && key !== 'pageSize') csvParams.set(key, String(value));
  }

  function exportZip() {
    startTransition(async () => {
      const result = await exportReportsZipAction({
        labId,
        filters: {
          q: filters.q ?? undefined,
          accuracyClass: filters.accuracyClass ?? undefined,
          verdict: filters.verdict ?? undefined,
          status: filters.status ?? undefined,
          manufacturerId: filters.manufacturerId ?? undefined,
          issuedFrom: filters.issuedFrom ?? undefined,
          issuedTo: filters.issuedTo ?? undefined,
        },
      });
      if (result.ok) {
        toast.success("Preparing your ZIP export — we'll notify you when it's ready to download.");
      } else {
        toast.error("Couldn't start the export. Try again.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={`/api/v1/reports/export?${csvParams.toString()}`}>
          <Download aria-hidden="true" className="size-4" />
          Export CSV
        </a>
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={exportZip}>
        <FileArchive aria-hidden="true" className="size-4" />
        {pending ? 'Starting…' : 'Export ZIP'}
      </Button>
    </div>
  );
}
