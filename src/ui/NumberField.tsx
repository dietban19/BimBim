import { useId, useState, type KeyboardEvent, type ReactElement } from 'react';
import type { DimensionResult } from '../types/editor';
import { roundTo } from '../utils/math';
import { validateDimension, type DimensionLimits } from '../utils/validation';

interface NumberFieldProps {
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly limits: DimensionLimits;
  readonly step: number;
  /** Applies a parsed value; returns the authoritative result from the model. */
  readonly onCommit: (value: number) => DimensionResult;
}

function format(value: number): string {
  return String(roundTo(value, 3));
}

/**
 * Text-based numeric input with units. Valid input is applied on every
 * keystroke so geometry updates immediately; invalid input shows an inline
 * error and is reverted to the model value on blur or Escape.
 * Arrow Up/Down step the value (Shift for 10x).
 */
export function NumberField({ label, value, unit, limits, step, onCommit }: NumberFieldProps): ReactElement {
  const id = useId();
  const errorId = `${id}-error`;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = (text: string): void => {
    setDraft(text);
    const parsed = validateDimension(text, limits);
    const result = parsed.ok ? onCommit(parsed.value) : parsed;
    setError(result.ok ? null : result.error);
  };

  const revert = (): void => {
    setDraft(null);
    setError(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      revert();
      event.currentTarget.blur();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const delta = (event.key === 'ArrowUp' ? step : -step) * (event.shiftKey ? 10 : 1);
      const next = roundTo(Math.min(limits.max, Math.max(limits.min, value + delta)), 3);
      apply(format(next));
    }
  };

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className={`field__input-wrap${error ? ' field__input-wrap--invalid' : ''}`}>
        <input
          id={id}
          className="field__input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={draft ?? format(value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => apply(event.target.value)}
          onBlur={revert}
          onKeyDown={onKeyDown}
        />
        <span className="field__unit" aria-hidden="true">
          {unit}
        </span>
      </div>
      {error && (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface ReadOnlyFieldProps {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
}

export function ReadOnlyField({ label, value, unit }: ReadOnlyFieldProps): ReactElement {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <output className="field__readonly">
        <span>{value}</span>
        {unit && <span className="field__unit">{unit}</span>}
      </output>
    </div>
  );
}
