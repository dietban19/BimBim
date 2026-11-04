import { describe, expect, it } from 'vitest';
import { buildWallFraming, resolveFramingCorners, STUD_SPACING, STUD_WIDTH, type FramingMember } from './wallFraming';
import type { JunctionWall } from './wallJunctions';

const through = { role: 'through', interiorSide: 1, neighborThickness: 0.1397 } as const;

function expectNoOverlappingWood(members: FramingMember[]): void {
  for (const [i, a] of members.entries()) {
    for (const b of members.slice(i + 1)) {
      const overlaps = (['x', 'y', 'z'] as const).map((axis, index) => {
        const dimension = (['width', 'height', 'depth'] as const)[index];
        if (!dimension) throw new Error('Missing dimension');
        return (a[dimension] + b[dimension]) / 2 - Math.abs(a[axis] - b[axis]);
      });
      expect(overlaps.some((overlap) => overlap <= 1e-6), `${a.name} overlaps ${b.name}`).toBe(true);
    }
  }
}

describe('California corner member layout', () => {
  it('turns the backing stud onto the inside face, leaving the insulation pocket open', () => {
    const members = buildWallFraming({ length: 3, height: 2.4, depth: 0.1397, left: through });
    const nailer = members.find((m) => m.kind === 'nailer');
    expect(nailer).toBeDefined();
    if (!nailer) return;
    expect(nailer.width).toBeCloseTo(0.1397);
    expect(nailer.depth).toBeCloseTo(STUD_WIDTH);
    expect(nailer.z + nailer.depth / 2).toBeCloseTo(0.1397 / 2);
    expect(nailer.x - nailer.width / 2).toBeCloseTo(-1.5 + STUD_WIDTH);
    expect(nailer.depth).toBeLessThan(0.1397);
    expectNoOverlappingWood(members);
  });

  it('keeps layout stations but skips those covered by a wide return at either end', () => {
    const members = buildWallFraming({ length: 3, height: 2.4, depth: 0.1397,
      left: { ...through, neighborThickness: 0.6 }, right: through });
    const layout = members.filter((m) => m.name.startsWith('Layout'));
    expect(layout.some((m) => m.name === 'Layout stud 1')).toBe(false);
    for (const m of layout) {
      const station = (m.x - (-1.5 + STUD_WIDTH / 2)) / STUD_SPACING;
      expect(station).toBeCloseTo(Math.round(station));
    }
    expectNoOverlappingWood(members);
  });

  it('does not force corner members into walls too short or thin to contain them', () => {
    for (const length of [0.08, 0.1, 0.5, 1]) {
      for (const depth of [0.02, 0.089, 0.1397]) {
        const members = buildWallFraming({ length, height: 2.4, depth, left: through, right: through });
        expectNoOverlappingWood(members);
        for (const m of members) {
          expect(Math.abs(m.x) + m.width / 2).toBeLessThanOrEqual(length / 2 + 1e-6);
          expect(Math.abs(m.z) + m.depth / 2).toBeLessThanOrEqual(depth / 2 + 1e-6);
        }
      }
    }
  });
});

describe('corner topology', () => {
  const horizontal: JunctionWall = { start: { x: 0, z: 0 }, end: { x: 4, z: 0 }, orientation: 'x', thickness: 0.1397 };
  const upright: JunctionWall = { start: { x: 0, z: 0 }, end: { x: 0, z: 4 }, orientation: 'z', thickness: 0.089 };

  it('carries the adjoining wall thickness and side, independently of offsets', () => {
    expect(resolveFramingCorners([horizontal, upright])).toEqual([
      { start: { role: 'through', interiorSide: 1, neighborThickness: 0.089 }, end: null },
      { start: { role: 'butt', interiorSide: 1, neighborThickness: 0.1397 }, end: null },
    ]);
  });

  it('excludes a continuous T and a T assembled from two collinear walls', () => {
    const continuing = { ...horizontal, start: { x: -4, z: 0 } };
    const left = { ...horizontal, end: { x: -4, z: 0 } };
    for (const walls of [[continuing, upright], [horizontal, left, upright]]) {
      for (const corners of resolveFramingCorners(walls)) expect(corners).toEqual({ start: null, end: null });
    }
  });
});
