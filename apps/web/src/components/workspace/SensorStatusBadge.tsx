import { Radio, RadioTower, WifiOff } from 'lucide-react';
import type { SensorStatus } from '@/lib/sensor-status';
import { cn } from '@/lib/utils';
import type { EnvStreamReading } from './useEnvStream';

/**
 * The workspace header's live sensor indicator (implementation.md §7.5's
 * reference layout: "● Sensor live 22.4 °C 54 % RH"). `aria-live="polite"`
 * because the status itself is what implementation.md's acceptance
 * criterion is judged on ("shows 'Sensor offline — enter conditions
 * manually' within 2 min") — a silent colour change alone wouldn't satisfy
 * §7.9's "aria-live for autosave and verdict changes", and this is the same
 * category of live status change.
 */
export function SensorStatusBadge({
  status,
  reading,
}: {
  status: SensorStatus;
  reading: EnvStreamReading | null;
}) {
  if (status === 'unknown') {
    return (
      <p className="text-xs text-muted-foreground">
        No environment sensor registered for this lab.
      </p>
    );
  }

  if (status === 'offline') {
    return (
      <p aria-live="polite" className="flex items-center gap-1.5 text-xs font-medium text-fail">
        <WifiOff className="size-3.5" aria-hidden="true" />
        Sensor offline — enter conditions manually
      </p>
    );
  }

  const Icon = status === 'live' ? Radio : RadioTower;
  return (
    <p
      aria-live="polite"
      className={cn(
        'tabular flex items-center gap-1.5 text-xs font-medium',
        status === 'live' ? 'text-pass' : 'text-pending',
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      Sensor {status === 'live' ? 'live' : 'stale'}
      {reading ? ` ${reading.tempC.toFixed(1)} °C ${reading.rhPct.toFixed(0)} % RH` : ''}
    </p>
  );
}
