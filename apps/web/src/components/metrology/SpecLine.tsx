import type { AccuracyClass, Dec, DisplayUnit } from '@tula/engine';
import { cn } from '@/lib/utils';
import { ClassBadge } from './ClassBadge';
import { MassValue } from './MassValue';

/**
 * The one-line instrument summary used across the app (implementation.md
 * §7.6, §7.4's example: "Max 30 kg  Min 100 g  e = d = 5 g"). Takes
 * already-computed display values rather than an `InstrumentMetrology` — n
 * and any multi-range breakdown are engine logic (implementation.md §11:
 * "All OIML logic lives in packages/engine"), not something this component
 * derives.
 *
 * `maxUnit` and `smallUnit` are separate on purpose: Max is usually kg while
 * Min/e/d are usually g on the same instrument (as in the example above), so
 * one `unit` prop for all four would round Min/e/d to `0` whenever they're
 * far smaller than Max — a real bug caught in `/dev/ui`, not by inspection.
 */
export function SpecLine({
  accuracyClass,
  max,
  maxUnit,
  min,
  e,
  d,
  smallUnit = maxUnit,
  n,
  className,
}: {
  accuracyClass: AccuracyClass;
  max: Dec;
  maxUnit: DisplayUnit;
  min: Dec;
  e: Dec;
  d: Dec;
  /** Unit for Min/e/d; defaults to `maxUnit` when every value shares one unit. */
  smallUnit?: DisplayUnit;
  n?: number | string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-sm', className)}>
      <span className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Class</span>
        <ClassBadge value={accuracyClass} />
      </span>
      <span className="flex items-baseline gap-1">
        <span className="text-muted-foreground">Max</span>
        <MassValue grams={max} unit={maxUnit} decimalPlaces={0} />
      </span>
      <span className="flex items-baseline gap-1">
        <span className="text-muted-foreground">Min</span>
        <MassValue grams={min} unit={smallUnit} decimalPlaces={0} />
      </span>
      {e === d ? (
        <span className="flex items-baseline gap-1">
          <span className="text-muted-foreground">e = d</span>
          <MassValue grams={e} unit={smallUnit} decimalPlaces={0} />
        </span>
      ) : (
        <>
          <span className="flex items-baseline gap-1">
            <span className="text-muted-foreground">e</span>
            <MassValue grams={e} unit={smallUnit} decimalPlaces={0} />
          </span>
          <span className="flex items-baseline gap-1">
            <span className="text-muted-foreground">d</span>
            <MassValue grams={d} unit={smallUnit} decimalPlaces={0} />
          </span>
        </>
      )}
      {n !== undefined ? (
        <span className="flex items-baseline gap-1">
          <span className="text-muted-foreground">n</span>
          <span className="tabular">{n}</span>
        </span>
      ) : null}
    </div>
  );
}
