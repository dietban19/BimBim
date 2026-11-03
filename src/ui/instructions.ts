import type { EditorState } from '../types/editor';

/** Contextual guidance for the status bar, derived purely from editor state. */
export function describeTool(state: Pick<EditorState, 'mode' | 'placement' | 'selectedId' | 'walls'>): string {
  switch (state.mode) {
    case 'draw-wall':
      return state.placement === 'awaiting-end'
        ? 'Click to place the end point. Esc cancels the wall.'
        : 'Click on the grid to place the wall start point. Esc returns to Select.';
    case 'resize':
      return 'Drag a handle to resize the wall along its axis. Esc or R exits Resize.';
    case 'select':
      if (state.walls.length === 0) return 'The scene is empty. Choose Wall (W) to start drawing.';
      return state.selectedId
        ? 'R to resize, Delete to remove, Esc to deselect.'
        : 'Click a wall to select it. Drag to orbit, right-drag to pan, scroll to zoom.';
  }
}

export function formatMetres(value: number, digits = 2): string {
  return `${value.toFixed(digits)} m`;
}
