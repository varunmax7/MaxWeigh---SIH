'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalcExplainer } from './CalcExplainer';

export interface ZeroRefValue {
  L: string;
  I: string;
  deltaL: string;
}

/**
 * The zero-reference row (implementation.md §7.5's reference layout: "Zero
 * ref   L 50 g  I 50 g  ΔL 3.0 g  →  E0 −0.5 g"). `L` is fixed by the plan
 * (10 e, per §4.7); only `I` and `ΔL` are entered. `E0`/`steps` come from
 * the live (or persisted) engine result — this component never computes
 * them itself.
 */
export function ZeroRefRow({
  value,
  onChange,
  e0,
  steps,
  disabled = false,
}: {
  value: ZeroRefValue;
  onChange: (value: ZeroRefValue) => void;
  e0: string | null;
  steps: { label: string; formula: string; substituted: string; result: string; clause?: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-[var(--radius-control)] border border-border p-2">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Zero ref — Load L</Label>
        <p className="tabular px-2 py-1.5 text-sm">{value.L} g</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="zero-ref-I" className="text-xs text-muted-foreground">
          Indication I
        </Label>
        <Input
          id="zero-ref-I"
          value={value.I}
          onChange={(e) => onChange({ ...value, I: e.target.value })}
          disabled={disabled}
          inputMode="decimal"
          className="tabular w-24"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="zero-ref-deltaL" className="text-xs text-muted-foreground">
          ΔL
        </Label>
        <Input
          id="zero-ref-deltaL"
          value={value.deltaL}
          onChange={(e) => onChange({ ...value, deltaL: e.target.value })}
          disabled={disabled}
          inputMode="decimal"
          className="tabular w-20"
        />
      </div>
      <div className="flex items-center gap-1 pb-1.5">
        <span className="text-sm text-muted-foreground">→ E0</span>
        <span className="tabular text-sm font-medium">{e0 ?? '—'} g</span>
        <CalcExplainer steps={steps} />
      </div>
    </div>
  );
}
