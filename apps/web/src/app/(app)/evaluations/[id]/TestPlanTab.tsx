import { OIML_R76_1_2006 } from '@tula/rulepacks';
import {
  StatusChip,
  type StatusChipValue,
  VerdictChip,
  type VerdictChipValue,
} from '@/components/metrology';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { listEvaluationTests } from '@/server/queries/evaluations';

type TestRow = Awaited<ReturnType<typeof listEvaluationTests>>[number];

const CATALOG_BY_CODE = new Map(OIML_R76_1_2006.tests.map((t) => [t.code, t]));

/** Test plan tab (implementation.md §7.5): every planned test with applicability, reason, status and verdict. */
export function TestPlanTab({ tests }: { tests: TestRow[] }) {
  if (tests.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No test plan yet — this evaluation is still a draft.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Clause</TableHead>
          <TableHead>Test</TableHead>
          <TableHead>Applicability</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Verdict</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tests.map((test) => {
          const catalog = CATALOG_BY_CODE.get(test.testCode);
          return (
            <TableRow key={`${test.testCode}-${test.rangeIndex}`}>
              <TableCell className="tabular">{catalog?.clause ?? '—'}</TableCell>
              <TableCell>
                <p>{catalog?.title ?? test.testCode}</p>
                {test.naReason ? (
                  <p className="text-xs text-muted-foreground">{test.naReason}</p>
                ) : null}
              </TableCell>
              <TableCell>{test.applicability === 'APPLICABLE' ? 'Applicable' : 'N/A'}</TableCell>
              <TableCell>
                <StatusChip status={test.status as StatusChipValue} />
              </TableCell>
              <TableCell>
                {test.verdict ? <VerdictChip verdict={test.verdict as VerdictChipValue} /> : '—'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
