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
import type { listEvaluations } from '@/server/queries/evaluations';

type EvaluationRow = Awaited<ReturnType<typeof listEvaluations>>['rows'][number];

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() });
const helper = createColumnHelper<typeof features, EvaluationRow>();
const columns = helper.columns([
  helper.accessor('refNo', { header: 'Ref no.' }),
  helper.accessor('manufacturerName', { header: 'Manufacturer' }),
  helper.accessor('modelName', { header: 'Model' }),
  helper.accessor('accuracyClass', { header: 'Class' }),
  helper.accessor('status', { header: 'Status' }),
  helper.accessor('overallVerdict', { header: 'Verdict' }),
  helper.accessor('assignedTesterName', { header: 'Tester' }),
]);

export function EvaluationsTable({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: EvaluationRow[];
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
                No evaluations match these filters.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => router.push(`/evaluations/${row.original.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') router.push(`/evaluations/${row.original.id}`);
                }}
              >
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {cell.column.id === 'accuracyClass' && cell.getValue() ? (
                      <ClassBadge value={cell.getValue() as string} />
                    ) : cell.column.id === 'status' ? (
                      <StatusChip status={cell.getValue() as StatusChipValue} />
                    ) : cell.column.id === 'overallVerdict' && cell.getValue() ? (
                      <VerdictChip verdict={cell.getValue() as VerdictChipValue} />
                    ) : (
                      <table.FlexRender cell={cell} />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} evaluation{total === 1 ? '' : 's'} — page {page} of {totalPages}
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
