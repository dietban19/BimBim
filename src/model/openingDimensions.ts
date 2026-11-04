import type { DimensionLimits } from '../utils/validation';
import type { DoorType, OpeningType, WindowType } from '../types/editor';

export const DEFAULT_DOOR_WIDTH = 0.9144;   // 3 ft
export const DEFAULT_DOOR_HEIGHT = 2.1336;  // 7 ft
export const DEFAULT_WINDOW_WIDTH = 1.2192; // 4 ft
export const DEFAULT_WINDOW_HEIGHT = 1.2192; // 4 ft
export const DEFAULT_WINDOW_BOTTOM = 0.9144; // 3 ft sill

export const OPENING_WIDTH_LIMITS: DimensionLimits = { label: 'Width', min: 0.3, max: 6 };
export const OPENING_HEIGHT_LIMITS: DimensionLimits = { label: 'Height', min: 0.3, max: 4 };
export const SILL_HEIGHT_LIMITS: DimensionLimits = { label: 'Sill height', min: 0.01, max: 3 };

export const DOOR_TYPES: readonly DoorType[] = ['single-door', 'double-door', 'sliding-door'];
export const WINDOW_TYPES: readonly WindowType[] = [
  'fixed-window',
  'casement-window',
  'sliding-window',
  'awning-window',
];

export const OPENING_TYPE_LABELS: Record<OpeningType, string> = {
  'single-door': 'Single Door',
  'double-door': 'Double Door',
  'sliding-door': 'Sliding Door',
  'fixed-window': 'Fixed Window',
  'casement-window': 'Casement Window',
  'sliding-window': 'Sliding Window',
  'awning-window': 'Awning Window',
};
