import type { ReactElement } from 'react';
import { useEditor, useEditorState } from '../editor/EditorContext';
import { WALL_HEIGHT_LIMITS, WALL_THICKNESS_LIMITS } from '../model/wallDimensions';
import type { WallSummary } from '../types/editor';
import type { PlanPoint } from '../types/geometry';
import { DeleteIcon, ResizeIcon } from './icons';
import { NumberField, ReadOnlyField } from './NumberField';

function formatPoint(point: PlanPoint): string {
  return `${point.x.toFixed(2)}, ${point.z.toFixed(2)}`;
}

function WallProperties({ wall }: { readonly wall: WallSummary }): ReactElement {
  const { walls } = useEditor();
  const resizing = useEditorState((s) => s.mode === 'resize');

  return (
    <>
      <div className="inspector__title">
        <span className="inspector__name">{wall.name}</span>
        <span className="inspector__kind">Wall</span>
      </div>

      <fieldset className="section">
        <legend className="section__title">Dimensions</legend>
        <ReadOnlyField label="Length" value={wall.length.toFixed(2)} unit="m" />
        <NumberField
          label="Height"
          value={wall.height}
          unit="m"
          step={0.1}
          limits={WALL_HEIGHT_LIMITS}
          onCommit={(value) => walls.setWallHeight(wall.id, value)}
        />
        <NumberField
          label="Thickness"
          value={wall.thickness}
          unit="m"
          step={0.05}
          limits={WALL_THICKNESS_LIMITS}
          onCommit={(value) => walls.setWallThickness(wall.id, value)}
        />
      </fieldset>

      <fieldset className="section">
        <legend className="section__title">Placement</legend>
        <ReadOnlyField label="Orientation" value={wall.orientation === 'x' ? 'X axis' : 'Z axis'} />
        <ReadOnlyField label="Start (X, Z)" value={formatPoint(wall.start)} unit="m" />
        <ReadOnlyField label="End (X, Z)" value={formatPoint(wall.end)} unit="m" />
      </fieldset>

      <div className="section section--actions">
        <button
          type="button"
          className="button"
          aria-pressed={resizing}
          title="Toggle endpoint handles (R)"
          onClick={() => walls.toggleResize()}
        >
          <ResizeIcon />
          {resizing ? 'Exit Resize' : 'Resize'}
        </button>
        <button
          type="button"
          className="button button--danger"
          title="Delete the selected wall (Del)"
          onClick={() => walls.deleteWall(wall.id)}
        >
          <DeleteIcon />
          Delete Wall
        </button>
      </div>
    </>
  );
}

export function WallInspector(): ReactElement {
  const wallList = useEditorState((s) => s.walls);
  const selectedId = useEditorState((s) => s.selectedId);
  const selected = selectedId ? wallList.find((wall) => wall.id === selectedId) : undefined;

  return (
    <section className="panel" aria-labelledby="inspector-title">
      <h2 className="panel__header" id="inspector-title">
        Inspector
      </h2>
      <div className="panel__body">
        {selected ? (
          // Keyed so field drafts and errors never carry over between walls.
          <WallProperties key={selected.id} wall={selected} />
        ) : (
          <p className="panel__empty">No object selected. Click a wall in the viewport or hierarchy.</p>
        )}
      </div>
    </section>
  );
}
