import type { PlanPoint, WallAxis, WallEnd } from '../types/geometry';
import { distance, pointsEqual } from '../utils/math';

/** Walls shorter than this are rejected as degenerate. */
export const MIN_WALL_LENGTH = 0.1;

export type SegmentResult =
  | { readonly ok: true; readonly segment: WallSegment }
  | { readonly ok: false; readonly error: string };

/**
 * Immutable plan-view centreline of a straight, axis-aligned wall.
 * Contains no rendering concerns so that all wall math can be unit tested.
 */
export class WallSegment {
  private constructor(
    readonly start: PlanPoint,
    readonly end: PlanPoint,
  ) {}

  static tryCreate(start: PlanPoint, end: PlanPoint): SegmentResult {
    if (![start.x, start.z, end.x, end.z].every(Number.isFinite)) {
      return { ok: false, error: 'Wall endpoints must be finite coordinates.' };
    }
    if (pointsEqual(start, end)) {
      return { ok: false, error: 'Wall start and end points must be different.' };
    }
    if (orientationBetween(start, end) === null) {
      return { ok: false, error: 'Walls must run along the X or Z axis.' };
    }
    if (distance(start, end) < MIN_WALL_LENGTH) {
      return { ok: false, error: `Walls must be at least ${MIN_WALL_LENGTH} m long.` };
    }
    return { ok: true, segment: new WallSegment({ ...start }, { ...end }) };
  }

  static create(start: PlanPoint, end: PlanPoint): WallSegment {
    const result = WallSegment.tryCreate(start, end);
    if (!result.ok) throw new RangeError(result.error);
    return result.segment;
  }

  get length(): number {
    return distance(this.start, this.end);
  }

  get orientation(): WallAxis {
    // Validated at construction, so an axis always exists.
    return orientationBetween(this.start, this.end) ?? 'x';
  }

  get midpoint(): PlanPoint {
    return { x: (this.start.x + this.end.x) / 2, z: (this.start.z + this.end.z) / 2 };
  }

  endpoint(which: WallEnd): PlanPoint {
    return which === 'start' ? this.start : this.end;
  }

  oppositeEnd(which: WallEnd): PlanPoint {
    return which === 'start' ? this.end : this.start;
  }

  /**
   * Moves one endpoint towards `target` while keeping the other fixed.
   * The target is projected onto the wall's axis so orientation is preserved,
   * and the wall cannot shrink below `minLength` or flip past its fixed end.
   */
  resizeEndpoint(which: WallEnd, target: PlanPoint, minLength: number): WallSegment {
    const fixed = this.oppositeEnd(which);
    const moving = this.endpoint(which);
    const axis = this.orientation;

    const direction = Math.sign(axisValue(moving, axis) - axisValue(fixed, axis));
    const requested = (axisValue(target, axis) - axisValue(fixed, axis)) * direction;
    const extent = Math.max(requested, minLength, MIN_WALL_LENGTH);
    const movedValue = axisValue(fixed, axis) + extent * direction;

    const moved: PlanPoint = axis === 'x' ? { x: movedValue, z: fixed.z } : { x: fixed.x, z: movedValue };
    return which === 'start' ? WallSegment.create(moved, fixed) : WallSegment.create(fixed, moved);
  }

  equals(other: WallSegment): boolean {
    return pointsEqual(this.start, other.start) && pointsEqual(this.end, other.end);
  }
}

/** Returns the axis two points share a line along, or null if they are diagonal or identical. */
export function orientationBetween(a: PlanPoint, b: PlanPoint, epsilon = 1e-9): WallAxis | null {
  const sameZ = Math.abs(a.z - b.z) <= epsilon;
  const sameX = Math.abs(a.x - b.x) <= epsilon;
  if (sameZ && !sameX) return 'x';
  if (sameX && !sameZ) return 'z';
  return null;
}

/**
 * Constrains a free pointer position to the dominant axis from `start`,
 * producing an axis-aligned end point. Ties favour the X axis.
 */
export function constrainToDominantAxis(start: PlanPoint, target: PlanPoint): PlanPoint {
  const dx = Math.abs(target.x - start.x);
  const dz = Math.abs(target.z - start.z);
  return dx >= dz ? { x: target.x, z: start.z } : { x: start.x, z: target.z };
}

function axisValue(point: PlanPoint, axis: WallAxis): number {
  return axis === 'x' ? point.x : point.z;
}
