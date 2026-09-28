import { D, type Dec } from '@tula/engine';
import { cn } from '@/lib/utils';

/**
 * An error expressed in units of the verification scale interval `e`
 * (`EcInE`/`mpeInE` in `@tula/engine`'s `ErrorResult`), e.g. `"0.70 e"` —
 * the unit stays in muted colour after the value, same treatment as
 * `MassValue` (implementation.md §7.3).
 */
export function ErrorInE({
  value,
  decimalPlaces = 2,
  className,
}: {
  value: Dec;
  decimalPlaces?: number;
  className?: string;
}) {
  const formatted = D(value).toFixed(decimalPlaces);
  return (
    <span className={cn('tabular whitespace-nowrap text-right', className)}>
      {formatted} <span className="text-muted-foreground">e</span>
    </span>
  );
}
