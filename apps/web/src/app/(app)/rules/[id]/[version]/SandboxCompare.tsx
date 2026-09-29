'use client';

import { useId, useState } from 'react';
import { VerdictChip, type VerdictChipValue } from '@/components/metrology/VerdictChip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { compareRulepackDraftAction } from '@/server/actions/rulepacks';

/**
 * "Re-evaluate under draft" (implementation.md §10 P10) — re-runs an
 * existing evaluation's completed tests through this draft and shows a
 * side-by-side verdict comparison. Read-only: the evaluation itself is
 * never touched (§4.11).
 */
export function SandboxCompare({ id, version }: { id: string; version: string }) {
  const [refNo, setRefNo] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<
    | {
        testCode: string;
        rangeIndex: number;
        storedVerdict: string | null;
        draftVerdict: string | null;
        changed: boolean;
      }[]
    | null
  >(null);
  const fieldId = useId();

  async function handleCompare() {
    setPending(true);
    setError(null);
    setRows(null);
    const result = await compareRulepackDraftAction({ id, version, refNo });
    setPending(false);
    if (!result.ok) {
      setError(
        result.code === 'NOT_FOUND'
          ? 'No evaluation found with that reference number in a lab you belong to.'
          : 'Could not run the comparison.',
      );
      return;
    }
    setRows(result.data.rows);
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-panel)] border border-border p-4">
      <h2 className="text-sm font-semibold">Re-evaluate under this draft</h2>
      <p className="text-sm text-muted-foreground">
        Pick an evaluation by its reference number to see whether this draft would change any of its
        completed test verdicts. Nothing about the evaluation is changed.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={fieldId} className="text-xs">
            Evaluation reference no.
          </Label>
          <Input
            id={fieldId}
            value={refNo}
            onChange={(e) => setRefNo(e.target.value)}
            placeholder="EV-RRSL-BLR-2026-0142"
            className="tabular w-64"
          />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!refNo || pending}
          onClick={() => void handleCompare()}
        >
          {pending ? 'Comparing…' : 'Compare'}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-fail">
          {error}
        </p>
      ) : null}
      {rows ? (
        rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This evaluation has no completed tests to compare.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                <TableHead>Stored verdict</TableHead>
                <TableHead>Under this draft</TableHead>
                <TableHead>Changed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.testCode}-${row.rangeIndex}`}>
                  <TableCell className="tabular font-medium">{row.testCode}</TableCell>
                  <TableCell>
                    {row.storedVerdict ? (
                      <VerdictChip verdict={row.storedVerdict as VerdictChipValue} />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {row.draftVerdict ? (
                      <VerdictChip verdict={row.draftVerdict as VerdictChipValue} />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{row.changed ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      ) : null}
    </div>
  );
}
