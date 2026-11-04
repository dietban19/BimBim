import type { WallEnd } from '../types/geometry';
import type { JunctionWall } from './wallJunctions';

export const STUD_WIDTH = 0.038;
export const PLATE_THICKNESS = 0.038;
export const STUD_SPACING = 16 * 0.0254;
const EPSILON = 1e-6;

export type CornerRole = 'none' | 'through' | 'butt';

export interface FramingCorner {
  readonly role: 'through' | 'butt';
  /** Direction of the adjoining wall on the perpendicular world axis. */
  readonly interiorSide: -1 | 1;
  readonly neighborThickness: number;
}

export interface FramingCorners {
  readonly start: FramingCorner | null;
  readonly end: FramingCorner | null;
}

export const NO_FRAMING_CORNERS: FramingCorners = { start: null, end: null };

/**
 * Only a two-wall, endpoint-to-endpoint L gets California-corner framing.
 * An offset alone cannot identify a corner or tell us its interior side.
 * T-junctions, including split runs, need a separate backing detail.
 */
export function resolveFramingCorners(walls: readonly JunctionWall[]): FramingCorners[] {
  return walls.map((wall, index) => {
    const atEnd = (end: WallEnd): FramingCorner | null => {
      const point = wall[end];
      const incident = walls.filter((other, otherIndex) => {
        if (index === otherIndex) return false;
        const axis = other.orientation;
        const cross = axis === 'x' ? 'z' : 'x';
        return Math.abs(point[cross] - other.start[cross]) < EPSILON &&
          point[axis] >= Math.min(other.start[axis], other.end[axis]) - EPSILON &&
          point[axis] <= Math.max(other.start[axis], other.end[axis]) + EPSILON;
      });
      const other = incident[0];
      if (incident.length !== 1 || !other || other.orientation === wall.orientation) return null;
      const samePoint = (which: WallEnd): boolean =>
        Math.abs(point.x - other[which].x) < EPSILON &&
        Math.abs(point.z - other[which].z) < EPSILON;
      const otherEnd = samePoint('start') ? 'end' : samePoint('end') ? 'start' : null;
      if (!otherEnd) return null;
      const cross = wall.orientation === 'x' ? 'z' : 'x';
      return {
        role: wall.orientation === 'x' ? 'through' : 'butt',
        interiorSide: other[otherEnd][cross] > point[cross] ? 1 : -1,
        neighborThickness: other.thickness,
      };
    };
    return { start: atEnd('start'), end: atEnd('end') };
  });
}

export interface FramingMember {
  readonly name: string;
  readonly kind: 'plate' | 'stud' | 'nailer';
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface FramingOptions {
  readonly length: number;
  readonly height: number;
  readonly depth: number;
  /** Corners mapped to local -X/+X ends and local depth direction. */
  readonly left?: FramingCorner | null;
  readonly right?: FramingCorner | null;
}

/** Shared member layout for 3D geometry and the framing elevation. Metres. */
export function buildWallFraming({ length, height, depth, left, right }: FramingOptions): FramingMember[] {
  const studHeight = height - 2 * PLATE_THICKNESS;
  if (studHeight <= 0 || length < 2 * STUD_WIDTH) return [];
  const members: FramingMember[] = [];
  const add = (name: string, kind: FramingMember['kind'], width: number, memberHeight: number,
    memberDepth: number, x: number, y = 0, z = 0): void => {
    members.push({ name, kind, width, height: memberHeight, depth: memberDepth, x, y, z });
  };
  add('Bottom plate', 'plate', length, PLATE_THICKNESS, depth, 0, -height / 2 + PLATE_THICKNESS / 2);
  add('Top plate', 'plate', length, PLATE_THICKNESS, depth, 0, height / 2 - PLATE_THICKNESS / 2);
  const leftCenter = -length / 2 + STUD_WIDTH / 2;
  const rightCenter = length / 2 - STUD_WIDTH / 2;
  add('Left end stud', 'stud', STUD_WIDTH, studHeight, depth, leftCenter);
  add('Right end stud', 'stud', STUD_WIDTH, studHeight, depth, rightCenter);

  const clearOfStuds = (x: number, width: number): boolean => members.every((m) =>
    m.kind === 'plate' || Math.abs(m.x - x) >= (m.width + width) / 2 - EPSILON);

  for (const [label, corner, endCenter, direction] of [
    ['Left', left, leftCenter, 1], ['Right', right, rightCenter, -1],
  ] as const) {
    if (corner?.role !== 'through' || depth < STUD_WIDTH) continue;
    // The turned stud touches the end stud and lies flat against the interior
    // face. Its return reaches past the butt wall's inside face by one stud
    // thickness, leaving a nailing surface and an accessible insulation pocket.
    const width = corner.neighborThickness;
    const x = endCenter + direction * (STUD_WIDTH + width) / 2;
    if (!clearOfStuds(x, width)) continue; // Never force overlapping wood into a short wall.
    add(`${label} corner nailer`, 'nailer', width, studHeight, STUD_WIDTH,
      x, 0, corner.interiorSide * (depth - STUD_WIDTH) / 2);
  }

  // Preserve the layout grid; omit any station occupied by a corner assembly.
  for (let index = 1; ; index++) {
    const x = leftCenter + index * STUD_SPACING;
    if (x > rightCenter - STUD_WIDTH + EPSILON) break;
    if (clearOfStuds(x, STUD_WIDTH)) {
      add(`Layout stud ${index}`, 'stud', STUD_WIDTH, studHeight, depth, x);
    }
  }
  return members;
}
