import { createContext, useContext, useSyncExternalStore } from 'react';
import type { EditorState } from '../types/editor';
import type { EditorSession } from './createEditor';

export const EditorContext = createContext<EditorSession | null>(null);

export function useEditor(): EditorSession {
  const session = useContext(EditorContext);
  if (!session) throw new Error('useEditor must be used inside an initialised EditorContext.');
  return session;
}

/**
 * Subscribes to a slice of the engine's EditorState. The selector should return
 * a value that keeps its identity while unchanged (a field of the snapshot or
 * a primitive) so components re-render only when that slice changes.
 */
export function useEditorState<T>(selector: (state: EditorState) => T): T {
  const { walls } = useEditor();
  return useSyncExternalStore(walls.state.subscribe, () => selector(walls.state.get()));
}
