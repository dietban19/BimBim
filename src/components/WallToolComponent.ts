import { Component } from '../engine/Component';
import { OpeningMesh } from '../objects/OpeningMesh';
import type { WallSegment } from '../model/WallSegment';
import { WallMesh } from '../objects/WallMesh';
import { PointerGesture } from '../tools/PointerGesture';
import { SelectionController } from '../tools/SelectionController';
import { applyWallJunctions } from '../tools/wallJunctions';
import { WallPlacementTool } from '../tools/WallPlacementTool';
import { WallResizeTool } from '../tools/WallResizeTool';
import type {
  DimensionResult,
  EditorState,
  OpeningKind,
  OpeningSummary,
  OpeningType,
  StatusMessage,
  ToolMode,
  WallSummary,
} from '../types/editor';
import type { PlanPoint } from '../types/geometry';
import { pointsEqual } from '../utils/math';
import { ObservableState } from '../utils/ObservableState';
import { GridComponent } from './GridComponent';
import { OrbitControlsComponent } from './OrbitControlsComponent';
import { RaycastComponent } from './RaycastComponent';

const INITIAL_STATE: EditorState = {
  mode: 'select',
  placement: 'idle',
  previewLength: null,
  walls: [],
  openings: [],
  selectedId: null,
  hoveredId: null,
  selectedOpeningId: null,
  pendingOpeningType: null,
  cursor: null,
  message: null,
};

function kindFromType(type: OpeningType): OpeningKind {
  return type.endsWith('-door') ? 'door' : 'window';
}

/**
 * Wall and opening editing workflow: Select, Draw Wall, Resize and Place Opening
 * modes. Translates pointer and keyboard input into operations on WallMesh and
 * OpeningMesh objects, owns both collections, and publishes an immutable
 * EditorState for the UI.
 */
export class WallToolComponent extends Component {
  static override readonly dependencies = [
    RaycastComponent,
    GridComponent,
    OrbitControlsComponent,
  ];

  readonly state = new ObservableState<EditorState>(INITIAL_STATE);

  private readonly walls = new Map<string, WallMesh>();
  private readonly openings = new Map<string, OpeningMesh>();
  private readonly selection = new SelectionController();
  private readonly gesture = new PointerGesture();
  private placement: WallPlacementTool | null = null;
  private resizer: WallResizeTool | null = null;
  private previewOpening: OpeningMesh | null = null;
  private pendingOpeningType: OpeningType | null = null;

  private get raycast(): RaycastComponent {
    return this.world.get(RaycastComponent);
  }

  private get grid(): GridComponent {
    return this.world.get(GridComponent);
  }

  private get orbit(): OrbitControlsComponent {
    return this.world.get(OrbitControlsComponent);
  }

  override init(): void {
    this.placement = new WallPlacementTool(this.world.scene, () =>
      this.walls.values(),
    );
    this.resizer = new WallResizeTool(
      this.world.scene,
      this.raycast,
      this.grid,
    );

    const canvas = this.world.canvas;
    canvas.addEventListener('pointerdown', this.onPointerDown, {
      capture: true,
    });
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('keydown', this.onKeyDown);
  }

  override update(): void {
    this.resizer?.update(this.world.camera);
  }

  override dispose(): void {
    const canvas = this.world.canvas;
    canvas.removeEventListener('pointerdown', this.onPointerDown, {
      capture: true,
    });
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerCancel);
    canvas.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('keydown', this.onKeyDown);

    this.placement?.dispose();
    this.resizer?.dispose();
    this.selection.clear();

    if (this.previewOpening) {
      this.previewOpening.dispose();
      this.previewOpening = null;
    }
    for (const opening of this.openings.values()) opening.dispose();
    this.openings.clear();

    for (const wall of this.walls.values()) {
      this.world.selectables.remove(wall);
      wall.dispose();
    }
    this.walls.clear();
    this.state.clearListeners();
  }

  // ---------------------------------------------------------------------------
  // Wall commands used by the UI and keyboard shortcuts
  // ---------------------------------------------------------------------------

  setMode(mode: ToolMode): void {
    if (mode === 'place-opening') return; // use beginOpeningPlacement instead
    const current = this.state.get().mode;
    if (mode === current) return;

    if (mode === 'resize' && !this.selectedWall) {
      this.publish({
        message: error('Select a wall before entering Resize mode.'),
      });
      return;
    }

    this.leaveMode(current);
    if (mode === 'resize') this.resizer?.attach(this.selectedWall);
    if (mode === 'draw-wall') this.selection.hover(null);
    this.updateCanvasCursor(mode);
    this.publish({ mode, message: null });
  }

  toggleResize(): void {
    this.setMode(this.state.get().mode === 'resize' ? 'select' : 'resize');
  }

  selectWall(id: string | null): void {
    const wall = id === null ? null : (this.walls.get(id) ?? null);
    console.log('SECELING');
    this.applySelection(wall);
  }

  /** Hover highlight driven from outside the viewport, e.g. the hierarchy list. */
  hoverWall(id: string | null): void {
    const wall = id === null ? null : (this.walls.get(id) ?? null);
    if (this.selection.hover(wall)) this.publish();
  }

  setWallHeight(id: string, height: number): DimensionResult {
    return this.editWall(id, (wall) => wall.setHeight(height));
  }

  setWallThickness(id: string, thickness: number): DimensionResult {
    return this.editWall(id, (wall) => wall.setThickness(thickness));
  }

  setWallLength(id: string, length: number): DimensionResult {
    return this.editWall(id, (wall) => {
      const start = wall.getStart();
      const end = wall.getEnd();
      const orientation = wall.getOrientation();
      // Keep start fixed; move end along the wall's axis in its original direction.
      const dir = orientation === 'x'
        ? Math.sign(end.x - start.x) || 1
        : Math.sign(end.z - start.z) || 1;
      const newEnd = orientation === 'x'
        ? { x: start.x + length * dir, z: start.z }
        : { x: start.x, z: start.z + length * dir };
      const result = wall.setEndpoints(start, newEnd);
      return result.ok ? { ok: true, value: length } : result;
    });
  }

  getStudMeasurements(id: string): Array<{ name: string; ocIn: number }> {
    const wall = this.walls.get(id);
    if (!wall) return [];
    const length = wall.getBuiltLength();
    const studWidth = 0.038;
    const studSpacing = 16 * 0.0254;
    const leftCenter  = -length / 2 + studWidth / 2;
    const rightCenter =  length / 2 - studWidth / 2;
    if (length < 2 * studWidth) return [];
    const toIn = (m: number) => m / 0.0254;
    const { left: leftCorner, right: rightCorner } = wall.getCornerRoles();

    const result: Array<{ name: string; ocIn: number }> = [
      { name: 'Left end stud', ocIn: 0 },
    ];

    if (leftCorner === 'through') {
      result.push({ name: 'Left corner nailer', ocIn: toIn(studWidth) });
    }

    const rightStopBefore = rightCorner === 'through'
      ? rightCenter - 2 * studWidth
      : rightCenter - studWidth;

    for (let i = 1; ; i++) {
      const x = leftCenter + i * studSpacing;
      if (x > rightStopBefore) break;
      result.push({ name: `Layout stud ${i}`, ocIn: toIn(x - leftCenter) });
    }

    if (rightCorner === 'through') {
      result.push({ name: 'Right corner nailer', ocIn: toIn((rightCenter - studWidth) - leftCenter) });
    }

    result.push({ name: 'Right end stud', ocIn: toIn(rightCenter - leftCenter) });
    return result;
  }

  showWallFraming(id: string): void {
    console.log('THIS IS THE WALL FRAMING', id);
    const wall = this.walls.get(id);
    console.log('wall', wall);
    if (!wall) return;

    console.log('Show framing for:', wall.toSummary());
    console.log('Geometry:', wall.geometry);
    console.log('Built footprint:', wall.getXZBounds());
    wall.setFramingVisible(true);
    this.publishWalls();
  }

  deleteWall(id: string): void {
    const wall = this.walls.get(id);
    if (!wall) return;
    const wasResizing =
      this.state.get().mode === 'resize' && this.resizer?.target === wall;

    if (this.resizer?.target === wall) {
      if (this.resizer.isDragging) this.endDragInteraction();
      this.resizer.attach(null);
    }

    // Cancel opening placement if the preview is attached to this wall
    if (this.previewOpening?.wallId === id) {
      this.previewOpening.dispose();
      this.previewOpening = null;
      this.pendingOpeningType = null;
    }

    // Dispose all openings on this wall before the wall itself is disposed
    for (const [openingId, opening] of [...this.openings.entries()]) {
      if (opening.wallId === id) {
        opening.dispose();
        this.openings.delete(openingId);
      }
    }

    this.selection.forget(wall);
    this.world.selectables.remove(wall);
    this.walls.delete(id);
    const name = wall.name;
    wall.dispose();

    if (wasResizing) this.updateCanvasCursor('select');
    this.publishWalls({
      ...(wasResizing ? { mode: 'select' as const } : {}),
      selectedOpeningId: null,
      message: info(`Deleted ${name}.`),
    });
  }

  deleteSelected(): void {
    const wall = this.selectedWall;
    if (wall) this.deleteWall(wall.bimId);
    else this.publish({ message: error('Nothing selected to delete.') });
  }

  // ---------------------------------------------------------------------------
  // Opening commands
  // ---------------------------------------------------------------------------

  beginOpeningPlacement(type: OpeningType): void {
    const wall = this.selectedWall;
    if (!wall) {
      this.publish({
        message: error('Select a wall first to place a door or window.'),
      });
      return;
    }

    const current = this.state.get().mode;
    this.leaveMode(current);

    this.pendingOpeningType = type;
    const kind = kindFromType(type);

    this.previewOpening = new OpeningMesh({
      kind,
      type,
      wallId: wall.bimId,
      offsetT: 0.5,
      preview: true,
    });
    wall.add(this.previewOpening);
    this.previewOpening.syncToWall(wall);

    this.updateCanvasCursor('place-opening');
    this.publish({
      mode: 'place-opening',
      pendingOpeningType: type,
      message: info('Click on the wall to place the opening. Esc cancels.'),
    });
  }

  selectOpening(id: string | null): void {
    const previousId = this.state.get().selectedOpeningId;
    if (previousId !== null) this.openings.get(previousId)?.setSelected(false);
    if (id !== null) this.openings.get(id)?.setSelected(true);
    this.publish({ selectedOpeningId: id });
  }

  setOpeningWidth(id: string, width: number): DimensionResult {
    return this.editOpening(id, (o) => o.setWidth(width));
  }

  setOpeningHeight(id: string, height: number): DimensionResult {
    return this.editOpening(id, (o) => o.setHeight(height));
  }

  setOpeningBottomHeight(id: string, height: number): DimensionResult {
    return this.editOpening(id, (o) => o.setBottomHeight(height));
  }

  deleteOpening(id: string): void {
    const opening = this.openings.get(id);
    if (!opening) return;
    const name = opening.name;
    opening.dispose();
    this.openings.delete(id);
    const wasSelected = this.state.get().selectedOpeningId === id;
    this.publishOpenings({
      ...(wasSelected ? { selectedOpeningId: null } : {}),
      message: info(`Deleted ${name}.`),
    });
  }

  // ---------------------------------------------------------------------------
  // Pointer handling
  // ---------------------------------------------------------------------------

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.gesture.begin(event);
    if (
      event.button !== 0 ||
      this.state.get().mode !== 'resize' ||
      !this.resizer
    )
      return;

    const end = this.resizer.hitTest(event);
    if (!end) return;

    this.gesture.cancel();
    this.orbit.setEnabled(false);
    this.world.canvas.setPointerCapture(event.pointerId);
    this.resizer.beginDrag(end);
    this.world.canvas.style.cursor = 'grabbing';
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.gesture.track(event);

    if (this.resizer?.isDragging) {
      const moved = this.resizer.dragTo(event);
      this.grid.setCursor(moved);
      const cursor = this.stableCursor(moved);
      if (cursor !== this.state.get().cursor) this.publishWalls({ cursor });
      return;
    }

    if (this.gesture.isDragging) return;

    const mode = this.state.get().mode;
    const gridPoint = this.grid.pointerToGrid(event);

    if (mode === 'draw-wall') {
      this.grid.setCursor(gridPoint);
      this.placement?.updatePreview(gridPoint);
      this.refreshJunctions();
      this.publish({
        cursor: this.stableCursor(gridPoint),
        previewLength: this.placement?.previewLength ?? null,
      });
      return;
    }

    if (mode === 'place-opening') {
      this.updateOpeningPreview(event);
      this.publish({ cursor: this.stableCursor(gridPoint) });
      return;
    }

    const handle =
      mode === 'resize' ? (this.resizer?.hitTest(event) ?? null) : null;
    this.resizer?.setHoveredEnd(handle);
    const hovered = handle ? null : this.raycast.pickSelectable(event);
    this.selection.hover(hovered);
    this.world.canvas.style.cursor = handle ? 'grab' : hovered ? 'pointer' : '';
    this.publish({ cursor: this.stableCursor(gridPoint) });
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.resizer?.isDragging) {
      this.finishResizeDrag(event.pointerId);
      return;
    }
    if (this.gesture.end(event)) this.handleClick(event);
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    this.gesture.cancel();
    if (!this.resizer?.isDragging) return;
    const wall = this.resizer.target;
    this.resizer.cancelDrag();
    this.releaseDrag(event.pointerId);
    if (wall) this.syncOpeningsToWall(wall);
    this.publishWalls({ message: info('Resize cancelled.') });
  };

  private readonly onPointerLeave = (): void => {
    if (this.resizer?.isDragging) return;
    this.grid.setCursor(null);
    this.placement?.updatePreview(null);
    this.refreshJunctions();
    this.selection.hover(null);
    this.resizer?.setHoveredEnd(null);
    this.publish({ cursor: null, previewLength: null });
  };

  private handleClick(event: PointerEvent): void {
    const mode = this.state.get().mode;
    if (mode === 'draw-wall') {
      this.handlePlacementClick(this.grid.pointerToGrid(event));
      return;
    }
    if (mode === 'place-opening') {
      this.handleOpeningPlacementClick(event);
      return;
    }
    const picked = this.raycast.pickSelectable(event);
    this.applySelection(picked instanceof WallMesh ? picked : null);
  }

  private handlePlacementClick(point: PlanPoint | null): void {
    const placement = this.placement;
    if (!placement) return;
    if (!point) {
      this.publish({
        message: error('Click inside the grid to place a wall point.'),
      });
      return;
    }

    if (placement.phase === 'idle') {
      placement.begin(point);
      this.publish({
        placement: placement.phase,
        previewLength: null,
        message: null,
      });
      return;
    }

    const result = placement.commit(point);
    if (!result.ok) {
      this.publish({ message: error(result.error) });
      return;
    }
    const wall = this.createWall(result.segment);
    this.selection.select(wall);
    this.publishWalls({
      placement: placement.phase,
      previewLength: null,
      message: info(`Created ${wall.name} (${wall.getLength().toFixed(2)} m).`),
    });
  }

  private handleOpeningPlacementClick(event: PointerEvent): void {
    const wall = this.selectedWall;
    const type = this.pendingOpeningType;
    if (!wall || !type) return;

    const t = this.pointerOnWall(event, wall);
    if (t === null) return;

    this.createOpening(wall, type, t);
  }

  private finishResizeDrag(pointerId: number): void {
    const resizer = this.resizer;
    if (!resizer) return;
    const changed = resizer.endDrag();
    this.releaseDrag(pointerId);
    const wall = resizer.target;
    if (changed && wall) this.syncOpeningsToWall(wall);
    this.publishWalls({
      message:
        changed && wall
          ? info(`${wall.name} resized to ${wall.getLength().toFixed(2)} m.`)
          : null,
    });
  }

  private releaseDrag(pointerId: number): void {
    const canvas = this.world.canvas;
    if (canvas.hasPointerCapture(pointerId))
      canvas.releasePointerCapture(pointerId);
    this.endDragInteraction();
  }

  /** Restores camera navigation and cursor feedback after a handle drag ends for any reason. */
  private endDragInteraction(): void {
    this.orbit.setEnabled(true);
    this.grid.setCursor(null);
    this.world.canvas.style.cursor = '';
  }

  // ---------------------------------------------------------------------------
  // Keyboard handling
  // ---------------------------------------------------------------------------

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    if (isEditableTarget(event.target)) return;

    switch (event.key) {
      case 'Escape':
        this.handleEscape();
        break;
      case 'Delete':
      case 'Backspace':
        if (!this.selectedWall) return;
        this.deleteSelected();
        break;
      case 'v':
      case 'V':
        this.setMode('select');
        break;
      case 'w':
      case 'W':
        this.setMode('draw-wall');
        break;
      case 'r':
      case 'R':
        this.toggleResize();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /** Escape backs out one level: drag → unfinished wall → opening placement → tool → selection. */
  private handleEscape(): void {
    const mode = this.state.get().mode;
    if (this.resizer?.isDragging) {
      this.resizer.cancelDrag();
      this.endDragInteraction();
      this.publishWalls({ message: info('Resize cancelled.') });
    } else if (
      mode === 'draw-wall' &&
      this.placement?.phase === 'awaiting-end'
    ) {
      this.placement.cancel();
      this.grid.setCursor(null);
      this.refreshJunctions();
      this.publish({
        placement: 'idle',
        previewLength: null,
        message: info('Wall placement cancelled.'),
      });
    } else if (mode === 'place-opening') {
      this.leaveMode('place-opening');
      this.updateCanvasCursor('select');
      this.publish({
        mode: 'select',
        pendingOpeningType: null,
        message: info('Opening placement cancelled.'),
      });
    } else if (mode !== 'select') {
      this.setMode('select');
    } else if (this.selectedWall) {
      this.applySelection(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private get selectedWall(): WallMesh | null {
    const selected = this.selection.selected;
    return selected instanceof WallMesh ? selected : null;
  }

  private createWall(segment: WallSegment): WallMesh {
    const wall = new WallMesh({ segment });
    this.world.scene.add(wall);
    this.world.selectables.add(wall);
    this.walls.set(wall.bimId, wall);
    return wall;
  }

  private createOpening(
    wall: WallMesh,
    type: OpeningType,
    offsetT: number,
  ): void {
    const kind = kindFromType(type);
    const opening = new OpeningMesh({
      kind,
      type,
      wallId: wall.bimId,
      offsetT,
    });
    wall.add(opening);
    opening.syncToWall(wall);
    this.openings.set(opening.bimId, opening);
    this.publishOpenings({
      message: info(`Added ${opening.name} to ${wall.name}.`),
    });
  }

  private applySelection(wall: WallMesh | null): void {
    const mode = this.state.get().mode;
    const changed = this.selection.select(wall);

    if (changed) {
      console.log('Selected wall:', wall?.toSummary() ?? null);

      if (wall) {
        console.log('Wall ID:', wall.bimId);
        console.log('WallMesh:', wall);
        console.log('Built footprint:', wall.getXZBounds());
      }
    }

    if (mode === 'resize') {
      if (wall) {
        this.resizer?.attach(wall);
      } else {
        this.leaveMode('resize');
        this.updateCanvasCursor('select');
        this.publish({ mode: 'select', message: null });
        return;
      }
    }
    this.publish({ message: null });
  }

  private editWall(
    id: string,
    edit: (wall: WallMesh) => DimensionResult,
  ): DimensionResult {
    const wall = this.walls.get(id);
    if (!wall) return { ok: false, error: 'That wall no longer exists.' };
    const result = edit(wall);
    if (result.ok) {
      if (this.resizer?.target === wall) this.resizer.sync();
      this.syncOpeningsToWall(wall);
      this.publishWalls();
    }
    return result;
  }

  private editOpening(
    id: string,
    edit: (o: OpeningMesh) => DimensionResult,
  ): DimensionResult {
    const opening = this.openings.get(id);
    if (!opening) return { ok: false, error: 'That opening no longer exists.' };
    const result = edit(opening);
    if (result.ok) {
      const wall = this.walls.get(opening.wallId);
      if (wall) opening.syncToWall(wall);
      this.publishOpenings();
    }
    return result;
  }

  private leaveMode(mode: ToolMode): void {
    if (mode === 'draw-wall') {
      this.placement?.cancel();
      this.grid.setCursor(null);
      this.refreshJunctions();
      this.publish({ placement: 'idle', previewLength: null });
    }
    if (mode === 'resize') {
      if (this.resizer?.isDragging) this.endDragInteraction();
      this.resizer?.attach(null);
    }
    if (mode === 'place-opening') {
      if (this.previewOpening) {
        this.previewOpening.dispose();
        this.previewOpening = null;
      }
      this.pendingOpeningType = null;
    }
  }

  private updateCanvasCursor(mode: ToolMode): void {
    this.world.canvas.style.cursor =
      mode === 'draw-wall' || mode === 'place-opening' ? 'crosshair' : '';
  }

  private updateOpeningPreview(event: PointerEvent): void {
    const wall = this.selectedWall;
    const preview = this.previewOpening;
    if (!wall || !preview) return;

    const t = this.pointerOnWall(event, wall);
    if (t === null) return;

    preview.setOffsetT(t);
    preview.syncToWall(wall);
  }

  /**
   * Projects the pointer onto the wall's centreline plane and returns t ∈ [0,1].
   * Uses a vertical plane through the wall (z=const for X-axis, x=const for
   * Z-axis) so the result is accurate regardless of camera angle — the
   * horizontal ground plane (y=0) introduces a parallax offset for walls that
   * are not centred at the world origin.
   */
  private pointerOnWall(event: PointerEvent, wall: WallMesh): number | null {
    const start = wall.getStart();
    const orientation = wall.getOrientation();
    const point =
      orientation === 'x'
        ? this.raycast.intersectVerticalPlane(event, 'z', start.z)
        : this.raycast.intersectVerticalPlane(event, 'x', start.x);
    return point === null ? null : this.projectOntoWall(point, wall);
  }

  /** Projects a world XZ point onto the wall's centreline and returns t ∈ [0, 1]. */
  private projectOntoWall(point: PlanPoint, wall: WallMesh): number {
    const start = wall.getStart();
    const end = wall.getEnd();
    const orientation = wall.getOrientation();
    const t =
      orientation === 'x'
        ? (point.x - start.x) / (end.x - start.x)
        : (point.z - start.z) / (end.z - start.z);
    return Math.max(0, Math.min(1, t));
  }

  private syncOpeningsToWall(wall: WallMesh): void {
    for (const opening of this.openings.values()) {
      if (opening.wallId === wall.bimId) opening.syncToWall(wall);
    }
  }

  /** Reuses the previous cursor object when the snapped point is unchanged, avoiding needless UI updates. */
  private stableCursor(point: PlanPoint | null): PlanPoint | null {
    const previous = this.state.get().cursor;
    if (point && previous && pointsEqual(point, previous)) return previous;
    return point;
  }

  /** Re-closes every corner, including the ones the preview wall is making. */
  private refreshJunctions(): void {
    const walls = [...this.walls.values()];
    const preview = this.placement?.previewWall;
    if (preview) walls.push(preview);
    applyWallJunctions(walls);
  }

  /** Publishes after a change to walls, so junctions are resolved and openings are included. */
  private publishWalls(patch: Partial<EditorState> = {}): void {
    this.refreshJunctions();
    const walls: WallSummary[] = [...this.walls.values()].map((w) =>
      w.toSummary(),
    );
    const openings: OpeningSummary[] = [...this.openings.values()].map((o) =>
      o.toSummary(),
    );
    this.publish({ ...patch, walls, openings });
  }

  private publishOpenings(patch: Partial<EditorState> = {}): void {
    const openings: OpeningSummary[] = [...this.openings.values()].map((o) =>
      o.toSummary(),
    );
    this.publish({ ...patch, openings });
  }

  private publish(patch: Partial<EditorState> = {}): void {
    this.state.update({
      selectedId: this.selection.selected?.bimId ?? null,
      hoveredId: this.selection.hovered?.bimId ?? null,
      ...patch,
    });
  }
}

function info(text: string): StatusMessage {
  return { kind: 'info', text };
}

function error(text: string): StatusMessage {
  return { kind: 'error', text };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}
