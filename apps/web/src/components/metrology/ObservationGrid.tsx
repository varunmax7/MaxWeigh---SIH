'use client';

import type { RowResult } from '@tula/engine';
import { useId, useRef } from 'react';
import { CalcExplainer } from '@/components/metrology/CalcExplainer';
import { VerdictChip, type VerdictChipValue } from '@/components/metrology/VerdictChip';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface GridRow {
  rowId: string;
  /** Key into `results` — the engine's rowId, which may differ from `rowId` (e.g. WEIGHING prefixes `asc-`/`desc-`). */
  resultKey: string;
  label: string;
  direction?: 'up' | 'down';
  L: string;
  I: string | null;
  deltaL: string | null;
  readOnly?: boolean;
}

function focusNext(refs: (HTMLInputElement | null)[], index: number) {
  refs[index + 1]?.focus();
}

function GridDataRow({
  row,
  index,
  result,
  idPrefix,
  showDirection,
  disabled,
  iRefs,
  deltaLRefs,
  onChangeI,
  onChangeDeltaL,
}: {
  row: GridRow;
  index: number;
  result: RowResult | undefined;
  idPrefix: string;
  showDirection: boolean;
  disabled: boolean;
  iRefs: (HTMLInputElement | null)[];
  deltaLRefs: (HTMLInputElement | null)[];
  onChangeI: (rowId: string, value: string) => void;
  onChangeDeltaL: (rowId: string, value: string) => void;
}) {
  const rowDisabled = disabled || row.readOnly;
  return (
    <TableRow>
      <TableCell className="tabular text-muted-foreground">{index + 1}</TableCell>
      {showDirection ? (
        <TableCell>{row.direction === 'up' ? '↑' : row.direction === 'down' ? '↓' : ''}</TableCell>
      ) : null}
      <TableCell className="tabular">{row.label}</TableCell>
      <TableCell>
        <Input
          ref={(el) => {
            iRefs[index] = el;
          }}
          id={`${idPrefix}-I-${row.rowId}`}
          aria-label={`Indication for load ${row.label}`}
          data-serial-target="true"
          value={row.I ?? ''}
          onChange={(e) => onChangeI(row.rowId, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') focusNext(iRefs, index);
          }}
          disabled={rowDisabled}
          inputMode="decimal"
          className="tabular w-24"
        />
      </TableCell>
      <TableCell>
        <Input
          ref={(el) => {
            deltaLRefs[index] = el;
          }}
          id={`${idPrefix}-deltaL-${row.rowId}`}
          aria-label={`Additional load Δ L for load ${row.label}`}
          value={row.deltaL ?? ''}
          onChange={(e) => onChangeDeltaL(row.rowId, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') focusNext(deltaLRefs, index);
          }}
          disabled={rowDisabled}
          inputMode="decimal"
          className="tabular w-20"
        />
      </TableCell>
      <TableCell className="tabular">{result?.Ec ?? '—'}</TableCell>
      <TableCell className="tabular">{result?.EcInE ?? '—'}</TableCell>
      <TableCell className="tabular text-muted-foreground">
        {result?.mpe ? `±${result.mpe}` : '—'}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {result ? (
            <VerdictChip verdict={result.verdict as VerdictChipValue} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {result?.issues && result.issues.length > 0 ? (
            <span
              className={cn(
                'size-1.5 rounded-full',
                result.issues.some((i) => i.severity === 'error') ? 'bg-fail' : 'bg-pending',
              )}
              aria-hidden="true"
              title={result.issues.map((i) => i.code).join(', ')}
            />
          ) : null}
          <CalcExplainer steps={result?.steps ?? []} />
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * The plan-prefilled, keyboard-operable grid (implementation.md §7.5):
 * "tester types only I and ΔL. P and E are available in an expandable
 * detail row; the grid shows Ec, Ec/e, MPE and Result." Shared by WEIGHING
 * and ECCENTRICITY — both are a list of load rows judged against `mpe(L)`.
 *
 * Keyboard (§7.7): Enter moves to the next row, same column; Tab already
 * does "next column" via native DOM tab order, so it needs no override.
 */
export function ObservationGrid({
  rows,
  results,
  onChangeI,
  onChangeDeltaL,
  disabled = false,
}: {
  rows: GridRow[];
  results: Map<string, RowResult>;
  onChangeI: (rowId: string, value: string) => void;
  onChangeDeltaL: (rowId: string, value: string) => void;
  disabled?: boolean;
}) {
  const idPrefix = useId();
  const iRefs = useRef<(HTMLInputElement | null)[]>([]);
  const deltaLRefs = useRef<(HTMLInputElement | null)[]>([]);
  const showDirection = rows.some((r) => r.direction);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          {showDirection ? <TableHead className="w-10">Dir</TableHead> : null}
          <TableHead>Load L</TableHead>
          <TableHead>Indication I</TableHead>
          <TableHead>ΔL</TableHead>
          <TableHead>Ec</TableHead>
          <TableHead>Ec/e</TableHead>
          <TableHead>MPE</TableHead>
          <TableHead>Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <GridDataRow
            key={row.rowId}
            row={row}
            index={index}
            result={results.get(row.resultKey)}
            idPrefix={idPrefix}
            showDirection={showDirection}
            disabled={disabled}
            iRefs={iRefs.current}
            deltaLRefs={deltaLRefs.current}
            onChangeI={onChangeI}
            onChangeDeltaL={onChangeDeltaL}
          />
        ))}
      </TableBody>
    </Table>
  );
}
