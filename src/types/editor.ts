import type { PlanPoint, WallAxis } from './geometry';

export type ToolMode = 'select' | 'draw-wall' | 'resize';

export type PlacementPhase = 'idle' | 'awaiting-end';

/** Immutable view of a wall for the UI. The WallMesh remains the source of truth. */
export interface WallSummary {
  readonly id: string;
  readonly name: string;
  readonly start: PlanPoint;
  readonly end: PlanPoint;
  readonly length: number;
  readonly height: number;
  readonly thickness: number;
  readonly orientation: WallAxis;
}

export interface StatusMessage {
  readonly kind: 'info' | 'error';
  readonly text: string;
}

export interface EditorState {
  readonly mode: ToolMode;
  readonly placement: PlacementPhase;
  /** Length of the wall being previewed, when a start point has been placed. */
  readonly previewLength: number | null;
  readonly walls: readonly WallSummary[];
  readonly selectedId: string | null;
  readonly hoveredId: string | null;
  /** Snapped grid position under the pointer, or null when off the grid. */
  readonly cursor: PlanPoint | null;
  readonly message: StatusMessage | null;
}

export type DimensionResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly error: string };
