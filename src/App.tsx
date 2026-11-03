import { useCallback, useState, type ReactElement } from 'react';
import { createEditor, type EditorSession } from './editor/createEditor';
import { EditorContext } from './editor/EditorContext';
import { HierarchyPanel } from './ui/HierarchyPanel';
import { Splitter } from './ui/Splitter';
import { StatusBar } from './ui/StatusBar';
import { Toolbar } from './ui/Toolbar';
import { ViewportOverlay } from './ui/ViewportOverlay';
import { WallInspector } from './ui/WallInspector';

const PANEL_LIMITS = { min: 160, max: 420 } as const;

/**
 * Application shell. The element tree is identical before and after the
 * engine starts so the viewport host is never remounted; panels that need
 * the editor session simply render once it exists.
 */
export function App(): ReactElement {
  const [session, setSession] = useState<EditorSession | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [leftWidth, setLeftWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(280);

  // A ref callback (with React 19 cleanup) ties the engine's lifetime to the
  // viewport element: created when it mounts, disposed when it unmounts.
  const attachViewport = useCallback((host: HTMLDivElement | null) => {
    if (!host) return;
    let editor: EditorSession;
    try {
      editor = createEditor(host);
    } catch (error) {
      setStartupError(error instanceof Error ? error.message : 'The 3D viewport could not be initialised.');
      return;
    }
    setSession(editor);
    return () => {
      editor.dispose();
      setSession(null);
    };
  }, []);

  return (
    <EditorContext.Provider value={session}>
      <div
        className="app"
        style={{ '--left-panel-width': `${leftWidth}px`, '--right-panel-width': `${rightWidth}px` }}
      >
        {session ? <Toolbar /> : <div className="toolbar" />}
        <div className="workspace">
          <aside className="workspace__left">{session && <HierarchyPanel />}</aside>
          <Splitter label="Resize hierarchy panel" value={leftWidth} {...PANEL_LIMITS} direction={1} onChange={setLeftWidth} />
          <main className="viewport" aria-label="3D viewport">
            <div className="viewport__host" ref={attachViewport} />
            {session && <ViewportOverlay />}
            {startupError && (
              <div className="viewport__error" role="alert">
                <strong>Viewport unavailable.</strong> {startupError} The editor requires WebGL.
              </div>
            )}
          </main>
          <Splitter label="Resize inspector panel" value={rightWidth} {...PANEL_LIMITS} direction={-1} onChange={setRightWidth} />
          <aside className="workspace__right">{session && <WallInspector />}</aside>
        </div>
        {session ? <StatusBar /> : <div className="statusbar" />}
      </div>
    </EditorContext.Provider>
  );
}
