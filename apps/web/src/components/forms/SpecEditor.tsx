'use client';

import { Plus, Trash2 } from 'lucide-react';
import { MassInput } from '@/components/forms/MassInput';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SpecState } from '@/lib/spec-state';

const ACCURACY_CLASSES = ['I', 'II', 'III', 'IIII'] as const;
const RANGE_KINDS = ['single', 'multi_range', 'multi_interval'] as const;
const DISPLAY_UNITS = ['mg', 'g', 'kg', 't'] as const;
const LOAD_RECEPTOR_KINDS = ['platform', 'pan', 'hook', 'hopper', 'vehicle', 'other'] as const;

function LabeledCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}

/**
 * The metrology parameter form (implementation.md §7.5: "spec editor using
 * MassInput fields for Max/Min/e/d/tare/etc."). Purely controlled — all
 * state lives in the caller so the live `ClassificationPanel` can react to
 * every keystroke via the same `toInstrumentMetrology` used at submit time.
 */
export function SpecEditor({
  spec,
  onChange,
}: {
  spec: SpecState;
  onChange: (next: SpecState) => void;
}) {
  function set<K extends keyof SpecState>(key: K, value: SpecState[K]) {
    onChange({ ...spec, [key]: value });
  }

  function updateRange(key: string, patch: Partial<SpecState['ranges'][number]>) {
    onChange({ ...spec, ranges: spec.ranges.map((r) => (r.key === key ? { ...r, ...patch } : r)) });
  }

  const unit = spec.displayUnit || 'g';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="accuracyClass">Accuracy class</Label>
          <Select
            value={spec.accuracyClass}
            onValueChange={(v) => set('accuracyClass', v as SpecState['accuracyClass'])}
          >
            <SelectTrigger id="accuracyClass" className="w-full">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {ACCURACY_CLASSES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rangeKind">Range kind</Label>
          <Select value={spec.kind} onValueChange={(v) => set('kind', v as SpecState['kind'])}>
            <SelectTrigger id="rangeKind" className="w-full">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {RANGE_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {k.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="displayUnit">Display unit</Label>
          <Select
            value={spec.displayUnit}
            onValueChange={(v) => set('displayUnit', v as SpecState['displayUnit'])}
          >
            <SelectTrigger id="displayUnit" className="w-full">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {DISPLAY_UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <MassInput
          label="Min"
          value={spec.min}
          onChange={(v) => set('min', v)}
          assumedUnit={unit}
          displayUnit={unit}
        />
      </div>

      <div className="space-y-2">
        <Label>Weighing ranges</Label>
        {spec.ranges.map((row) => (
          <div
            key={row.key}
            className="flex items-end gap-2 rounded-[var(--radius-control)] border border-border p-2"
          >
            <MassInput
              label="Max"
              value={row.max}
              onChange={(v) => updateRange(row.key, { max: v })}
              assumedUnit={unit}
              displayUnit={unit}
              className="flex-1"
            />
            <MassInput
              label="e"
              value={row.e}
              onChange={(v) => updateRange(row.key, { e: v })}
              assumedUnit={unit}
              displayUnit={unit}
              className="flex-1"
            />
            <MassInput
              label="d"
              value={row.d}
              onChange={(v) => updateRange(row.key, { d: v })}
              assumedUnit={unit}
              displayUnit={unit}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove range"
              disabled={spec.ranges.length === 1}
              onClick={() =>
                set(
                  'ranges',
                  spec.ranges.filter((r) => r.key !== row.key),
                )
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            set('ranges', [
              ...spec.ranges,
              { key: crypto.randomUUID(), max: null, e: null, d: null },
            ])
          }
        >
          <Plus className="size-4" />
          Add range
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MassInput
          label="Max additive tare (T+)"
          value={spec.maxAdditiveTare}
          onChange={(v) => set('maxAdditiveTare', v)}
          assumedUnit={unit}
          displayUnit={unit}
        />
        <MassInput
          label="Max subtractive tare (T−)"
          value={spec.maxSubtractiveTare}
          onChange={(v) => set('maxSubtractiveTare', v)}
          assumedUnit={unit}
          displayUnit={unit}
        />
        <div className="space-y-1.5">
          <Label htmlFor="lowC">Temp range low (°C)</Label>
          <Input
            id="lowC"
            value={spec.lowC}
            onChange={(e) => set('lowC', e.target.value)}
            inputMode="decimal"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="highC">Temp range high (°C)</Label>
          <Input
            id="highC"
            value={spec.highC}
            onChange={(e) => set('highC', e.target.value)}
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <LabeledCheckbox
          id="isElectronic"
          label="Electronic"
          checked={spec.isElectronic}
          onChange={(v) => set('isElectronic', v)}
        />
        <LabeledCheckbox
          id="hasTareDevice"
          label="Has tare device"
          checked={spec.hasTareDevice}
          onChange={(v) => set('hasTareDevice', v)}
        />
        <LabeledCheckbox
          id="hasZeroTracking"
          label="Has zero tracking"
          checked={spec.hasZeroTracking}
          onChange={(v) => set('hasZeroTracking', v)}
        />
        <LabeledCheckbox
          id="levelIndicator"
          label="Level indicator"
          checked={spec.levelIndicator}
          onChange={(v) => set('levelIndicator', v)}
        />
        <LabeledCheckbox
          id="tiltSusceptible"
          label="Tilt susceptible"
          checked={spec.tiltSusceptible}
          onChange={(v) => set('tiltSusceptible', v)}
        />
      </div>

      <div className="space-y-1.5 sm:max-w-xs">
        <Label htmlFor="initialZeroSettingRangePct">Initial zero-setting range (% of Max)</Label>
        <Input
          id="initialZeroSettingRangePct"
          value={spec.initialZeroSettingRangePct}
          onChange={(e) => set('initialZeroSettingRangePct', e.target.value)}
          inputMode="decimal"
        />
      </div>

      <div className="space-y-2">
        <Label>Load receptor</Label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Select
            value={spec.loadReceptorKind}
            onValueChange={(v) => set('loadReceptorKind', v as SpecState['loadReceptorKind'])}
          >
            <SelectTrigger className="w-full" aria-label="Load receptor kind">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              {LOAD_RECEPTOR_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1.5">
            <Label htmlFor="supports">Supports</Label>
            <Input
              id="supports"
              value={spec.supports}
              onChange={(e) => set('supports', e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="widthMm">Width (mm)</Label>
            <Input
              id="widthMm"
              value={spec.widthMm}
              onChange={(e) => set('widthMm', e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="depthMm">Depth (mm)</Label>
            <Input
              id="depthMm"
              value={spec.depthMm}
              onChange={(e) => set('depthMm', e.target.value)}
              inputMode="decimal"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Power supply</Label>
        <LabeledCheckbox
          id="mainsEnabled"
          label="Mains"
          checked={spec.mainsEnabled}
          onChange={(v) => set('mainsEnabled', v)}
        />
        {spec.mainsEnabled ? (
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            <div className="space-y-1.5">
              <Label htmlFor="vNom">Nominal voltage (V)</Label>
              <Input
                id="vNom"
                value={spec.vNom}
                onChange={(e) => set('vNom', e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fNomHz">Nominal frequency (Hz)</Label>
              <Input
                id="fNomHz"
                value={spec.fNomHz}
                onChange={(e) => set('fNomHz', e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>
        ) : null}
        <div className="flex gap-4">
          <LabeledCheckbox
            id="battery"
            label="Battery"
            checked={spec.battery}
            onChange={(v) => set('battery', v)}
          />
          <LabeledCheckbox
            id="dcAdapter"
            label="DC adapter"
            checked={spec.dcAdapter}
            onChange={(v) => set('dcAdapter', v)}
          />
        </div>
      </div>
    </div>
  );
}
