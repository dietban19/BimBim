/**
 * Colour roles shared by BIM objects and editor overlays. Kept in one place so
 * the viewport stays consistent with the UI's single muted-blue accent.
 */
export const ACCENT = 0x5b8fd0;

export type VisualState = 'default' | 'hovered' | 'selected' | 'preview';

export interface SurfaceStyle {
  readonly surface: number;
  readonly edge: number;
  readonly opacity: number;
}

export const OBJECT_STYLES: Readonly<Record<VisualState, SurfaceStyle>> = {
  default: { surface: 0xb4b7bb, edge: 0x45484d, opacity: 1 },
  hovered: { surface: 0xc6ccd3, edge: 0x7fa3cc, opacity: 1 },
  selected: { surface: 0x9fb6d0, edge: ACCENT, opacity: 1 },
  preview: { surface: ACCENT, edge: ACCENT, opacity: 0.35 },
};

export const HANDLE_COLOR = 0xe8eef5;
export const HANDLE_HOVER_COLOR = ACCENT;
export const GRID_MINOR_COLOR = 0x353535;
export const GRID_MAJOR_COLOR = 0x444444;
export const GRID_AXIS_X_COLOR = 0x7a4a4a;
export const GRID_AXIS_Z_COLOR = 0x4a5f7a;
export const GRID_CURSOR_COLOR = ACCENT;
