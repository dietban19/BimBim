import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WallSegment } from '../model/WallSegment';
import { WallMesh } from '../objects/WallMesh';
import { PointerGesture } from './PointerGesture';
import { SelectionController } from './SelectionController';
import { WallPlacementTool } from './WallPlacementTool';

const sample = (clientX: number, clientY: number, button = 0) => ({
  pointerId: 1,
  button,
  clientX,
  clientY,
});

describe('PointerGesture', () => {
  it('treats a stationary primary press as a click', () => {
    const gesture = new PointerGesture();
    gesture.begin(sample(100, 100));
    expect(gesture.end(sample(102, 101))).toBe(true);
  });

  it('treats a drag as navigation, not a click', () => {
    const gesture = new PointerGesture();
    gesture.begin(sample(100, 100));
    gesture.track(sample(140, 120));
    expect(gesture.isDragging).toBe(true);
    // Returning to the start point after dragging still is not a click.
    expect(gesture.end(sample(100, 100))).toBe(false);
  });

  it('ignores non-primary buttons', () => {
    const gesture = new PointerGesture();
    gesture.begin(sample(10, 10, 2));
    expect(gesture.end(sample(10, 10, 2))).toBe(false);
  });
});

describe('SelectionController', () => {
  const makeWall = () =>
    new WallMesh({
      segment: WallSegment.create({ x: 0, z: 0 }, { x: 2, z: 0 }),
    });

  it('keeps a single selected object', () => {
    const selection = new SelectionController();
    const a = makeWall();
    const b = makeWall();
    selection.select(a);
    selection.select(b);
    expect(a.isSelected).toBe(false);
    expect(b.isSelected).toBe(true);
    expect(selection.selected).toBe(b);
  });

  it('forgets removed objects', () => {
    const selection = new SelectionController();
    const wall = makeWall();
    selection.select(wall);
    selection.hover(wall);
    selection.forget(wall);
    expect(selection.selected).toBeNull();
    expect(selection.hovered).toBeNull();
  });
});

describe('WallPlacementTool', () => {
  it('creates an axis-aligned segment from two points', () => {
    const scene = new THREE.Scene();
    const tool = new WallPlacementTool(scene, () => []);
    tool.begin({ x: 0, z: 0 });
    expect(tool.phase).toBe('awaiting-end');

    tool.updatePreview({ x: 3, z: 0.5 });
    expect(tool.previewLength).toBeCloseTo(3);

    const result = tool.commit({ x: 3, z: 0.5 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.segment.end).toEqual({ x: 3, z: 0 });
    expect(tool.phase).toBe('idle');
  });

  it('rejects a zero-length wall and stays ready for a valid end point', () => {
    const tool = new WallPlacementTool(new THREE.Scene(), () => []);
    tool.begin({ x: 1, z: 1 });
    expect(tool.commit({ x: 1, z: 1 }).ok).toBe(false);
    expect(tool.phase).toBe('awaiting-end');
  });

  it('commits the centreline as drawn where a wall joins an existing one', () => {
    const existing = new WallMesh({
      segment: WallSegment.create({ x: 0, z: 0 }, { x: 5, z: 0 }),
    });
    const tool = new WallPlacementTool(new THREE.Scene(), () => [existing]);

    tool.begin({ x: 5, z: 0 });
    const result = tool.commit({ x: 5, z: 4 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.segment.start).toEqual({ x: 5, z: 0 });
      expect(result.segment.end).toEqual({ x: 5, z: 4 });
    }
  });

  it('still rejects a wall drawn across an existing one', () => {
    const existing = new WallMesh({
      segment: WallSegment.create({ x: 0, z: 0 }, { x: 10, z: 0 }),
    });
    const tool = new WallPlacementTool(new THREE.Scene(), () => [existing]);

    tool.begin({ x: 4, z: -3 });
    const result = tool.commit({ x: 4, z: 3 });
    expect(result.ok).toBe(false);
  });

  it('removes preview geometry on cancel', () => {
    const scene = new THREE.Scene();
    const tool = new WallPlacementTool(scene, () => []);
    tool.begin({ x: 0, z: 0 });
    tool.updatePreview({ x: 0, z: 2 });
    expect(scene.children.some((child) => child instanceof WallMesh)).toBe(
      true,
    );

    tool.cancel();
    expect(tool.phase).toBe('idle');
    expect(scene.children.some((child) => child instanceof WallMesh)).toBe(
      false,
    );
  });
});
