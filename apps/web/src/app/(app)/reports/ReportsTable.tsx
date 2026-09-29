'use client';

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import type { ReactNode } from 'react';
import {
  ClassBadge,
  StatusChip,
  type StatusChipValue,
  VerdictChip,
  type VerdictChipValue,
} from '@/components/metrology';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { listReports } from '@/server/queries/reports';
import { ReportRowActions } from './ReportRowActions';

type ReportRow = Awaited<ReturnType<typeof listReports>>['rows'][number];

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() });
const helper = createColumnHelper<typeof features, ReportRow>();
const columns = helper.columns([
  helper.accessor('reportNo', { header: 'Report no.' }),
  helper.accessor('certificateNo', { header: 'Certificate no.' }),
  helper.accessor('manufacturerName', { header: 'Manufacturer' }),
  helper.accessor('modelName', { header: 'Model' }),
  helper.accessor('accuracyClass', { header: 'Class' }),
  helper.accessor('maxLoadG', { header: 'Max' }),
  helper.accessor('overallVerdict', { header: 'Verdict' }),
  helper.accessor('issuedAt', { header: 'Issued' }),
  helper.accessor('status', { header: 'Status' }),
  helper.display({ id: 'actions', header: '' }),
]);

function formatMax(grams: string | null): string {
  if (!grams) return '—';
  const g = Number(grams);
  return g >= 1000 ? `${(g / 1000).toLocaleString('en-IN')} kg` : `${g} g`;
}

/**
 * One cell's contents, by column id — split out of the row map purely to
 * keep that render under Biome's complexity limit. Every column here is a
 * plain accessor with no custom TanStack cell renderer, so a raw scalar
 * (string, or null) is all `value` ever is — the `default` branch renders
 * it as-is rather than needing `table.FlexRender`.
 */
function reportCell(columnId: string, value: unknown): ReactNode {
  switch (columnId) {
    case 'accuracyClass':
      return value ? <ClassBadge value={value as string} /> : null;
    case 'status':
      return <StatusChip status={value as StatusChipValue} />;
    case 'overallVerdict':
      return value ? <VerdictChip verdict={value as VerdictChipValue} /> : null;
    case 'maxLoadG':
      return formatMax(value as string | null);
    case 'issuedAt':
      return value ? new Date(value as Date).toLocaleDateString('en-IN') : '—';
    case 'certificateNo':
      return (value as string | null) ?? '—';
    default:
      return value as ReactNode;
  }
}

/** Reports repository table (implementation.md §7.5), same shape as `/evaluations`'s. */
export function ReportsTable({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: ReportRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const [, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const table = useTable({ features, columns, data: rows });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No reports match these filters.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => router.push(`/evaluations/${row.original.evaluationId}/report`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')
                    router.push(`/evaluations/${row.original.evaluationId}/report`);
                }}
              >
                {row.getAllCells().map((cell) =>
                  cell.column.id === 'actions' ? (
                    <TableCell key={cell.id} onClick={(e) => e.stopPropagation()}>
                      <ReportRowActions
                        evaluationId={row.original.evaluationId}
                        certOrReportNo={row.original.certificateNo ?? row.original.reportNo}
                      />
                    </TableCell>
                  ) : (
                    <TableCell
                      key={cell.id}
                      className={cell.column.id === 'reportNo' ? 'tabular' : undefined}
                    >
                      {reportCell(cell.column.id, cell.getValue())}
                    </TableCell>
                  ),
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} report{total === 1 ? '' : 's'} — page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
