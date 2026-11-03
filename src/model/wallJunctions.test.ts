import { describe, expect, it } from 'vitest';
import type { PlanPoint, WallAxis } from '../types/geometry';
import {
  junctionEndpoints,
  resolveJunctions,
  wallFootprint,
  wouldWallOverlapExisting,
  type JunctionWall,
  type XZBounds,
} from './wallJunctions';

const THICKNESS = 0.3;
const HALF = THICKNESS / 2;

function wall(
  start: PlanPoint,
  end: PlanPoint,
  thickness = THICKNESS,
): JunctionWall {
  const orientation: WallAxis = start.z === end.z ? 'x' : 'z';
  return { start, end, orientation, thickness };
}

/** Reverses the direction a wall was drawn in, without moving it. */
function reversed(input: JunctionWall): JunctionWall {
  return { ...input, start: input.end, end: input.start };
}

function footprints(walls: readonly JunctionWall[]): XZBounds[] {
  const offsets = resolveJunctions(walls);
  return walls.map((input, index) => wallFootprint(input, offsets[index]));
}

/** Array access that fails the test instead of widening the type to undefined. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Nothing at index ${index}`);
  return item;
}

function expectBounds(actual: XZBounds, expected: XZBounds): void {
  expect(actual.minX).toBeCloseTo(expected.minX);
  expect(actual.maxX).toBeCloseTo(expected.maxX);
  expect(actual.minZ).toBeCloseTo(expected.minZ);
  expect(actual.maxZ).toBeCloseTo(expected.maxZ);
}

describe('resolveJunctions', () => {
  it('leaves a wall with no neighbours exactly as it was drawn', () => {
    const lonely = wall({ x: 0, z: 0 }, { x: 4, z: 0 });
    expect(resolveJunctions([lonely])).toEqual([{ start: 0, end: 0 }]);
    expectBounds(wallFootprint(lonely), {
      minX: 0,
      maxX: 4,
      minZ: -HALF,
      maxZ: HALF,
    });
  });

  it('leaves walls that do not reach each other alone', () => {
    const across = wall({ x: 0, z: 0 }, { x: 4, z: 0 });
    // Ends one grid step short of the X wall, and runs past its far end.
    const apart = wall({ x: 4.5, z: 0 }, { x: 4.5, z: 5 });
    expect(resolveJunctions([across, apart])).toEqual([
      { start: 0, end: 0 },
      { start: 0, end: 0 },
    ]);
  });

  it('closes an L corner by running the X wall through and butting the Z wall', () => {
    const upright = wall({ x: 0, z: -5 }, { x: 0, z: 0 });
    const along = wall({ x: 0, z: 0 }, { x: 5, z: 0 });

    expect(resolveJunctions([upright, along])).toEqual([
      { start: 0, end: -HALF },
      { start: HALF, end: 0 },
    ]);

    const bounds = footprints([upright, along]);
    // The X wall reaches the outside of the corner...
    expectBounds(at(bounds, 1), {
      minX: -HALF,
      maxX: 5,
      minZ: -HALF,
      maxZ: HALF,
    });
    // ...and the Z wall stops against its face, so neither doubles up.
    expectBounds(at(bounds, 0), {
      minX: -HALF,
      maxX: HALF,
      minZ: -5,
      maxZ: -HALF,
    });
  });

  it('closes a corner the same way whichever wall was drawn first', () => {
    const upright = wall({ x: 0, z: -5 }, { x: 0, z: 0 });
    const along = wall({ x: 0, z: 0 }, { x: 5, z: 0 });

    const uprightDrawnFirst = footprints([upright, along]);
    const alongDrawnFirst = footprints([along, upright]);

    expectBounds(at(alongDrawnFirst, 1), at(uprightDrawnFirst, 0));
    expectBounds(at(alongDrawnFirst, 0), at(uprightDrawnFirst, 1));
  });

  it('closes a corner the same way whichever direction each wall was drawn in', () => {
    const upright = wall({ x: 0, z: -5 }, { x: 0, z: 0 });
    const along = wall({ x: 0, z: 0 }, { x: 5, z: 0 });
    const expected = footprints([upright, along]);

    for (const pair of [
      [reversed(upright), along],
      [upright, reversed(along)],
      [reversed(upright), reversed(along)],
    ] as const) {
      const actual = footprints(pair);
      expectBounds(at(actual, 0), at(expected, 0));
      expectBounds(at(actual, 1), at(expected, 1));
    }
  });

  it('closes every corner of an L whichever way the corner points', () => {
    for (const alongSign of [1, -1]) {
      for (const uprightSign of [1, -1]) {
        const along = wall({ x: 0, z: 0 }, { x: 5 * alongSign, z: 0 });
        const upright = wall({ x: 0, z: 0 }, { x: 0, z: 5 * uprightSign });
        const bounds = footprints([along, upright]);
        const alongBounds = at(bounds, 0);
        const uprightBounds = at(bounds, 1);

        // The X wall always covers the corner square out to the Z wall's far face.
        expect(alongSign > 0 ? alongBounds.minX : alongBounds.maxX).toBeCloseTo(
          -HALF * alongSign,
        );
        // The Z wall always stops at the X wall's near face.
        expect(
          uprightSign > 0 ? uprightBounds.minZ : uprightBounds.maxZ,
        ).toBeCloseTo(HALF * uprightSign);
      }
    }
  });

  it('runs both X walls of a closed rectangle through all four corners', () => {
    const walls = [
      wall({ x: 0, z: 0 }, { x: 10, z: 0 }),
      wall({ x: 10, z: 0 }, { x: 10, z: 8 }),
      wall({ x: 10, z: 8 }, { x: 0, z: 8 }),
      wall({ x: 0, z: 8 }, { x: 0, z: 0 }),
    ];
    const bounds = footprints(walls);

    for (const horizontal of [at(bounds, 0), at(bounds, 2)]) {
      expect(horizontal.minX).toBeCloseTo(-HALF);
      expect(horizontal.maxX).toBeCloseTo(10 + HALF);
    }
    for (const vertical of [at(bounds, 1), at(bounds, 3)]) {
      expect(vertical.minZ).toBeCloseTo(HALF);
      expect(vertical.maxZ).toBeCloseTo(8 - HALF);
    }

    // Every corner is filled exactly once: no footprint overlaps another.
    walls.forEach((candidate, index) => {
      const others = walls.filter((_, other) => other !== index);
      expect(wouldWallOverlapExisting(candidate, others)).toBe(false);
    });
  });

  it('resolves the rectangle the same way whatever order it is drawn in', () => {
    const corners: PlanPoint[] = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 8 },
      { x: 0, z: 8 },
    ];
    const walls = corners.map((corner, index) =>
      wall(corner, at(corners, (index + 1) % corners.length)),
    );
    const expected = footprints(walls);

    // Drawn anticlockwise, starting from the far corner.
    const order = [3, 2, 1, 0];
    const actual = footprints(order.map((index) => reversed(at(walls, index))));

    order.forEach((original, index) => {
      expectBounds(at(actual, index), at(expected, original));
    });
  });

  it('butts a wall that ends against one that carries on past it', () => {
    const through = wall({ x: 0, z: 0 }, { x: 0, z: 10 });
    const stem = wall({ x: 0, z: 5 }, { x: 6, z: 5 });

    // The X wall would own a corner, but this is a T: the Z wall is continuous.
    expect(resolveJunctions([through, stem])).toEqual([
      { start: 0, end: 0 },
      { start: -HALF, end: 0 },
    ]);
    expect(at(footprints([through, stem]), 1).minX).toBeCloseTo(HALF);
  });

  it('butts a Z wall that ends against a continuous X wall', () => {
    const through = wall({ x: 0, z: 0 }, { x: 10, z: 0 });
    const stem = wall({ x: 4, z: 0 }, { x: 4, z: -6 });

    expect(resolveJunctions([through, stem])).toEqual([
      { start: 0, end: 0 },
      { start: -HALF, end: 0 },
    ]);
  });

  it('does not extend an X wall that its own run already carries past the corner', () => {
    const leftHalf = wall({ x: -5, z: 0 }, { x: 0, z: 0 });
    const rightHalf = wall({ x: 0, z: 0 }, { x: 5, z: 0 });
    const upright = wall({ x: 0, z: 0 }, { x: 0, z: 6 });

    expect(resolveJunctions([leftHalf, rightHalf, upright])).toEqual([
      { start: 0, end: 0 },
      { start: 0, end: 0 },
      { start: -HALF, end: 0 },
    ]);
    // The halves still meet exactly, with no overlap to reject.
    expect(wouldWallOverlapExisting(upright, [leftHalf, rightHalf])).toBe(false);
    expect(wouldWallOverlapExisting(rightHalf, [leftHalf, upright])).toBe(false);
  });

  it('measures each offset against the neighbour thickness, not its own', () => {
    const upright = wall({ x: 0, z: -5 }, { x: 0, z: 0 }, 1);
    const along = wall({ x: 0, z: 0 }, { x: 5, z: 0 }, 0.2);

    expect(resolveJunctions([upright, along])).toEqual([
      { start: 0, end: -0.1 },
      { start: 0.5, end: 0 },
    ]);
  });

  it('keeps a wall visible when its neighbours are thicker than it is long', () => {
    const left = wall({ x: 0, z: 0 }, { x: 0, z: 6 }, 4);
    const right = wall({ x: 1, z: 0 }, { x: 1, z: 6 }, 4);
    const between = wall({ x: 0, z: 3 }, { x: 1, z: 3 });

    const betweenBounds = at(footprints([left, right, between]), 2);
    expect(betweenBounds.maxX - betweenBounds.minX).toBeGreaterThan(0);
  });

  it('moves endpoints along the wall axis only', () => {
    const upright = wall({ x: 2, z: -5 }, { x: 2, z: 0 });
    const offsets = resolveJunctions([
      upright,
      wall({ x: 2, z: 0 }, { x: 7, z: 0 }),
    ]);
    const { start, end } = junctionEndpoints(upright, at(offsets, 0));

    expect(start).toEqual({ x: 2, z: -5 });
    expect(end.x).toBe(2);
    expect(end.z).toBeCloseTo(-HALF);
  });
});

describe('wouldWallOverlapExisting', () => {
  it('accepts a wall that joins an existing one at a corner, in either order', () => {
    const along = wall({ x: 0, z: 0 }, { x: 5, z: 0 });
    const upright = wall({ x: 5, z: 0 }, { x: 5, z: 5 });

    expect(wouldWallOverlapExisting(upright, [along])).toBe(false);
    expect(wouldWallOverlapExisting(along, [upright])).toBe(false);
  });

  it('accepts a wall that ends against the middle of another one', () => {
    const through = wall({ x: 0, z: 0 }, { x: 10, z: 0 });
    expect(
      wouldWallOverlapExisting(wall({ x: 4, z: 0 }, { x: 4, z: 5 }), [through]),
    ).toBe(false);
  });

  it('accepts walls that continue each other end to end', () => {
    const first = wall({ x: 0, z: 0 }, { x: 5, z: 0 });
    expect(
      wouldWallOverlapExisting(wall({ x: 5, z: 0 }, { x: 9, z: 0 }), [first]),
    ).toBe(false);
  });

  it('rejects a wall laid on top of another one', () => {
    const existing = wall({ x: 0, z: 0 }, { x: 10, z: 0 });
    expect(
      wouldWallOverlapExisting(wall({ x: 2, z: 0 }, { x: 6, z: 0 }), [existing]),
    ).toBe(true);
  });

  it('rejects a wall that crosses another one', () => {
    const existing = wall({ x: 0, z: 0 }, { x: 10, z: 0 });
    expect(
      wouldWallOverlapExisting(wall({ x: 5, z: -4 }, { x: 5, z: 4 }), [existing]),
    ).toBe(true);
  });
});
