'use client';

import { GitBranch } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { StatusChip } from '@/components/metrology/StatusChip';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cloneRulepackDraftAction } from '@/server/actions/rulepacks';
import type { RulepackListRow } from '@/server/queries/rulepacks';

export function RulepacksListClient({
  rows,
  canDraft,
}: {
  rows: RulepackListRow[];
  canDraft: boolean;
}) {
  const router = useRouter();
  const [pendingSource, setPendingSource] = useState<string | null>(null);

  async function handleClone(row: RulepackListRow) {
    setPendingSource(`${row.id}@${row.version}`);
    const result = await cloneRulepackDraftAction({ sourceId: row.id, sourceVersion: row.version });
    setPendingSource(null);
    if (result.ok) {
      router.push(`/rules/${result.data.id}/${result.data.version}`);
    }
  }

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No rule packs yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Id @ version</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Published</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.id}@${row.version}`}>
            <TableCell className="tabular">
              <Link href={`/rules/${row.id}/${row.version}`} className="hover:underline">
                {row.id}@{row.version}
              </Link>
            </TableCell>
            <TableCell>{row.title}</TableCell>
            <TableCell>
              <StatusChip status={row.status as 'DRAFT' | 'PUBLISHED' | 'RETIRED'} />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {row.publishedAt
                ? `${new Date(row.publishedAt).toLocaleDateString()} · ${row.confirmedByName ?? '—'}`
                : '—'}
            </TableCell>
            <TableCell>
              {canDraft && row.status === 'PUBLISHED' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pendingSource === `${row.id}@${row.version}`}
                  onClick={() => void handleClone(row)}
                >
                  <GitBranch className="size-4" />
                  Clone to draft
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
