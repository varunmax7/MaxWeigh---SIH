'use client';

import { Gauge, Thermometer } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface EnvConditionsValue {
  tempC: number;
  rhPct: number;
  pressureHpa?: number;
  source: 'sensor' | 'manual';
  sensorId?: string;
  ts: string;
}

/**
 * Start/end environmental conditions for a test (implementation.md §7.6:
 * "manual now; accepts a live stream prop for P10"). `liveReading` is where
 * a future sensor-stream integration (P10) would push values in — unused
 * here, kept as an explicit prop so that wiring doesn't need to touch this
 * component's shape again.
 */
export function EnvConditions({
  label,
  value,
  onChange,
  liveReading,
  disabled = false,
}: {
  label: string;
  value: EnvConditionsValue | null;
  onChange: (value: EnvConditionsValue) => void;
  /** A live sensor reading, when P10 wires one in; absent means manual entry only. */
  liveReading?: { tempC: number; rhPct: number; sensorId: string } | null;
  disabled?: boolean;
}) {
  const idPrefix = useId();

  function set(patch: Partial<EnvConditionsValue>) {
    onChange({
      tempC: value?.tempC ?? 0,
      rhPct: value?.rhPct ?? 0,
      source: 'manual',
      ts: new Date().toISOString(),
      ...value,
      ...patch,
    });
  }

  function useLiveReading() {
    if (!liveReading) return;
    onChange({
      tempC: liveReading.tempC,
      rhPct: liveReading.rhPct,
      source: 'sensor',
      sensorId: liveReading.sensorId,
      ts: new Date().toISOString(),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        {liveReading ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={useLiveReading}
            disabled={disabled}
          >
            Use live reading
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-temp`} className="text-xs">
            <Thermometer className="mr-1 inline size-3" aria-hidden="true" />
            Temperature (°C)
          </Label>
          <Input
            id={`${idPrefix}-temp`}
            type="number"
            step="0.1"
            value={value?.tempC ?? ''}
            onChange={(e) => set({ tempC: Number(e.target.value), source: 'manual' })}
            disabled={disabled}
            className="tabular"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-rh`} className="text-xs">
            <Gauge className="mr-1 inline size-3" aria-hidden="true" />
            Humidity (% RH)
          </Label>
          <Input
            id={`${idPrefix}-rh`}
            type="number"
            step="0.1"
            value={value?.rhPct ?? ''}
            onChange={(e) => set({ rhPct: Number(e.target.value), source: 'manual' })}
            disabled={disabled}
            className="tabular"
          />
        </div>
      </div>
      {value ? (
        <p className="tabular text-xs text-muted-foreground">
          {value.source === 'sensor' ? 'From sensor' : 'Entered manually'} ·{' '}
          {new Date(value.ts).toLocaleTimeString()}
        </p>
      ) : null}
    </div>
  );
}
