import * as THREE from 'three';
import type { GridComponent } from '../components/GridComponent';
import type { PointerPosition, RaycastComponent } from '../components/RaycastComponent';
import { MIN_WALL_LENGTH, type WallSegment } from '../model/WallSegment';
import type { WallMesh } from '../objects/WallMesh';
import { HANDLE_COLOR, HANDLE_HOVER_COLOR } from '../objects/visualStyle';
import type { PlanPoint, WallEnd } from '../types/geometry';
import { ceilToStep } from '../utils/math';

/** Handle radius as a fraction of camera distance, so handles keep a usable on-screen size. */
const HANDLE_SCREEN_SCALE = 0.012;
const HANDLE_MIN_RADIUS = 0.08;
const HANDLE_MAX_RADIUS = 0.6;

interface DragState {
  readonly end: WallEnd;
  readonly original: WallSegment;
}

type HandleMesh = THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;

/**
 * Endpoint handles for resizing one wall along its own axis. The handles sit
 * on top of each wall end and are drawn over geometry so they stay visible.
 * Dragging projects the pointer onto the horizontal plane at the handle's
 * height, snaps it to the grid, and asks the wall's segment for a valid resize;
 * the opposite endpoint never moves.
 */
export class WallResizeTool {
  private wall: WallMesh | null = null;
  private drag: DragState | null = null;
  private hoveredEnd: WallEnd | null = null;

  private readonly geometry = new THREE.SphereGeometry(1, 20, 12);
  private readonly handles: Readonly<Record<WallEnd, HandleMesh>>;
  private readonly cameraPosition = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly raycast: RaycastComponent,
    private readonly grid: GridComponent,
  ) {
    this.handles = { start: this.createHandle('start'), end: this.createHandle('end') };
  }

  get target(): WallMesh | null {
    return this.wall;
  }

  get isDragging(): boolean {
    return this.drag !== null;
  }

  get draggedEnd(): WallEnd | null {
    return this.drag?.end ?? null;
  }

  /** Shows handles for `wall`, or removes them when null. Cancels any drag in progress. */
  attach(wall: WallMesh | null): void {
    if (this.drag) this.cancelDrag();
    this.wall = wall;
    this.setHoveredEnd(null);
    for (const handle of Object.values(this.handles)) {
      if (wall) this.scene.add(handle);
      else handle.removeFromParent();
    }
    this.sync();
  }

  /** Repositions handles after the wall changed (for example, a new height). */
  sync(): void {
    if (!this.wall) return;
    const elevation = this.wall.getHeight();
    for (const end of ['start', 'end'] as const) {
      const point = this.wall.getSegment().endpoint(end);
      this.handles[end].position.set(point.x, elevation, point.z);
    }
  }

  hitTest(pointer: PointerPosition): WallEnd | null {
    if (!this.wall) return null;
    const [hit] = this.raycast.intersectObjects(pointer, [this.handles.start, this.handles.end]);
    if (!hit) return null;
    return hit.object === this.handles.start ? 'start' : 'end';
  }

  setHoveredEnd(end: WallEnd | null): void {
    this.hoveredEnd = end;
    for (const key of ['start', 'end'] as const) {
      const active = key === end || key === this.drag?.end;
      this.handles[key].material.color.setHex(active ? HANDLE_HOVER_COLOR : HANDLE_COLOR);
    }
  }

  get hovered(): WallEnd | null {
    return this.hoveredEnd;
  }

  beginDrag(end: WallEnd): void {
    if (!this.wall) return;
    this.drag = { end, original: this.wall.getSegment() };
    this.setHoveredEnd(end);
  }

  /**
   * Moves the dragged endpoint to the snapped pointer position.
   * Returns the snapped moving endpoint, or null if the pointer is off the grid.
   */
  dragTo(pointer: PointerPosition): PlanPoint | null {
    if (!this.wall || !this.drag) return null;
    const point = this.grid.pointerToGrid(pointer, this.wall.getHeight());
    if (!point) return null;

    const minLength = ceilToStep(MIN_WALL_LENGTH, this.grid.spacing);
    const resized = this.wall.getSegment().resizeEndpoint(this.drag.end, point, minLength);
    this.wall.setSegment(resized);
    this.sync();
    return resized.endpoint(this.drag.end);
  }

  /** Finishes the drag. Returns true if the wall's length changed. */
  endDrag(): boolean {
    if (!this.wall || !this.drag) return false;
    const changed = !this.wall.getSegment().equals(this.drag.original);
    this.drag = null;
    this.setHoveredEnd(null);
    return changed;
  }

  /** Aborts the drag and restores the wall to its pre-drag endpoints. */
  cancelDrag(): void {
    if (!this.wall || !this.drag) return;
    this.wall.setSegment(this.drag.original);
    this.drag = null;
    this.setHoveredEnd(null);
    this.sync();
  }

  /** Keeps handles at a roughly constant screen size. */
  update(camera: THREE.Camera): void {
    if (!this.wall) return;
    camera.getWorldPosition(this.cameraPosition);
    for (const handle of Object.values(this.handles)) {
      const radius = THREE.MathUtils.clamp(
        handle.position.distanceTo(this.cameraPosition) * HANDLE_SCREEN_SCALE,
        HANDLE_MIN_RADIUS,
        HANDLE_MAX_RADIUS,
      );
      handle.scale.setScalar(radius);
    }
  }

  dispose(): void {
    this.attach(null);
    for (const handle of Object.values(this.handles)) handle.material.dispose();
    this.geometry.dispose();
  }

  private createHandle(end: WallEnd): HandleMesh {
    const material = new THREE.MeshBasicMaterial({ color: HANDLE_COLOR, depthTest: false, transparent: true });
    const handle = new THREE.Mesh(this.geometry, material);
    handle.name = `resize-handle-${end}`;
    handle.renderOrder = 10;
    return handle;
  }
}
