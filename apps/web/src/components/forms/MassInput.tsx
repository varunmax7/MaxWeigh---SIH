'use client';

import { type Dec, type DisplayUnit, formatMass, MassParseError, parseMass } from '@tula/engine';
import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * A mass field that parses units and shows the canonical value
 * (implementation.md §7.6). Typed text ("10 kg", "500 g", or a bare number
 * assumed to be `assumedUnit`) is parsed with `@tula/engine`'s `parseMass`
 * on every change; `onChange` only ever fires with the canonical `Dec`
 * grams string it produced — never a raw, unparsed string.
 */
export function MassInput({
  id,
  label,
  value,
  onChange,
  assumedUnit = 'g',
  displayUnit = 'g',
  required,
  className,
}: {
  id?: string;
  label: string;
  value: Dec | null;
  onChange: (value: Dec | null) => void;
  /** Unit assumed when the typed text carries no unit suffix. */
  assumedUnit?: DisplayUnit;
  /** Unit the canonical confirmation line is shown in. */
  displayUnit?: DisplayUnit;
  required?: boolean;
  className?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [raw, setRaw] = useState(() => (value ? formatMass(value, displayUnit, 3) : ''));
  const [error, setError] = useState<string | null>(null);

  function handleChange(text: string) {
    setRaw(text);
    if (!text.trim()) {
      setError(null);
      onChange(null);
      return;
    }
    try {
      const grams = parseMass(text, assumedUnit);
      setError(null);
      onChange(grams);
    } catch (parseError) {
      setError(parseError instanceof MassParseError ? parseError.message : 'Not a valid mass.');
    }
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : `${inputId}-canonical`}
        placeholder={`e.g. 10 ${assumedUnit}`}
        required={required}
        className="tabular"
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-fail">
          {error}
        </p>
      ) : value ? (
        <p id={`${inputId}-canonical`} className="tabular text-xs text-muted-foreground">
          {formatMass(value, displayUnit, 3)}
        </p>
      ) : null}
    </div>
  );
}
