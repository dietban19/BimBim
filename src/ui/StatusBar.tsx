import type { ReactElement } from 'react';
import { useEditor, useEditorState } from '../editor/EditorContext';
import { describeTool } from './instructions';

export function StatusBar(): ReactElement {
  const { grid } = useEditor();
  const mode = useEditorState((s) => s.mode);
  const placement = useEditorState((s) => s.placement);
  const selectedId = useEditorState((s) => s.selectedId);
  const walls = useEditorState((s) => s.walls);
  const cursor = useEditorState((s) => s.cursor);
  const message = useEditorState((s) => s.message);

  const hint = describeTool({ mode, placement, selectedId, walls });

  return (
    <footer className="statusbar">
      <p className="statusbar__hint" aria-live="polite">
        {message ? (
          <span className={message.kind === 'error' ? 'statusbar__message--error' : 'statusbar__message'}>
            {message.text}
          </span>
        ) : null}
        <span>{hint}</span>
      </p>
      <dl className="statusbar__readouts">
        <div>
          <dt>Cursor</dt>
          <dd>{cursor ? `X ${cursor.x.toFixed(2)}  Z ${cursor.z.toFixed(2)}` : '—'}</dd>
        </div>
        <div>
          <dt>Walls</dt>
          <dd>{walls.length}</dd>
        </div>
        <div>
          <dt>Snap</dt>
          <dd>{grid.spacing} m</dd>
        </div>
      </dl>
    </footer>
  );
}
