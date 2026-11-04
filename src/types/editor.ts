import type { PlanPoint, WallAxis } from './geometry';

export type ToolMode = 'select' | 'draw-wall' | 'resize' | 'place-opening';

export type PlacementPhase = 'idle' | 'awaiting-end';

export type DoorType = 'single-door' | 'double-door' | 'sliding-door';
export type WindowType = 'fixed-window' | 'casement-window' | 'sliding-window' | 'awning-window';
export type OpeningKind = 'door' | 'window';
export type OpeningType = DoorType | WindowType;

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

/** Immutable view of a door or window for the UI. The OpeningMesh is the source of truth. */
export interface OpeningSummary {
  readonly id: string;
  readonly wallId: string;
  readonly kind: OpeningKind;
  readonly type: OpeningType;
  readonly offsetT: number;
  readonly width: number;
  readonly height: number;
  readonly bottomHeight: number;
  readonly name: string;
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
  readonly openings: readonly OpeningSummary[];
  readonly selectedId: string | null;
  readonly hoveredId: string | null;
  readonly selectedOpeningId: string | null;
  readonly pendingOpeningType: OpeningType | null;
  /** Snapped grid position under the pointer, or null when off the grid. */
  readonly cursor: PlanPoint | null;
  readonly message: StatusMessage | null;
}

export type DimensionResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly error: string };
