import type { ReactElement, ReactNode } from 'react';
import { useEditor, useEditorState } from '../editor/EditorContext';
import type { ToolMode } from '../types/editor';
import { DeleteIcon, ResetViewIcon, ResizeIcon, SelectIcon, WallIcon } from './icons';

interface ToolButtonProps {
  readonly label: string;
  readonly shortcut?: string;
  readonly icon: ReactNode;
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  readonly variant?: 'default' | 'danger';
  readonly onClick: () => void;
}

function ToolButton({ label, shortcut, icon, pressed, disabled, variant = 'default', onClick }: ToolButtonProps): ReactElement {
  const hint = shortcut ? `${label} (${shortcut})` : label;
  return (
    <button
      type="button"
      className={`tool-button${variant === 'danger' ? ' tool-button--danger' : ''}`}
      title={hint}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function Toolbar(): ReactElement {
  const { walls, camera } = useEditor();
  const mode = useEditorState((s) => s.mode);
  const hasSelection = useEditorState((s) => s.selectedId !== null);

  const setMode = (next: ToolMode) => () => walls.setMode(next);

  return (
    <header className="toolbar" role="toolbar" aria-label="Editor tools">
      <span className="toolbar__title">BIM Starter</span>
      <div className="toolbar__separator" role="separator" />
      <div className="toolbar__group" role="group" aria-label="Tools">
        <ToolButton label="Select" shortcut="V" icon={<SelectIcon />} pressed={mode === 'select'} onClick={setMode('select')} />
        <ToolButton label="Wall" shortcut="W" icon={<WallIcon />} pressed={mode === 'draw-wall'} onClick={setMode('draw-wall')} />
        <ToolButton
          label="Resize"
          shortcut="R"
          icon={<ResizeIcon />}
          pressed={mode === 'resize'}
          disabled={!hasSelection}
          onClick={() => walls.toggleResize()}
        />
      </div>
      <div className="toolbar__separator" role="separator" />
      <ToolButton
        label="Delete"
        shortcut="Del"
        icon={<DeleteIcon />}
        variant="danger"
        disabled={!hasSelection}
        onClick={() => walls.deleteSelected()}
      />
      <div className="toolbar__spacer" />
      <ToolButton label="Reset view" icon={<ResetViewIcon />} onClick={() => camera.resetView()} />
    </header>
  );
}
