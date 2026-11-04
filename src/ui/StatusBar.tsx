import type { ReactElement } from 'react';
import { useEditor, useEditorState } from '../editor/EditorContext';
import { mToFt } from '../utils/units';
import { describeTool } from './instructions';

export function StatusBar(): ReactElement {
  const { grid } = useEditor();
  const mode = useEditorState((s) => s.mode);
  const placement = useEditorState((s) => s.placement);
  const selectedId = useEditorState((s) => s.selectedId);
  const walls = useEditorState((s) => s.walls);
  const pendingOpeningType = useEditorState((s) => s.pendingOpeningType);
  const cursor = useEditorState((s) => s.cursor);
  const message = useEditorState((s) => s.message);

  const hint = describeTool({ mode, placement, selectedId, walls, pendingOpeningType });

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
          <dd>{cursor ? `X ${mToFt(cursor.x).toFixed(2)}  Z ${mToFt(cursor.z).toFixed(2)}` : '—'}</dd>
        </div>
        <div>
          <dt>Walls</dt>
          <dd>{walls.length}</dd>
        </div>
        <div>
          <dt>Snap</dt>
          <dd>{mToFt(grid.spacing).toFixed(0)} ft</dd>
        </div>
      </dl>
    </footer>
  );
}
