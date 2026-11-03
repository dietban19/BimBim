import * as THREE from 'three';
import { Component } from '../engine/Component';
import type { World } from '../engine/World';
import {
  GRID_AXIS_X_COLOR,
  GRID_AXIS_Z_COLOR,
  GRID_CURSOR_COLOR,
  GRID_MAJOR_COLOR,
  GRID_MINOR_COLOR,
} from '../objects/visualStyle';
import type { PlanPoint } from '../types/geometry';
import { snapPoint } from '../utils/math';
import { RaycastComponent, type PointerPosition } from './RaycastComponent';

export interface GridOptions {
  /** Edge length of the square grid, in metres. */
  readonly size?: number;
  /** Snap interval and minor line spacing, in metres. */
  readonly spacing?: number;
  /** Draw a major line every N minor cells. */
  readonly majorEvery?: number;
}

const DEFAULTS = { size: 40, spacing: 0.5, majorEvery: 2 } as const;

/**
 * The ground-plane grid on XZ. Renders the lines, snaps plan positions, and
 * shows a cursor marker at the snapped point. Grid coordinates are world
 * coordinates, so they do not depend on the camera.
 */
export class GridComponent extends Component {
  static override readonly dependencies = [RaycastComponent];

  readonly size: number;
  readonly spacing: number;
  readonly majorEvery: number;

  private lines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> | null = null;
  private cursor: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;

  constructor(world: World, options: GridOptions = {}) {
    super(world);
    this.size = options.size ?? DEFAULTS.size;
    this.spacing = options.spacing ?? DEFAULTS.spacing;
    this.majorEvery = options.majorEvery ?? DEFAULTS.majorEvery;

    if (!(this.spacing > 0) || !(this.size >= this.spacing) || !Number.isInteger(this.majorEvery) || this.majorEvery < 1) {
      throw new RangeError('GridComponent requires size >= spacing > 0 and an integer majorEvery >= 1.');
    }
  }

  get halfSize(): number {
    return this.size / 2;
  }

  override init(): void {
    this.lines = this.createLines();
    this.cursor = this.createCursor();
    this.world.scene.add(this.lines, this.cursor);
  }

  snap(point: PlanPoint): PlanPoint {
    return snapPoint(point, this.spacing);
  }

  contains(point: PlanPoint): boolean {
    const half = this.halfSize + 1e-9;
    return Math.abs(point.x) <= half && Math.abs(point.z) <= half;
  }

  /** Snapped grid point under the pointer, or null if the pointer is off the grid. */
  pointerToGrid(pointer: PointerPosition, elevation = 0): PlanPoint | null {
    const hit = this.world.get(RaycastComponent).intersectHorizontalPlane(pointer, elevation);
    if (!hit) return null;
    const snapped = this.snap(hit);
    return this.contains(snapped) ? snapped : null;
  }

  /** Shows the hover marker at a grid point, or hides it when `point` is null. */
  setCursor(point: PlanPoint | null): void {
    if (!this.cursor) return;
    this.cursor.visible = point !== null;
    if (point) this.cursor.position.set(point.x, 0.002, point.z);
  }

  override dispose(): void {
    for (const object of [this.lines, this.cursor]) {
      if (!object) continue;
      object.removeFromParent();
      object.geometry.dispose();
      object.material.dispose();
    }
    this.lines = null;
    this.cursor = null;
  }

  private createLines(): THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
    const half = this.halfSize;
    const cells = Math.round(this.size / this.spacing);
    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();

    for (let i = 0; i <= cells; i++) {
      const offset = -half + i * this.spacing;
      const index = i - cells / 2;
      const isAxis = Math.abs(index) < 1e-9;
      const isMajor = Math.abs(index % this.majorEvery) < 1e-9;

      // Line parallel to X (constant Z). The Z = 0 line is the X axis.
      color.setHex(isAxis ? GRID_AXIS_X_COLOR : isMajor ? GRID_MAJOR_COLOR : GRID_MINOR_COLOR);
      positions.push(-half, 0, offset, half, 0, offset);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);

      // Line parallel to Z (constant X). The X = 0 line is the Z axis.
      color.setHex(isAxis ? GRID_AXIS_Z_COLOR : isMajor ? GRID_MAJOR_COLOR : GRID_MINOR_COLOR);
      positions.push(offset, 0, -half, offset, 0, half);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true }));
    lines.name = 'grid';
    return lines;
  }

  private createCursor(): THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> {
    const radius = this.spacing * 0.22;
    const geometry = new THREE.RingGeometry(radius * 0.6, radius, 24);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: GRID_CURSOR_COLOR, depthTest: false, transparent: true });
    const cursor = new THREE.Mesh(geometry, material);
    cursor.name = 'grid-cursor';
    cursor.renderOrder = 5;
    cursor.visible = false;
    return cursor;
  }
}
