import type { DimensionLimits } from '../utils/validation';

export const DEFAULT_WALL_HEIGHT = 3.048;    // 10 ft
export const DEFAULT_WALL_THICKNESS = 0.3048; // 1 ft (12 in)

export const WALL_HEIGHT_LIMITS: DimensionLimits = { label: 'Height', min: 0.1, max: 50 };
export const WALL_THICKNESS_LIMITS: DimensionLimits = { label: 'Thickness', min: 0.02, max: 5 };
export const WALL_LENGTH_LIMITS: DimensionLimits = { label: 'Length', min: 0.1, max: 60.96 };
