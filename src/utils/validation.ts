import type { DimensionResult } from '../types/editor';

export interface DimensionLimits {
  readonly label: string;
  readonly min: number;
  readonly max: number;
}

/**
 * Parses and validates a user-provided dimension in metres.
 * Accepts numbers or strings (as typed into an input) and rejects empty,
 * non-numeric, non-finite, zero, negative and out-of-range values.
 */
export function validateDimension(input: number | string, limits: DimensionLimits): DimensionResult {
  const value = typeof input === 'number' ? input : parseNumber(input);

  if (value === null || Number.isNaN(value)) {
    return { ok: false, error: `${limits.label} must be a number.` };
  }
  if (!Number.isFinite(value)) {
    return { ok: false, error: `${limits.label} must be a finite number.` };
  }
  if (value <= 0) {
    return { ok: false, error: `${limits.label} must be greater than 0 m.` };
  }
  if (value < limits.min || value > limits.max) {
    return { ok: false, error: `${limits.label} must be between ${limits.min} m and ${limits.max} m.` };
  }
  return { ok: true, value };
}

function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  // Number() accepts strings like "0x1A" or "1e3"; restrict to plain decimals.
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
  return Number(trimmed);
}
