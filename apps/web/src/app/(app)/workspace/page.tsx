import { OIML_R76_1_2006 } from '@tula/rulepacks';
import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusChip, type StatusChipValue } from '@/components/metrology';
import { PageHeader } from '@/components/shell/PageHeader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listMyTests } from '@/server/queries/execution';
import { requireSession } from '@/server/session';

export const metadata: Metadata = { title: 'My tests' };

const CATALOG_TITLE = new Map(OIML_R76_1_2006.tests.map((t) => [t.code, t.title]));

/** implementation.md §7.4 "My tests" — tests on evaluations assigned to the signed-in tester. */
export default async function WorkspacePage() {
  const session = await requireSession();
  const tests = await listMyTests(session.user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My tests"
        description="Tests on evaluations assigned to you, not yet completed."
      />
      {tests.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No tests assigned to you right now.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref no.</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Test</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tests.map((test) => (
              <TableRow key={test.testId} className="cursor-pointer">
                <TableCell className="p-0">
                  <Link
                    href={`/evaluations/${test.evaluationId}/execute/${test.testCode}?range=${test.rangeIndex}`}
                    className="block px-4 py-2 tabular"
                  >
                    {test.refNo}
                  </Link>
                </TableCell>
                <TableCell>{test.manufacturerName}</TableCell>
                <TableCell>{test.modelName}</TableCell>
                <TableCell>{CATALOG_TITLE.get(test.testCode) ?? test.testCode}</TableCell>
                <TableCell>
                  <StatusChip status={test.status as StatusChipValue} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
