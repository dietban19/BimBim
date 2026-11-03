import { describe, expect, it } from 'vitest';
import { WALL_HEIGHT_LIMITS, WALL_THICKNESS_LIMITS } from '../model/wallDimensions';
import { validateDimension } from './validation';

describe('validateDimension', () => {
  it('accepts valid numbers and numeric strings', () => {
    expect(validateDimension(3, WALL_HEIGHT_LIMITS)).toEqual({ ok: true, value: 3 });
    expect(validateDimension(' 2.75 ', WALL_HEIGHT_LIMITS)).toEqual({ ok: true, value: 2.75 });
    expect(validateDimension('.3', WALL_THICKNESS_LIMITS)).toEqual({ ok: true, value: 0.3 });
  });

  it.each(['', '   ', 'abc', '1.2.3', '0x10', '1e2', '3m'])('rejects non-numeric input %j', (input) => {
    expect(validateDimension(input, WALL_HEIGHT_LIMITS).ok).toBe(false);
  });

  it('rejects zero and negative values', () => {
    expect(validateDimension(0, WALL_HEIGHT_LIMITS).ok).toBe(false);
    expect(validateDimension('-1', WALL_HEIGHT_LIMITS).ok).toBe(false);
  });

  it('rejects non-finite values', () => {
    expect(validateDimension(Number.NaN, WALL_HEIGHT_LIMITS).ok).toBe(false);
    expect(validateDimension(Number.POSITIVE_INFINITY, WALL_HEIGHT_LIMITS).ok).toBe(false);
  });

  it('rejects values outside the limits', () => {
    expect(validateDimension(WALL_HEIGHT_LIMITS.max + 1, WALL_HEIGHT_LIMITS).ok).toBe(false);
    expect(validateDimension(WALL_THICKNESS_LIMITS.min / 2, WALL_THICKNESS_LIMITS).ok).toBe(false);
  });

  it('names the field in the error message', () => {
    const result = validateDimension('x', WALL_THICKNESS_LIMITS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/^Thickness/);
  });
});
