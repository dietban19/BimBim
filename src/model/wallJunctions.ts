import type { PlanPoint, WallAxis, WallEnd } from '../types/geometry';

/**
 * Resolution of the corners where walls meet.
 *
 * Walls are drawn centreline to centreline, so two perpendicular walls that
 * share a corner point overlap over a half-thickness square and each one stops
 * at the other's centreline. Neither is what a plan should look like: the
 * outside of the corner must be closed and only one wall may own the square.
 *
 * The solver resolves that by moving each wall end along its own axis:
 *
 *  - At a corner (both walls end there) the wall running along **X** runs
 *    through and is extended to the far face of the wall it meets; the wall
 *    running along **Z** is pulled back to the near face of the X wall. The
 *    axis decides, never the drawing order or direction, so the same layout
 *    always resolves the same way.
 *  - Where a wall ends against another wall that carries on past the meeting
 *    point (a T), the wall that ends is always the one pulled back, whichever
 *    axis it runs along.
 *  - An X wall whose own run carries on past the corner is not extended: the
 *    rest of the run already covers the corner, so extending would double up.
 *
 * Offsets are derived from centrelines only, never from already-resolved
 * geometry, so resolving a layout is a pure function of the walls in it.
 */

/**
 * One wall centreline with the thickness it is drawn at: everything the solver
 * needs, without any dependency on how the wall is rendered.
 */
export interface JunctionWall {
  readonly start: PlanPoint;
  readonly end: PlanPoint;
  readonly orientation: WallAxis;
  readonly thickness: number;
}

/**
 * How far each end moves along the wall's own axis once its junctions are
 * resolved: positive extends past the centreline endpoint, negative pulls back.
 */
export interface JunctionOffsets {
  readonly start: number;
  readonly end: number;
}

export interface XZBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export const NO_JUNCTION_OFFSETS: JunctionOffsets = { start: 0, end: 0 };

/**
 * Tolerance for "these walls meet". Endpoints are snapped to the grid, so
 * connected walls coincide exactly; this only absorbs floating-point residue.
 */
const EPSILON = 1e-6;

/** A resolved wall always keeps some length, however thick its neighbours are. */
const MIN_RENDERED_LENGTH = 0.01;

/** Two footprints must share more than this to count as overlapping, so touching faces are fine. */
const OVERLAP_EPSILON = 1e-4;

/**
 * Resolves every wall against every other one.
 * Returns offsets positionally, one entry per input wall.
 */
export function resolveJunctions(
  walls: readonly JunctionWall[],
): JunctionOffsets[] {
  const frames = walls.map(toFrame);
  return frames.map((_, index) => ({
    start: resolveEnd(frames, index, 'start'),
    end: resolveEnd(frames, index, 'end'),
  }));
}

/** Resolves one wall against walls that are already placed. */
export function resolveJunctionsFor(
  wall: JunctionWall,
  others: readonly JunctionWall[],
): JunctionOffsets {
  return resolveJunctions([wall, ...others])[0] ?? NO_JUNCTION_OFFSETS;
}

/**
 * The endpoints a wall is actually built from: its centreline endpoints moved
 * by the junction offsets, clamped so the wall never collapses.
 */
export function junctionEndpoints(
  wall: JunctionWall,
  offsets: JunctionOffsets = NO_JUNCTION_OFFSETS,
): { start: PlanPoint; end: PlanPoint } {
  const axis = wall.orientation;
  const startAlong = alongValue(wall.start, axis);
  const endAlong = alongValue(wall.end, axis);
  const direction = endAlong >= startAlong ? 1 : -1;
  const cross = crossValue(wall.start, axis);

  let { start: startOffset, end: endOffset } = offsets;
  const shortfall =
    MIN_RENDERED_LENGTH -
    (Math.abs(endAlong - startAlong) + startOffset + endOffset);
  if (shortfall > 0) {
    startOffset += shortfall / 2;
    endOffset += shortfall / 2;
  }

  return {
    start: planPoint(axis, startAlong - direction * startOffset, cross),
    end: planPoint(axis, endAlong + direction * endOffset, cross),
  };
}

/** Footprint of a resolved wall on the ground plane, including its thickness. */
export function wallFootprint(
  wall: JunctionWall,
  offsets: JunctionOffsets = NO_JUNCTION_OFFSETS,
): XZBounds {
  const { start, end } = junctionEndpoints(wall, offsets);
  const half = wall.thickness / 2;

  if (wall.orientation === 'x') {
    return {
      minX: Math.min(start.x, end.x),
      maxX: Math.max(start.x, end.x),
      minZ: start.z - half,
      maxZ: start.z + half,
    };
  }
  return {
    minX: start.x - half,
    maxX: start.x + half,
    minZ: Math.min(start.z, end.z),
    maxZ: Math.max(start.z, end.z),
  };
}

/**
 * True when a candidate wall would sit on top of an existing one.
 *
 * The whole layout is resolved with the candidate included, because adding it
 * changes its neighbours too: a wall it joins makes room for it. Walls that
 * merely meet at a junction share a face and do not count as overlapping.
 */
export function wouldWallOverlapExisting(
  candidate: JunctionWall,
  existing: readonly JunctionWall[],
): boolean {
  const walls = [candidate, ...existing];
  const offsets = resolveJunctions(walls);
  const candidateBounds = wallFootprint(candidate, offsets[0]);

  return existing.some((wall, index) =>
    boundsOverlap(candidateBounds, wallFootprint(wall, offsets[index + 1])),
  );
}

/** A wall reduced to the axis it runs along, its extent on that axis and its offset from it. */
interface WallFrame {
  readonly axis: WallAxis;
  /** Coordinate on the perpendicular axis: the line the wall runs along. */
  readonly cross: number;
  readonly startAlong: number;
  readonly endAlong: number;
  readonly min: number;
  readonly max: number;
  readonly half: number;
}

function toFrame(wall: JunctionWall): WallFrame {
  const axis = wall.orientation;
  const startAlong = alongValue(wall.start, axis);
  const endAlong = alongValue(wall.end, axis);

  return {
    axis,
    cross: crossValue(wall.start, axis),
    startAlong,
    endAlong,
    min: Math.min(startAlong, endAlong),
    max: Math.max(startAlong, endAlong),
    half: wall.thickness / 2,
  };
}

function resolveEnd(
  frames: readonly WallFrame[],
  index: number,
  which: WallEnd,
): number {
  const wall = frames[index];
  if (!wall) return 0;

  const position = which === 'start' ? wall.startAlong : wall.endAlong;
  const opposite = which === 'start' ? wall.endAlong : wall.startAlong;
  // Positive points out of the wall, so an offset always reads as extend/pull back.
  const direction = Math.sign(position - opposite);
  if (direction === 0) return 0;

  let pullBack = 0;
  let pulledBack = false;
  let extension = 0;

  for (const [otherIndex, other] of frames.entries()) {
    if (otherIndex === index || other.axis === wall.axis) continue;

    // The perpendicular wall crosses this axis as a band of its own thickness.
    const bandMin = other.cross - other.half;
    const bandMax = other.cross + other.half;
    const reachesBand =
      position >= bandMin - EPSILON && position <= bandMax + EPSILON;
    const insideSpan =
      wall.cross >= other.min - EPSILON && wall.cross <= other.max + EPSILON;
    if (!reachesBand || !insideSpan) continue;

    const nearFace = direction > 0 ? bandMin : bandMax;
    const farFace = direction > 0 ? bandMax : bandMin;
    const carriesOn =
      wall.cross > other.min + EPSILON && wall.cross < other.max - EPSILON;

    if (!carriesOn && wall.axis === 'x') {
      // Corner: the X wall owns it, unless its own run already continues past.
      if (continuesPast(frames, index, position, direction)) continue;
      extension = Math.max(extension, (farFace - position) * direction);
    } else {
      pullBack = Math.min(pullBack, (nearFace - position) * direction);
      pulledBack = true;
    }
  }

  // Butting against a neighbour's face wins over closing a corner: a wall must
  // never be pushed through something that carries on past it.
  return pulledBack ? pullBack : extension;
}

/** True when another wall on the same line carries this wall's run past `position`. */
function continuesPast(
  frames: readonly WallFrame[],
  index: number,
  position: number,
  direction: number,
): boolean {
  const wall = frames[index];
  if (!wall) return false;

  return frames.some((other, otherIndex) => {
    if (otherIndex === index || other.axis !== wall.axis) return false;
    if (Math.abs(other.cross - wall.cross) > EPSILON) return false;
    if (position < other.min - EPSILON || position > other.max + EPSILON) {
      return false;
    }
    return direction > 0
      ? other.max > position + EPSILON
      : other.min < position - EPSILON;
  });
}

function boundsOverlap(a: XZBounds, b: XZBounds): boolean {
  const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);

  return overlapX > OVERLAP_EPSILON && overlapZ > OVERLAP_EPSILON;
}

function alongValue(point: PlanPoint, axis: WallAxis): number {
  return axis === 'x' ? point.x : point.z;
}

function crossValue(point: PlanPoint, axis: WallAxis): number {
  return axis === 'x' ? point.z : point.x;
}

function planPoint(axis: WallAxis, along: number, cross: number): PlanPoint {
  return axis === 'x' ? { x: along, z: cross } : { x: cross, z: along };
}
