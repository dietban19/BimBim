import { describe, expect, it } from 'vitest';
import { ceilToStep, roundTo, snapPoint, snapValue } from './math';

describe('snapValue', () => {
  it('snaps to the nearest 0.5 m grid line', () => {
    expect(snapValue(1.2, 0.5)).toBe(1);
    expect(snapValue(1.26, 0.5)).toBe(1.5);
    expect(snapValue(-0.74, 0.5)).toBe(-0.5);
    expect(snapValue(-0.76, 0.5)).toBe(-1);
  });

  it('removes floating-point residue', () => {
    expect(snapValue(0.3, 0.1)).toBe(0.3);
    expect(snapValue(0.7000000001, 0.1)).toBe(0.7);
  });

  it('normalises negative zero', () => {
    expect(Object.is(snapValue(-0.1, 0.5), 0)).toBe(true);
  });

  it('rejects invalid spacing', () => {
    expect(() => snapValue(1, 0)).toThrow(RangeError);
    expect(() => snapValue(1, -0.5)).toThrow(RangeError);
    expect(() => snapValue(1, Number.NaN)).toThrow(RangeError);
  });
});

describe('snapPoint', () => {
  it('snaps both plan coordinates independently of each other', () => {
    expect(snapPoint({ x: 2.24, z: -3.76 }, 0.5)).toEqual({ x: 2, z: -4 });
  });
});

describe('ceilToStep', () => {
  it('returns the smallest grid multiple at or above the minimum', () => {
    expect(ceilToStep(0.1, 0.5)).toBe(0.5);
    expect(ceilToStep(0.5, 0.5)).toBe(0.5);
    expect(ceilToStep(0.6, 0.25)).toBe(0.75);
  });
});

describe('roundTo', () => {
  it('rounds to the requested decimals', () => {
    expect(roundTo(1.23456, 2)).toBe(1.23);
  });
});
