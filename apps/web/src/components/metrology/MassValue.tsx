import { convertMass, type Dec, type DisplayUnit } from '@tula/engine';
import { cn } from '@/lib/utils';

/**
 * A mass, right-aligned with tabular figures, unit in muted colour after the
 * value (implementation.md §7.3: `"10.000 kg"`). Takes the same `Dec`
 * (decimal-string grams) the engine and the database use — never a JS
 * `number` (implementation.md §4.1, §11).
 */
export function MassValue({
  grams,
  unit,
  decimalPlaces = 3,
  className,
}: {
  grams: Dec;
  unit: DisplayUnit;
  decimalPlaces?: number;
  className?: string;
}) {
  const value = convertMass(grams, unit).toFixed(decimalPlaces);
  return (
    <span className={cn('tabular whitespace-nowrap text-right', className)}>
      {value} <span className="text-muted-foreground">{unit}</span>
    </span>
  );
}
