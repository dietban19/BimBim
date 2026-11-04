import type { DimensionLimits } from './validation';
import { roundTo } from './math';

export const FT_PER_M = 1 / 0.3048;
export const M_PER_FT = 0.3048;

export const mToFt = (m: number): number => m * FT_PER_M;
export const ftToM = (ft: number): number => ft * M_PER_FT;

/** Formats a metre value as feet with the given decimal places. */
export function formatFt(metres: number, digits = 2): string {
  return `${mToFt(metres).toFixed(digits)} ft`;
}

/** Converts metre-based DimensionLimits to equivalent foot limits (rounded to 2 d.p.). */
export function toFtLimits(mLimits: DimensionLimits): DimensionLimits {
  return {
    label: mLimits.label,
    min: roundTo(mToFt(mLimits.min), 2),
    max: roundTo(mToFt(mLimits.max), 2),
  };
}
