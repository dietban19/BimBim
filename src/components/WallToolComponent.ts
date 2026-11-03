import { Component } from '../engine/Component';
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
  selectedId: null,
  hoveredId: null,
  cursor: null,
  message: null,
};

/**
 * Wall editing workflow: Select, Draw Wall and Resize modes. Translates
 * pointer and keyboard input into operations on WallMesh objects, owns the
 * collection of walls, and publishes an immutable EditorState for the UI.
 *
 * Geometry lives in WallMesh; placement and resize mechanics live in the
 * dedicated tools this component coordinates.
 */
export class WallToolComponent extends Component {
  static override readonly dependencies = [
    RaycastComponent,
    GridComponent,
    OrbitControlsComponent,
  ];

  readonly state = new ObservableState<EditorState>(INITIAL_STATE);

  private readonly walls = new Map<string, WallMesh>();
  private readonly selection = new SelectionController();
  private readonly gesture = new PointerGesture();
  private placement: WallPlacementTool | null = null;
  private resizer: WallResizeTool | null = null;

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
    // Capture phase so a handle press can disable OrbitControls before it sees the event.
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
    for (const wall of this.walls.values()) {
      this.world.selectables.remove(wall);
      wall.dispose();
    }
    this.walls.clear();
    this.state.clearListeners();
  }

  // ---------------------------------------------------------------------------
  // Commands used by the UI and keyboard shortcuts
  // ---------------------------------------------------------------------------

  setMode(mode: ToolMode): void {
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

  deleteWall(id: string): void {
    const wall = this.walls.get(id);
    if (!wall) return;
    const wasResizing =
      this.state.get().mode === 'resize' && this.resizer?.target === wall;

    if (this.resizer?.target === wall) {
      if (this.resizer.isDragging) this.endDragInteraction();
      this.resizer.attach(null);
    }
    this.selection.forget(wall);
    this.world.selectables.remove(wall);
    this.walls.delete(id);
    const name = wall.name;
    wall.dispose();

    if (wasResizing) this.updateCanvasCursor('select');
    this.publishWalls({
      ...(wasResizing ? { mode: 'select' as const } : {}),
      message: info(`Deleted ${name}.`),
    });
  }

  deleteSelected(): void {
    const wall = this.selectedWall;
    if (wall) this.deleteWall(wall.bimId);
    else this.publish({ message: error('Nothing selected to delete.') });
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

    // The handle owns this press: keep the camera still and route all moves here.
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
      // Endpoints only change when the snapped point does.
      if (cursor !== this.state.get().cursor) this.publishWalls({ cursor });
      return;
    }

    // Skip picking while the user is orbiting or panning.
    if (this.gesture.isDragging) return;

    const mode = this.state.get().mode;
    const gridPoint = this.grid.pointerToGrid(event);

    if (mode === 'draw-wall') {
      this.grid.setCursor(gridPoint);
      this.placement?.updatePreview(gridPoint);
      // The preview joins the layout, so it shows the corners it will make.
      this.refreshJunctions();
      this.publish({
        cursor: this.stableCursor(gridPoint),
        previewLength: this.placement?.previewLength ?? null,
      });
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
    this.resizer.cancelDrag();
    this.releaseDrag(event.pointerId);
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
    if (this.state.get().mode === 'draw-wall') {
      this.handlePlacementClick(this.grid.pointerToGrid(event));
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

  private finishResizeDrag(pointerId: number): void {
    const resizer = this.resizer;
    if (!resizer) return;
    const changed = resizer.endDrag();
    this.releaseDrag(pointerId);
    const wall = resizer.target;
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

  /** Escape backs out one level: drag → unfinished wall → tool → selection. */
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

  private applySelection(wall: WallMesh | null): void {
    const mode = this.state.get().mode;
    this.selection.select(wall);

    if (mode === 'resize') {
      if (wall) {
        this.resizer?.attach(wall);
      } else {
        // Resize mode needs a target; dropping the selection returns to Select.
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
      this.publishWalls();
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
  }

  private updateCanvasCursor(mode: ToolMode): void {
    this.world.canvas.style.cursor = mode === 'draw-wall' ? 'crosshair' : '';
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

  /** Publishes after a change to the walls themselves, so junctions are resolved first. */
  private publishWalls(patch: Partial<EditorState> = {}): void {
    this.refreshJunctions();
    const walls: WallSummary[] = [...this.walls.values()].map((wall) =>
      wall.toSummary(),
    );
    this.publish({ ...patch, walls });
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
