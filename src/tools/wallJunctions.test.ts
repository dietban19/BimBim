import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WallSegment } from '../model/WallSegment';
import { DEFAULT_WALL_THICKNESS } from '../model/wallDimensions';
import { WallMesh } from '../objects/WallMesh';
import type { PlanPoint } from '../types/geometry';
import { applyWallJunctions } from './wallJunctions';

const HALF = DEFAULT_WALL_THICKNESS / 2;

function makeWall(start: PlanPoint, end: PlanPoint): WallMesh {
  return new WallMesh({ segment: WallSegment.create(start, end) });
}

/** Footprint of the built geometry, which is what the drawing shows. */
function plan(wall: WallMesh): THREE.Box3 {
  wall.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(wall, true);
}

/** Array access that fails the test instead of widening the type to undefined. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Nothing at index ${index}`);
  return item;
}

/** Overlap of two footprints on the ground plane; 0 when they only share a face. */
function overlapArea(a: THREE.Box3, b: THREE.Box3): number {
  const x = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
  const z = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
  return x > 0 && z > 0 ? x * z : 0;
}

describe('applyWallJunctions', () => {
  // The L in the reference drawing: an upright wall and a wall running away
  // from its foot, drawn in all four combinations of order and direction.
  const corner = { x: 0, z: 0 };
  const upwards: [PlanPoint, PlanPoint] = [{ x: 0, z: -5 }, corner];
  const rightwards: [PlanPoint, PlanPoint] = [corner, { x: 5, z: 0 }];

  it.each([
    ['as drawn', false, false, false],
    ['upright wall drawn first', true, false, false],
    ['upright wall drawn the other way', false, true, false],
    ['other wall drawn the other way', false, false, true],
    ['both walls drawn the other way', true, true, true],
  ])('closes the corner with the %s', (_label, swapOrder, flipUpright, flipAlong) => {
    const upright = makeWall(...(flipUpright ? ([upwards[1], upwards[0]] as const) : upwards));
    const along = makeWall(...(flipAlong ? ([rightwards[1], rightwards[0]] as const) : rightwards));

    applyWallJunctions(swapOrder ? [upright, along] : [along, upright]);

    const uprightPlan = plan(upright);
    const alongPlan = plan(along);

    // The X wall runs through: it reaches the far face of the upright wall.
    expect(alongPlan.min.x).toBeCloseTo(-HALF);
    expect(alongPlan.max.x).toBeCloseTo(5);
    // The upright wall butts against its face instead of crossing it.
    expect(uprightPlan.max.z).toBeCloseTo(-HALF);
    expect(uprightPlan.min.z).toBeCloseTo(-5);
    // The outside of the corner is square, and the corner is filled once.
    expect(uprightPlan.min.x).toBeCloseTo(alongPlan.min.x);
    expect(overlapArea(uprightPlan, alongPlan)).toBeCloseTo(0);
  });

  it('closes the mirrored corner from the drawing', () => {
    // A wall arriving from the left at the foot of an upright wall.
    const along = makeWall({ x: -5, z: 0 }, corner);
    const upright = makeWall(corner, { x: 0, z: -5 });
    applyWallJunctions([along, upright]);

    expect(plan(along).max.x).toBeCloseTo(HALF);
    expect(plan(upright).max.z).toBeCloseTo(-HALF);
    expect(overlapArea(plan(along), plan(upright))).toBeCloseTo(0);
  });

  it('closes all four corners of a room', () => {
    const corners: PlanPoint[] = [
      { x: 0, z: 0 },
      { x: 6, z: 0 },
      { x: 6, z: 4 },
      { x: 0, z: 4 },
    ];
    const walls = corners.map((point, index) =>
      makeWall(point, at(corners, (index + 1) % corners.length)),
    );
    applyWallJunctions(walls);

    const boxes = walls.map(plan);
    const top = at(boxes, 0);
    const right = at(boxes, 1);
    const bottom = at(boxes, 2);
    const left = at(boxes, 3);

    for (const horizontal of [top, bottom]) {
      expect(horizontal.min.x).toBeCloseTo(-HALF);
      expect(horizontal.max.x).toBeCloseTo(6 + HALF);
    }
    for (const vertical of [left, right]) {
      expect(vertical.min.z).toBeCloseTo(HALF);
      expect(vertical.max.z).toBeCloseTo(4 - HALF);
    }

    // No gaps: the room's outline is an unbroken rectangle.
    const outline = new THREE.Box3();
    for (const box of boxes) outline.union(box);
    expect(outline.min.x).toBeCloseTo(-HALF);
    expect(outline.max.x).toBeCloseTo(6 + HALF);
    expect(outline.min.z).toBeCloseTo(-HALF);
    expect(outline.max.z).toBeCloseTo(4 + HALF);

    // No doubled-up corners either.
    for (const [a, b] of [
      [top, left],
      [top, right],
      [bottom, left],
      [bottom, right],
    ] as const) {
      expect(overlapArea(a, b)).toBeCloseTo(0);
    }
  });

  it('re-opens a wall when its neighbour is deleted', () => {
    const along = makeWall({ x: 0, z: 0 }, { x: 5, z: 0 });
    const upright = makeWall({ x: 0, z: 0 }, { x: 0, z: -5 });

    applyWallJunctions([along, upright]);
    expect(plan(along).min.x).toBeCloseTo(-HALF);

    applyWallJunctions([along]);
    expect(plan(along).min.x).toBeCloseTo(0);
    expect(along.getLength()).toBeCloseTo(5);
  });

  it('closes the corner a resize moves a wall into, and opens the one it leaves', () => {
    const along = makeWall({ x: 0, z: 0 }, { x: 5, z: 0 });
    const upright = makeWall({ x: 5, z: 0 }, { x: 5, z: -5 });
    applyWallJunctions([along, upright]);
    expect(plan(along).max.x).toBeCloseTo(5 + HALF);

    // Drag the shared end of the X wall back: the walls no longer meet.
    along.setSegment(along.getSegment().resizeEndpoint('end', { x: 3, z: 0 }, 0.5));
    applyWallJunctions([along, upright]);
    expect(plan(along).max.x).toBeCloseTo(3);
    expect(plan(upright).min.z).toBeCloseTo(-5);
    expect(plan(upright).max.z).toBeCloseTo(0);

    // Drag it back onto the upright wall and the corner closes again.
    along.setSegment(along.getSegment().resizeEndpoint('end', { x: 5, z: 0 }, 0.5));
    applyWallJunctions([along, upright]);
    expect(plan(along).max.x).toBeCloseTo(5 + HALF);
    expect(plan(upright).max.z).toBeCloseTo(-HALF);
  });

  it('follows a thickness change on either side of the corner', () => {
    const along = makeWall({ x: 0, z: 0 }, { x: 5, z: 0 });
    const upright = makeWall({ x: 0, z: 0 }, { x: 0, z: -5 });

    upright.setThickness(1);
    applyWallJunctions([along, upright]);
    expect(plan(along).min.x).toBeCloseTo(-0.5);
    expect(plan(upright).max.z).toBeCloseTo(-HALF);

    along.setThickness(0.6);
    applyWallJunctions([along, upright]);
    expect(plan(along).min.x).toBeCloseTo(-0.5);
    expect(plan(upright).max.z).toBeCloseTo(-0.3);
    expect(overlapArea(plan(along), plan(upright))).toBeCloseTo(0);
  });

  it('joins a wall that ends part way along another one', () => {
    const through = makeWall({ x: 0, z: 0 }, { x: 10, z: 0 });
    const stem = makeWall({ x: 4, z: 0 }, { x: 4, z: 5 });
    applyWallJunctions([through, stem]);

    expect(plan(through).min.x).toBeCloseTo(0);
    expect(plan(through).max.x).toBeCloseTo(10);
    expect(plan(stem).min.z).toBeCloseTo(HALF);
    expect(overlapArea(plan(through), plan(stem))).toBeCloseTo(0);
  });
});
