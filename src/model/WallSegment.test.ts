import { describe, expect, it } from 'vitest';
import { MIN_WALL_LENGTH, WallSegment, constrainToDominantAxis, orientationBetween } from './WallSegment';

describe('WallSegment creation', () => {
  it('computes length for X and Z walls', () => {
    expect(WallSegment.create({ x: -1, z: 2 }, { x: 3.5, z: 2 }).length).toBeCloseTo(4.5);
    expect(WallSegment.create({ x: 0, z: 4 }, { x: 0, z: -2 }).length).toBeCloseTo(6);
  });

  it('derives orientation from the endpoints', () => {
    expect(WallSegment.create({ x: 0, z: 0 }, { x: 2, z: 0 }).orientation).toBe('x');
    expect(WallSegment.create({ x: 1, z: 0 }, { x: 1, z: -3 }).orientation).toBe('z');
  });

  it('computes the midpoint', () => {
    expect(WallSegment.create({ x: 0, z: 1 }, { x: 4, z: 1 }).midpoint).toEqual({ x: 2, z: 1 });
  });

  it('rejects zero-length walls', () => {
    const result = WallSegment.tryCreate({ x: 1, z: 1 }, { x: 1, z: 1 });
    expect(result.ok).toBe(false);
  });

  it('rejects walls shorter than the minimum length', () => {
    const result = WallSegment.tryCreate({ x: 0, z: 0 }, { x: MIN_WALL_LENGTH / 2, z: 0 });
    expect(result.ok).toBe(false);
  });

  it('rejects diagonal walls', () => {
    expect(WallSegment.tryCreate({ x: 0, z: 0 }, { x: 2, z: 1 }).ok).toBe(false);
  });

  it('rejects non-finite coordinates', () => {
    expect(WallSegment.tryCreate({ x: 0, z: 0 }, { x: Number.POSITIVE_INFINITY, z: 0 }).ok).toBe(false);
    expect(WallSegment.tryCreate({ x: Number.NaN, z: 0 }, { x: 1, z: 0 }).ok).toBe(false);
  });

  it('throws from create for invalid input', () => {
    expect(() => WallSegment.create({ x: 0, z: 0 }, { x: 0, z: 0 })).toThrow(RangeError);
  });

  it('does not share endpoint objects with the caller', () => {
    const start = { x: 0, z: 0 };
    const segment = WallSegment.create(start, { x: 2, z: 0 });
    expect(segment.start).not.toBe(start);
    expect(segment.start).toEqual(start);
  });
});

describe('orientationBetween', () => {
  it('returns null for identical or diagonal points', () => {
    expect(orientationBetween({ x: 1, z: 1 }, { x: 1, z: 1 })).toBeNull();
    expect(orientationBetween({ x: 0, z: 0 }, { x: 1, z: 1 })).toBeNull();
  });
});

describe('constrainToDominantAxis', () => {
  it('locks to X when horizontal travel dominates', () => {
    expect(constrainToDominantAxis({ x: 0, z: 0 }, { x: 3, z: 1 })).toEqual({ x: 3, z: 0 });
  });

  it('locks to Z when depth travel dominates', () => {
    expect(constrainToDominantAxis({ x: 1, z: 1 }, { x: 1.5, z: -4 })).toEqual({ x: 1, z: -4 });
  });

  it('favours X on a tie', () => {
    expect(constrainToDominantAxis({ x: 0, z: 0 }, { x: 2, z: 2 })).toEqual({ x: 2, z: 0 });
  });
});

describe('WallSegment.resizeEndpoint', () => {
  const xWall = WallSegment.create({ x: 0, z: 1 }, { x: 4, z: 1 });
  const zWall = WallSegment.create({ x: 2, z: 0 }, { x: 2, z: -3 });

  it('moves the end point and keeps the start fixed', () => {
    const resized = xWall.resizeEndpoint('end', { x: 6, z: 1 }, 0.5);
    expect(resized.start).toEqual({ x: 0, z: 1 });
    expect(resized.end).toEqual({ x: 6, z: 1 });
    expect(resized.length).toBeCloseTo(6);
  });

  it('moves the start point and keeps the end fixed', () => {
    const resized = xWall.resizeEndpoint('start', { x: -2, z: 1 }, 0.5);
    expect(resized.start).toEqual({ x: -2, z: 1 });
    expect(resized.end).toEqual({ x: 4, z: 1 });
  });

  it('preserves orientation by projecting off-axis targets', () => {
    const resized = xWall.resizeEndpoint('end', { x: 5, z: 7 }, 0.5);
    expect(resized.orientation).toBe('x');
    expect(resized.end).toEqual({ x: 5, z: 1 });

    const resizedZ = zWall.resizeEndpoint('end', { x: -9, z: -5 }, 0.5);
    expect(resizedZ.orientation).toBe('z');
    expect(resizedZ.end).toEqual({ x: 2, z: -5 });
  });

  it('clamps to the minimum length instead of collapsing', () => {
    const resized = xWall.resizeEndpoint('end', { x: 0, z: 1 }, 0.5);
    expect(resized.length).toBeCloseTo(0.5);
    expect(resized.start).toEqual({ x: 0, z: 1 });
  });

  it('never flips past the fixed endpoint', () => {
    const resized = xWall.resizeEndpoint('end', { x: -3, z: 1 }, 0.5);
    expect(resized.end.x).toBeCloseTo(0.5);
    expect(resized.length).toBeGreaterThan(0);

    const resizedStart = zWall.resizeEndpoint('start', { x: 2, z: -10 }, 0.5);
    expect(resizedStart.start.z).toBeCloseTo(-2.5);
    expect(resizedStart.end).toEqual({ x: 2, z: -3 });
  });

  it('never goes below the absolute minimum wall length', () => {
    const resized = xWall.resizeEndpoint('end', { x: 0, z: 1 }, 0);
    expect(resized.length).toBeCloseTo(MIN_WALL_LENGTH);
  });
});
