import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WallSegment } from '../model/WallSegment';
import { STUD_WIDTH } from '../model/wallFraming';
import { applyWallJunctions } from '../tools/wallJunctions';
import type { PlanPoint } from '../types/geometry';
import { WallMesh } from './WallMesh';
import { WoodMemberMesh } from './WoodMemberMesh';

function wall(start: PlanPoint, end: PlanPoint, reverse = false, thickness = 0.1397): WallMesh {
  return new WallMesh({ segment: WallSegment.create(...(reverse ? [end, start] as const : [start, end] as const)), thickness });
}

function studs(wall: WallMesh): WoodMemberMesh[] {
  const result: WoodMemberMesh[] = [];
  wall.traverse((object) => {
    if (object instanceof WoodMemberMesh && !object.name.includes('plate')) result.push(object);
  });
  return result;
}

describe('corner framing in world space', () => {
  const origin = { x: 2, z: 3 };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const reverseX of [false, true]) for (const reverseZ of [false, true]) {
      it(`forms an insulated L for quadrant ${sx},${sz}, reversed ${reverseX},${reverseZ}`, () => {
        const xWall = wall(origin, { x: origin.x + sx * 4, z: origin.z }, reverseX);
        const zWall = wall(origin, { x: origin.x, z: origin.z + sz * 4 }, reverseZ, 0.089);
        applyWallJunctions(reverseX ? [zWall, xWall] : [xWall, zWall]);
        xWall.updateMatrixWorld(true);
        zWall.updateMatrixWorld(true);
        const nailers = studs(xWall).filter((m) => m.name.includes('nailer'));
        expect(nailers).toHaveLength(1);
        expect(studs(zWall).filter((m) => m.name.includes('nailer'))).toHaveLength(0);
        const nailer = nailers[0];
        if (!nailer) throw new Error('Missing nailer');
        const bounds = new THREE.Box3().setFromObject(nailer);
        const worldCenter = bounds.getCenter(new THREE.Vector3());
        expect(worldCenter.z).toBeCloseTo(origin.z + sz * (0.1397 - STUD_WIDTH) / 2);
        expect(bounds.max.x - bounds.min.x).toBeCloseTo(0.089);
        expect(bounds.max.z - bounds.min.z).toBeCloseTo(STUD_WIDTH);
        // A full stud thickness remains exposed past the butt wall's inner face.
        expect(sx > 0 ? bounds.max.x : bounds.min.x).toBeCloseTo(origin.x + sx * (0.089 / 2 + STUD_WIDTH));
        const all = [...studs(xWall), ...studs(zWall)];
        const boxes = all.map((m) => new THREE.Box3().setFromObject(m));
        for (const [index, a] of boxes.entries()) for (const b of boxes.slice(index + 1)) {
          const intersection = a.clone().intersect(b).getSize(new THREE.Vector3());
          expect(Math.min(intersection.x, intersection.y, intersection.z)).toBeLessThan(1e-6);
        }
        const buttEnd = studs(zWall).find((m) => m.name === (sz > 0 ? 'Right end stud' : 'Left end stud'));
        if (!buttEnd) throw new Error('Missing butt end');
        const buttBounds = new THREE.Box3().setFromObject(buttEnd);
        expect(sz > 0 ? buttBounds.min.z : buttBounds.max.z).toBeCloseTo(origin.z + sz * 0.1397 / 2);
        xWall.dispose();
        zWall.dispose();
      });
    }
  }

  it('flips the nailer when a neighbour moves across the wall without changing offsets', () => {
    const xWall = wall({ x: 0, z: 0 }, { x: 4, z: 0 });
    const zWall = wall({ x: 0, z: 0 }, { x: 0, z: 4 });
    applyWallJunctions([xWall, zWall]);
    expect(xWall.getFramingMembers().find((m) => m.kind === 'nailer')?.z).toBeGreaterThan(0);
    zWall.setEndpoints({ x: 0, z: 0 }, { x: 0, z: -4 });
    applyWallJunctions([xWall, zWall]);
    expect(xWall.getFramingMembers().find((m) => m.kind === 'nailer')?.z).toBeLessThan(0);
    applyWallJunctions([xWall]);
    expect(xWall.getFramingMembers().some((m) => m.kind === 'nailer')).toBe(false);
    expect(xWall.getCornerRoles()).toEqual({ left: 'none', right: 'none' });
    xWall.dispose();
    zWall.dispose();
  });

  it('does not treat a pulled-back T stem as a California corner', () => {
    const xWall = wall({ x: -4, z: 0 }, { x: 4, z: 0 });
    const stem = wall({ x: 0, z: 0 }, { x: 0, z: 4 });
    applyWallJunctions([xWall, stem]);
    expect(stem.getBuiltLength()).toBeLessThan(stem.getLength());
    expect(stem.getCornerRoles()).toEqual({ left: 'none', right: 'none' });
    xWall.dispose();
    stem.dispose();
  });
});
