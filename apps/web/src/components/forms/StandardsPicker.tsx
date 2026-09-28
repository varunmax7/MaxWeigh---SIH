'use client';

import { type InstrumentMetrology, standardsAdequacy, type WeightPiece } from '@tula/engine';
import { OIML_R76_1_2006, OIML_R111_WEIGHTS } from '@tula/rulepacks';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useMemo } from 'react';
import { ClassBadge } from '@/components/metrology';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface WeightSetOption {
  id: string;
  setCode: string;
  oimlClass: string;
  dueOn: string | null;
  items: { nominalG: string }[];
}

/**
 * Reference weight set selection with a live adequacy result (implementation.md
 * §7.5, §4.8 clause 3.7.1: combined R 111 MPE of the selected weights must be
 * ≤ ⅓ of the instrument's own MPE at each load used). Runs the same
 * `standardsAdequacy` the server's completion guard re-checks — a live
 * preview only; the server result is authoritative (§11).
 */
export function StandardsPicker({
  weightSets,
  selectedIds,
  onChange,
  loads,
  spec,
  disabled = false,
}: {
  weightSets: WeightSetOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loads: string[];
  spec: InstrumentMetrology;
  disabled?: boolean;
}) {
  const pool = useMemo<WeightPiece[]>(() => {
    const selected = weightSets.filter((s) => selectedIds.includes(s.id));
    return selected.flatMap((s) =>
      s.items.map((item) => ({
        nominal: item.nominalG,
        weightClass: s.oimlClass as WeightPiece['weightClass'],
        calibrationExpiresAt: s.dueOn ?? undefined,
      })),
    );
  }, [weightSets, selectedIds]);

  const adequacyByLoad = useMemo(() => {
    if (pool.length === 0) return new Map<string, boolean>();
    return new Map(
      loads.map((load) => [
        load,
        standardsAdequacy(load, pool, spec, OIML_R76_1_2006, OIML_R111_WEIGHTS).adequate,
      ]),
    );
  }, [loads, pool, spec]);

  const allAdequate = loads.length > 0 && loads.every((l) => adequacyByLoad.get(l));

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter((s) => s !== id));
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Standards</p>
      <div className="space-y-1.5">
        {weightSets.map((set) => (
          <div key={set.id} className="flex items-center gap-2">
            <Checkbox
              id={`ws-${set.id}`}
              checked={selectedIds.includes(set.id)}
              onCheckedChange={(v) => toggle(set.id, v === true)}
              disabled={disabled}
            />
            <Label htmlFor={`ws-${set.id}`} className="flex items-center gap-1.5 font-normal">
              <span className="tabular">{set.setCode}</span>
              <ClassBadge value={set.oimlClass} />
              {set.dueOn ? (
                <span className="tabular text-xs text-muted-foreground">cal. due {set.dueOn}</span>
              ) : null}
            </Label>
          </div>
        ))}
        {weightSets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active reference weight sets for this lab.
          </p>
        ) : null}
      </div>
      {loads.length > 0 && selectedIds.length > 0 ? (
        <p
          className={cn(
            'flex items-center gap-1.5 text-sm',
            allAdequate ? 'text-pass' : 'text-fail',
          )}
        >
          {allAdequate ? (
            <CheckCircle2 className="size-4" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-4" aria-hidden="true" />
          )}
          {allAdequate ? 'Adequate for every load used' : 'Not adequate for at least one load used'}
        </p>
      ) : null}
    </div>
  );
}
