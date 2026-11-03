import * as THREE from 'three';
import { WallSegment, type SegmentResult } from '../model/WallSegment';
import {
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  WALL_HEIGHT_LIMITS,
  WALL_THICKNESS_LIMITS,
} from '../model/wallDimensions';
import {
  NO_JUNCTION_OFFSETS,
  junctionEndpoints,
  wallFootprint,
  type JunctionOffsets,
  type JunctionWall,
  type XZBounds,
} from '../model/wallJunctions';
import type { DimensionResult, WallSummary } from '../types/editor';
import type { PlanPoint, WallAxis } from '../types/geometry';
import { distance } from '../utils/math';
import { validateDimension } from '../utils/validation';
import { BaseMesh } from './BaseMesh';
import { OBJECT_STYLES, type VisualState } from './visualStyle';

export interface WallMeshOptions {
  readonly segment: WallSegment;
  readonly height?: number;
  readonly thickness?: number;
  /** Preview walls use a translucent style and are never registered as selectable. */
  readonly preview?: boolean;
}

/**
 * A straight, vertical wall standing on the ground plane. The plan-view
 * centreline is a WallSegment; this class turns it into renderable geometry
 * and keeps that geometry valid whenever a property changes.
 *
 * The centreline always stays as it was drawn. Where the wall meets another
 * one, the junction offsets given to `setJunctionOffsets()` move the built ends
 * off that centreline so the corner closes; see model/wallJunctions.
 */
export class WallMesh extends BaseMesh {
  readonly isPreview: boolean;

  private segment: WallSegment;
  private height: number;
  private thickness: number;
  private junction: JunctionOffsets = NO_JUNCTION_OFFSETS;
  private readonly edges: THREE.LineSegments<
    THREE.EdgesGeometry,
    THREE.LineBasicMaterial
  >;

  constructor(options: WallMeshOptions) {
    super('wall', 'Wall', options.preview ? 'wall-preview' : 'wall');
    this.isPreview = options.preview ?? false;
    this.segment = options.segment;
    this.height = requireValid(
      validateDimension(
        options.height ?? DEFAULT_WALL_HEIGHT,
        WALL_HEIGHT_LIMITS,
      ),
    );
    this.thickness = requireValid(
      validateDimension(
        options.thickness ?? DEFAULT_WALL_THICKNESS,
        WALL_THICKNESS_LIMITS,
      ),
    );

    // Offset faces slightly back so the outline is drawn cleanly on top of them.
    this.material.polygonOffset = true;
    this.material.polygonOffsetFactor = 1;
    this.material.polygonOffsetUnits = 1;

    this.edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(),
      new THREE.LineBasicMaterial(),
    );
    this.edges.name = 'wall-outline';
    this.add(this.edges);

    if (this.isPreview) {
      this.name = 'Wall preview';
      this.renderOrder = 1;
    }

    this.updateGeometry();
    this.refreshVisualState();
  }

  getSegment(): WallSegment {
    return this.segment;
  }

  getStart(): PlanPoint {
    return this.segment.start;
  }

  getEnd(): PlanPoint {
    return this.segment.end;
  }

  getLength(): number {
    return this.segment.length;
  }

  getOrientation(): WallAxis {
    return this.segment.orientation;
  }

  getHeight(): number {
    return this.height;
  }

  getThickness(): number {
    return this.thickness;
  }

  /** The centreline and thickness the junction solver works from. */
  toJunctionWall(): JunctionWall {
    return {
      start: this.segment.start,
      end: this.segment.end,
      orientation: this.segment.orientation,
      thickness: this.thickness,
    };
  }

  /**
   * Moves the built ends off the centreline so junctions close. Called by the
   * owner of the wall collection whenever any wall in the layout changes.
   */
  setJunctionOffsets(offsets: JunctionOffsets): void {
    if (
      offsets.start === this.junction.start &&
      offsets.end === this.junction.end
    ) {
      return;
    }
    this.junction = offsets;
    this.updateGeometry();
  }

  /** Footprint on the ground plane, including thickness and junction offsets. */
  getXZBounds(): XZBounds {
    return wallFootprint(this.toJunctionWall(), this.junction);
  }

  /** Moves both endpoints. Invalid input is rejected and leaves the wall unchanged. */
  setEndpoints(start: PlanPoint, end: PlanPoint): SegmentResult {
    const result = WallSegment.tryCreate(start, end);
    if (result.ok) this.setSegment(result.segment);
    return result;
  }

  setSegment(segment: WallSegment): void {
    if (segment.equals(this.segment)) return;
    this.segment = segment;
    this.updateGeometry();
  }

  setHeight(height: number): DimensionResult {
    const result = validateDimension(height, WALL_HEIGHT_LIMITS);
    if (result.ok && result.value !== this.height) {
      this.height = result.value;
      this.updateGeometry();
    }
    return result;
  }

  setThickness(thickness: number): DimensionResult {
    const result = validateDimension(thickness, WALL_THICKNESS_LIMITS);
    if (result.ok && result.value !== this.thickness) {
      this.thickness = result.value;
      this.updateGeometry();
    }
    return result;
  }

  /**
   * Rebuilds the box geometry from the current segment, dimensions and
   * junction offsets. The box is authored along local X and rotated for Z-axis
   * walls, so its local frame always matches its length/height/thickness.
   */
  updateGeometry(): void {
    const { start, end } = junctionEndpoints(
      this.toJunctionWall(),
      this.junction,
    );
    const box = new THREE.BoxGeometry(
      distance(start, end),
      this.height,
      this.thickness,
    );
    this.replaceGeometry(box);

    const previousEdges = this.edges.geometry;
    this.edges.geometry = new THREE.EdgesGeometry(box);
    previousEdges.dispose();

    this.position.set(
      (start.x + end.x) / 2,
      this.height / 2,
      (start.z + end.z) / 2,
    );
    this.rotation.set(0, this.segment.orientation === 'x' ? 0 : Math.PI / 2, 0);
    this.updateMatrixWorld();
  }

  toSummary(): WallSummary {
    return {
      id: this.bimId,
      name: this.name,
      start: this.segment.start,
      end: this.segment.end,
      length: this.segment.length,
      height: this.height,
      thickness: this.thickness,
      orientation: this.segment.orientation,
    };
  }

  protected override get visualState(): VisualState {
    return this.isPreview ? 'preview' : super.visualState;
  }

  protected override applyVisualState(state: VisualState): void {
    const style = OBJECT_STYLES[state];
    const translucent = style.opacity < 1;

    this.material.color.setHex(style.surface);
    this.material.opacity = style.opacity;
    this.material.transparent = translucent;
    this.material.depthWrite = !translucent;

    this.edges.material.color.setHex(style.edge);
    this.edges.material.transparent = translucent;
    this.edges.material.opacity = translucent ? 0.9 : 1;
  }

  protected override disposeOwnedResources(): void {
    this.edges.removeFromParent();
    this.edges.geometry.dispose();
    this.edges.material.dispose();
    this.edges.dispose();
  }
}

function requireValid(result: DimensionResult): number {
  if (!result.ok) throw new RangeError(result.error);
  return result.value;
}
