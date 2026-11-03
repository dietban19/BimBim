import * as THREE from 'three';
import {
  WallSegment,
  constrainToDominantAxis,
  type SegmentResult,
} from '../model/WallSegment';
import { DEFAULT_WALL_THICKNESS } from '../model/wallDimensions';
import {
  wouldWallOverlapExisting,
  type JunctionWall,
} from '../model/wallJunctions';
import { WallMesh } from '../objects/WallMesh';
import type { PlacementPhase } from '../types/editor';
import type { PlanPoint } from '../types/geometry';

/**
 * Two-click wall placement. Owns the translucent preview wall, which is added
 * to the scene but never registered as a selectable or permanent object.
 * Points passed in are expected to be already snapped to the grid.
 *
 * Walls are placed centreline to centreline, exactly where they were drawn;
 * the corners they make with their neighbours are closed afterwards by the
 * junction solver, so a wall reads the same whenever it was drawn.
 */
export class WallPlacementTool {
  private startPoint: PlanPoint | null = null;
  private preview: WallMesh | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    /** Permanent walls to join against; the preview is never included. */
    private readonly getWalls: () => Iterable<WallMesh>,
  ) {}

  get phase(): PlacementPhase {
    return this.startPoint ? 'awaiting-end' : 'idle';
  }

  get start(): PlanPoint | null {
    return this.startPoint;
  }

  /** Length of the visible preview, or null if there is none. */
  get previewLength(): number | null {
    return this.preview?.visible ? this.preview.getLength() : null;
  }

  /** The visible preview wall, so it can be resolved against the placed walls. */
  get previewWall(): WallMesh | null {
    return this.preview?.visible ? this.preview : null;
  }

  begin(point: PlanPoint): void {
    this.startPoint = point;
    this.updatePreview(point);
  }

  /** Updates the preview for the current pointer position; null hides it. */
  updatePreview(point: PlanPoint | null): void {
    if (!this.startPoint) return;
    const result = point ? this.segmentTo(point) : null;
    if (!result?.ok) {
      if (this.preview) this.preview.visible = false;
      return;
    }

    if (this.preview) {
      this.preview.setSegment(result.segment);
    } else {
      this.preview = new WallMesh({ segment: result.segment, preview: true });
      this.scene.add(this.preview);
    }
    this.preview.visible = true;
  }

  /**
   * Attempts to finish the wall at `point`. On success the tool returns to the
   * idle phase and the caller creates the permanent wall from the segment.
   */
  commit(point: PlanPoint): SegmentResult {
    const result = this.segmentTo(point);
    if (result.ok) this.cancel();
    return result;
  }

  /** Abandons the unfinished wall and removes the preview geometry. */
  cancel(): void {
    this.startPoint = null;
    this.preview?.dispose();
    this.preview = null;
  }

  dispose(): void {
    this.cancel();
  }

  private segmentTo(point: PlanPoint): SegmentResult {
    if (!this.startPoint)
      return { ok: false, error: 'Place a start point first.' };

    const result = WallSegment.tryCreate(
      this.startPoint,
      constrainToDominantAxis(this.startPoint, point),
    );
    if (!result.ok) return result;

    const candidate: JunctionWall = {
      start: result.segment.start,
      end: result.segment.end,
      orientation: result.segment.orientation,
      thickness: DEFAULT_WALL_THICKNESS,
    };
    if (wouldWallOverlapExisting(candidate, this.neighbours())) {
      return { ok: false, error: 'That wall would overlap an existing wall.' };
    }
    return result;
  }

  /** Placed walls the new one can join, as the junction solver sees them. */
  private neighbours(): JunctionWall[] {
    return [...this.getWalls()]
      .filter((wall) => !wall.isPreview)
      .map((wall) => wall.toJunctionWall());
  }
}
