'use client';

import { Download, FileText, MoreHorizontal, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getReportDownloadUrlsAction } from '@/server/actions/report';

async function openDownload(evaluationId: string, kind: 'pdfUrl' | 'docxUrl') {
  const urls = await getReportDownloadUrlsAction(evaluationId);
  const url = urls?.[kind];
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
  else toast.error(kind === 'pdfUrl' ? 'No signed PDF yet.' : 'No DOCX yet.');
}

/** Reports repository row actions: "open, PDF, DOCX, verify link" (implementation.md §7.5). */
export function ReportRowActions({
  evaluationId,
  certOrReportNo,
}: {
  evaluationId: string;
  certOrReportNo: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Report actions"
          className="rounded-[var(--radius-control)] p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => void openDownload(evaluationId, 'pdfUrl')}>
          <FileText aria-hidden="true" className="size-4" />
          Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void openDownload(evaluationId, 'docxUrl')}>
          <Download aria-hidden="true" className="size-4" />
          Download DOCX
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/verify/${certOrReportNo}`} target="_blank" rel="noopener noreferrer">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Verify link
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
