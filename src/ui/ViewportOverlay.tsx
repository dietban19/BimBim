import type { ReactElement } from 'react';
import { useEditorState } from '../editor/EditorContext';
import type { ToolMode } from '../types/editor';
import { formatMetres } from './instructions';

const MODE_LABELS: Record<ToolMode, string> = {
  select: 'Select',
  'draw-wall': 'Draw Wall',
  resize: 'Resize',
  'place-opening': 'Place Opening',
};

/** Compact readouts drawn over the viewport corners. Never intercepts pointer input. */
export function ViewportOverlay(): ReactElement {
  const mode = useEditorState((s) => s.mode);
  const previewLength = useEditorState((s) => s.previewLength);
  const selectedLength = useEditorState((s) =>
    s.mode === 'resize' ? (s.walls.find((wall) => wall.id === s.selectedId)?.length ?? null) : null,
  );
  const length = mode === 'draw-wall' ? previewLength : selectedLength;

  return (
    <div className="viewport-overlay" aria-hidden="true">
      <div className="viewport-overlay__readout">
        <span className="viewport-overlay__mode">{MODE_LABELS[mode]}</span>
        {length !== null && <span>Length {formatMetres(length)}</span>}
      </div>
      <div className="viewport-overlay__axes">
        <span className="axis axis--x">X</span>
        <span className="axis axis--z">Z</span>
        <span className="axis axis--y">Y up</span>
      </div>
    </div>
  );
}
