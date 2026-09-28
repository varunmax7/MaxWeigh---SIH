import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { listEvaluationHistory } from '@/server/queries/evaluations';

type HistoryRow = Awaited<ReturnType<typeof listEvaluationHistory>>[number];

/** History tab (implementation.md §7.5): "audit entries for this evaluation." */
export function HistoryTab({ entries }: { entries: HistoryRow[] }) {
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Actor role</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id.toString()}>
            <TableCell className="tabular">
              {entry.ts.toISOString().replace('T', ' ').slice(0, 19)}
            </TableCell>
            <TableCell>{entry.actorRole ?? '—'}</TableCell>
            <TableCell className="tabular">{entry.action}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
