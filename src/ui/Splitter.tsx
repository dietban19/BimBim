import { useRef, type KeyboardEvent, type PointerEvent, type ReactElement } from 'react';
import { clamp } from '../utils/math';

interface SplitterProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  /** +1 if dragging right grows the panel (left panel), -1 if it shrinks it (right panel). */
  readonly direction: 1 | -1;
  readonly onChange: (value: number) => void;
}

const KEYBOARD_STEP = 16;

/** Vertical drag handle between two panels; also operable with arrow keys. */
export function Splitter({ label, value, min, max, direction, onChange }: SplitterProps): ReactElement {
  const start = useRef<{ x: number; value: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    start.current = { x: event.clientX, value };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!start.current) return;
    onChange(clamp(start.current.value + (event.clientX - start.current.x) * direction, min, max));
  };

  const onPointerUp = (): void => {
    start.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const sign = event.key === 'ArrowRight' ? 1 : -1;
    onChange(clamp(value + sign * direction * KEYBOARD_STEP, min, max));
  };

  return (
    <div
      className="splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    />
  );
}
