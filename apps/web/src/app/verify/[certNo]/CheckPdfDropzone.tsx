'use client';

import { CheckCircle2, FileUp, XCircle } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'match' }
  | { kind: 'no-match' };

async function sha256Hex(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * "Check a PDF" (implementation.md §7.5 "Public verify"): hashes a dropped
 * file entirely in the browser via the Web Crypto API and compares it to
 * the report's published `pdf_sha256` — "Nothing is uploaded." No server
 * round trip at all beyond the hash this page already rendered with.
 */
export function CheckPdfDropzone({ expectedSha256 }: { expectedSha256: string | null }) {
  const [state, setState] = useState<CheckState>({ kind: 'idle' });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function checkFile(file: File) {
    if (!expectedSha256) return;
    setState({ kind: 'checking' });
    const hash = await sha256Hex(file);
    setState({ kind: hash === expectedSha256 ? 'match' : 'no-match' });
  }

  if (!expectedSha256) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Check a PDF</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void checkFile(file);
        }}
        className={cn(
          'flex w-full flex-col items-center gap-2 rounded-[var(--radius-panel)] border border-dashed border-border p-6 text-sm text-muted-foreground transition-colors',
          dragOver && 'border-active bg-active-bg',
        )}
      >
        <FileUp aria-hidden="true" className="size-5" />
        Drop a PDF here, or click to choose one — it never leaves your browser.
      </button>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void checkFile(file);
        }}
      />

      {state.kind === 'checking' ? (
        <p className="text-sm text-muted-foreground">Checking…</p>
      ) : null}
      {state.kind === 'match' ? (
        <p className="flex items-center gap-1 text-sm text-pass">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Match — this file is the authentic signed report.
        </p>
      ) : null}
      {state.kind === 'no-match' ? (
        <p className="flex items-center gap-1 text-sm text-fail">
          <XCircle aria-hidden="true" className="size-4" />
          No match — this file does not match the published hash.
        </p>
      ) : null}
    </div>
  );
}
