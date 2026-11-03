import type { PlanPoint } from '../types/geometry';

/** Decimal places kept after snapping; removes floating-point residue such as 1.5000000000000002. */
const SNAP_PRECISION = 6;

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  // Normalise -0 so that it never shows up in the UI or in equality checks.
  return rounded === 0 ? 0 : rounded;
}

export function snapValue(value: number, spacing: number): number {
  if (!(spacing > 0) || !Number.isFinite(spacing)) {
    throw new RangeError(`Snap spacing must be a positive finite number, got ${spacing}`);
  }
  return roundTo(Math.round(value / spacing) * spacing, SNAP_PRECISION);
}

export function snapPoint(point: PlanPoint, spacing: number): PlanPoint {
  return { x: snapValue(point.x, spacing), z: snapValue(point.z, spacing) };
}

export function pointsEqual(a: PlanPoint, b: PlanPoint, epsilon = 1e-9): boolean {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.z - b.z) <= epsilon;
}

export function distance(a: PlanPoint, b: PlanPoint): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Smallest multiple of `spacing` that is at least `minimum`. */
export function ceilToStep(minimum: number, spacing: number): number {
  return roundTo(Math.ceil(minimum / spacing - 1e-9) * spacing, SNAP_PRECISION);
}
