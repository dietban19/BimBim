import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useEditor, useEditorState } from '../editor/EditorContext';
import {
  DOOR_TYPES,
  OPENING_TYPE_LABELS,
  WINDOW_TYPES,
} from '../model/openingDimensions';
import type { OpeningType, ToolMode } from '../types/editor';
import {
  ChevronDownIcon,
  DeleteIcon,
  DoorIcon,
  ResetViewIcon,
  ResizeIcon,
  SelectIcon,
  WallIcon,
  WindowIcon,
} from './icons';

interface ToolButtonProps {
  readonly label: string;
  readonly shortcut?: string;
  readonly icon: ReactNode;
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  readonly variant?: 'default' | 'danger';
  readonly onClick: () => void;
}

function ToolButton({
  label,
  shortcut,
  icon,
  pressed,
  disabled,
  variant = 'default',
  onClick,
}: ToolButtonProps): ReactElement {
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

function OpeningsDropdown(): ReactElement {
  const { walls } = useEditor();
  const [open, setOpen] = useState(false);
  const mode = useEditorState((s) => s.mode);
  const pendingType = useEditorState((s) => s.pendingOpeningType);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideButton = buttonRef.current?.contains(target) ?? false;
      const insidePanel = panelRef.current?.contains(target) ?? false;
      if (!insideButton && !insidePanel) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // The toolbar has overflow-x:auto which clips absolutely-positioned children.
  // Use position:fixed with coords from the button's bounding rect to escape it.
  const panelStyle = (): CSSProperties => {
    if (!buttonRef.current) return {};
    const r = buttonRef.current.getBoundingClientRect();
    return { position: 'fixed', top: r.bottom + 4, left: r.left };
  };

  const handleType = (type: OpeningType) => {
    setOpen(false);
    walls.beginOpeningPlacement(type);
  };

  return (
    <div className="toolbar__dropdown">
      <button
        ref={buttonRef}
        type="button"
        className="tool-button"
        aria-pressed={mode === 'place-opening'}
        aria-haspopup="true"
        aria-expanded={open}
        title="Add doors and windows to the selected wall"
        onClick={() => setOpen((v) => !v)}
      >
        <DoorIcon />
        <span>Openings</span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div
          ref={panelRef}
          className="dropdown-panel"
          style={panelStyle()}
          role="menu"
        >
          <div className="dropdown-section-label">Doors</div>
          {DOOR_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="menuitem"
              className={`dropdown-item${pendingType === type ? ' dropdown-item--active' : ''}`}
              onClick={() => handleType(type)}
            >
              <DoorIcon />
              {OPENING_TYPE_LABELS[type]}
            </button>
          ))}
          <div className="dropdown-separator" />
          <div className="dropdown-section-label">Windows</div>
          {WINDOW_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="menuitem"
              className={`dropdown-item${pendingType === type ? ' dropdown-item--active' : ''}`}
              onClick={() => handleType(type)}
            >
              <WindowIcon />
              {OPENING_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      )}
    </div>
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
        <ToolButton
          label="Select"
          shortcut="V"
          icon={<SelectIcon />}
          pressed={mode === 'select'}
          onClick={setMode('select')}
        />
        <ToolButton
          label="Wall"
          shortcut="W"
          icon={<WallIcon />}
          pressed={mode === 'draw-wall'}
          onClick={setMode('draw-wall')}
        />
        <ToolButton
          label="Resize"
          shortcut="R"
          icon={<ResizeIcon />}
          pressed={mode === 'resize'}
          disabled={!hasSelection}
          onClick={() => walls.toggleResize()}
        />

        <OpeningsDropdown />
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
      <ToolButton
        label="Reset view"
        icon={<ResetViewIcon />}
        onClick={() => camera.resetView()}
      />
    </header>
  );
}
