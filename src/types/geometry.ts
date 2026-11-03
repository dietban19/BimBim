/** A point on the ground plane, in metres. X and Z are world axes; Y is vertical. */
export interface PlanPoint {
  readonly x: number;
  readonly z: number;
}

/** The world axis a straight wall runs along. */
export type WallAxis = 'x' | 'z';

export type WallEnd = 'start' | 'end';
