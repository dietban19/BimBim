import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WallSegment } from '../model/WallSegment';
import { DEFAULT_WALL_HEIGHT, DEFAULT_WALL_THICKNESS } from '../model/wallDimensions';
import { WallMesh } from './WallMesh';

function worldBounds(wall: WallMesh): THREE.Box3 {
  wall.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(wall, true);
}

describe('WallMesh', () => {
  it('uses the default height and thickness', () => {
    const wall = new WallMesh({ segment: WallSegment.create({ x: 0, z: 0 }, { x: 4, z: 0 }) });
    expect(wall.getHeight()).toBe(DEFAULT_WALL_HEIGHT);
    expect(wall.getThickness()).toBe(DEFAULT_WALL_THICKNESS);
    expect(wall.getLength()).toBeCloseTo(4);
    expect(wall.getOrientation()).toBe('x');
  });

  it('stands on the ground plane with geometry matching its dimensions', () => {
    const wall = new WallMesh({ segment: WallSegment.create({ x: 1, z: 2 }, { x: 1, z: -2 }) });
    const box = worldBounds(wall);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.y).toBeCloseTo(DEFAULT_WALL_HEIGHT);
    // Z-axis wall: length runs along Z, thickness along X.
    expect(box.max.z - box.min.z).toBeCloseTo(4);
    expect(box.max.x - box.min.x).toBeCloseTo(DEFAULT_WALL_THICKNESS);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(1);
  });

  it('updates geometry when endpoints change', () => {
    const wall = new WallMesh({ segment: WallSegment.create({ x: 0, z: 0 }, { x: 2, z: 0 }) });
    const result = wall.setEndpoints({ x: 0, z: 0 }, { x: 0, z: 5 });
    expect(result.ok).toBe(true);
    expect(wall.getOrientation()).toBe('z');
    expect(wall.getLength()).toBeCloseTo(5);
    const box = worldBounds(wall);
    expect(box.max.z - box.min.z).toBeCloseTo(5);
  });

  it('rejects invalid endpoints and keeps the previous geometry', () => {
    const wall = new WallMesh({ segment: WallSegment.create({ x: 0, z: 0 }, { x: 3, z: 0 }) });
    expect(wall.setEndpoints({ x: 1, z: 1 }, { x: 1, z: 1 }).ok).toBe(false);
    expect(wall.setEndpoints({ x: 0, z: 0 }, { x: 2, z: 2 }).ok).toBe(false);
    expect(wall.getLength()).toBeCloseTo(3);
    expect(wall.getStart()).toEqual({ x: 0, z: 0 });
  });

  it('applies valid height and thickness changes to the geometry', () => {
    const wall = new WallMesh({ segment: WallSegment.create({ x: 0, z: 0 }, { x: 3, z: 0 }) });
    expect(wall.setHeight(4.5).ok).toBe(true);
    expect(wall.setThickness(0.2).ok).toBe(true);
    const box = worldBounds(wall);
    expect(box.max.y).toBeCloseTo(4.5);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.z - box.min.z).toBeCloseTo(0.2);
  });

  it('rejects invalid dimensions without changing the wall', () => {
    const wall = new WallMesh({ segment: WallSegment.create({ x: 0, z: 0 }, { x: 3, z: 0 }) });
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(wall.setHeight(value).ok).toBe(false);
      expect(wall.setThickness(value).ok).toBe(false);
    }
    expect(wall.getHeight()).toBe(DEFAULT_WALL_HEIGHT);
    expect(wall.getThickness()).toBe(DEFAULT_WALL_THICKNESS);
  });

  it('builds its geometry from the junction offsets, keeping the drawn centreline', () => {
    const wall = new WallMesh({ segment: WallSegment.create({ x: 0, z: 0 }, { x: 4, z: 0 }) });
    wall.setJunctionOffsets({ start: 0.15, end: -0.15 });

    // The centreline the user drew is untouched, so the Inspector still agrees.
    expect(wall.getStart()).toEqual({ x: 0, z: 0 });
    expect(wall.getLength()).toBeCloseTo(4);

    const box = worldBounds(wall);
    expect(box.min.x).toBeCloseTo(-0.15);
    expect(box.max.x).toBeCloseTo(3.85);
    expect(wall.getXZBounds().minX).toBeCloseTo(-0.15);
    expect(wall.getXZBounds().maxX).toBeCloseTo(3.85);
  });

  it('offsets a Z wall along its own axis', () => {
    const wall = new WallMesh({ segment: WallSegment.create({ x: 1, z: 5 }, { x: 1, z: 1 }) });
    wall.setJunctionOffsets({ start: 0.15, end: -0.15 });

    const box = worldBounds(wall);
    expect(box.max.z).toBeCloseTo(5.15);
    expect(box.min.z).toBeCloseTo(1.15);
    expect(box.max.x - box.min.x).toBeCloseTo(DEFAULT_WALL_THICKNESS);
  });

  it('keeps junction offsets when the wall is resized', () => {
    const wall = new WallMesh({ segment: WallSegment.create({ x: 0, z: 0 }, { x: 4, z: 0 }) });
    wall.setJunctionOffsets({ start: 0.15, end: 0 });
    wall.setEndpoints({ x: 0, z: 0 }, { x: 6, z: 0 });

    const box = worldBounds(wall);
    expect(box.min.x).toBeCloseTo(-0.15);
    expect(box.max.x).toBeCloseTo(6);
  });

  it('tracks selection and hover state independently', () => {
    const wall = new WallMesh({ segment: WallSegment.create({ x: 0, z: 0 }, { x: 3, z: 0 }) });
    const defaultColor = wall.material.color.getHex();
    wall.setHovered(true);
    const hoverColor = wall.material.color.getHex();
    wall.setSelected(true);
    expect(wall.isHovered && wall.isSelected).toBe(true);
    expect(wall.material.color.getHex()).not.toBe(hoverColor);
    wall.setSelected(false);
    wall.setHovered(false);
    expect(wall.material.color.getHex()).toBe(defaultColor);
  });

  it('gives each wall a unique id and disposes idempotently', () => {
    const a = new WallMesh({ segment: WallSegment.create({ x: 0, z: 0 }, { x: 1, z: 0 }) });
    const b = new WallMesh({ segment: WallSegment.create({ x: 0, z: 0 }, { x: 1, z: 0 }) });
    expect(a.bimId).not.toBe(b.bimId);

    const scene = new THREE.Scene();
    scene.add(a);
    a.dispose();
    a.dispose();
    expect(a.isDisposed).toBe(true);
    expect(a.parent).toBeNull();
    expect(b.isDisposed).toBe(false);
  });

  it('does not consume visible numbering for preview walls', () => {
    const first = new WallMesh({ segment: WallSegment.create({ x: 0, z: 0 }, { x: 1, z: 0 }) });
    new WallMesh({ segment: WallSegment.create({ x: 0, z: 0 }, { x: 1, z: 0 }), preview: true });
    const second = new WallMesh({ segment: WallSegment.create({ x: 0, z: 0 }, { x: 1, z: 0 }) });
    const sequence = (wall: WallMesh) => Number(wall.name.split(' ')[1]);
    expect(sequence(second)).toBe(sequence(first) + 1);
  });
});
