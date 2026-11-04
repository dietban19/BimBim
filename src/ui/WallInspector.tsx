import { type ReactElement, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, useEditorState } from '../editor/EditorContext';
import {
  OPENING_HEIGHT_LIMITS,
  OPENING_TYPE_LABELS,
  OPENING_WIDTH_LIMITS,
  SILL_HEIGHT_LIMITS,
} from '../model/openingDimensions';
import {
  WALL_HEIGHT_LIMITS,
  WALL_LENGTH_LIMITS,
  WALL_THICKNESS_LIMITS,
} from '../model/wallDimensions';
import type { OpeningSummary, WallSummary } from '../types/editor';
import type { PlanPoint } from '../types/geometry';
import { ftToM, mToFt, toFtLimits } from '../utils/units';
import { DeleteIcon, DoorIcon, ResizeIcon, WindowIcon } from './icons';
import { NumberField, ReadOnlyField } from './NumberField';
import { StudFramingPlan } from './StudFramingPlan';

function formatPoint(point: PlanPoint): string {
  return `${mToFt(point.x).toFixed(2)}, ${mToFt(point.z).toFixed(2)}`;
}

function OpeningItem({
  opening,
}: {
  readonly opening: OpeningSummary;
}): ReactElement {
  const { walls } = useEditor();
  const selectedOpeningId = useEditorState((s) => s.selectedOpeningId);
  const expanded = opening.id === selectedOpeningId;

  return (
    <div className="opening-item">
      <button
        type="button"
        className={`opening-item__header${expanded ? ' opening-item__header--expanded' : ''}`}
        aria-expanded={expanded}
        onClick={() => walls.selectOpening(expanded ? null : opening.id)}
      >
        {opening.kind === 'door' ? <DoorIcon /> : <WindowIcon />}
        <span className="opening-item__label">
          {OPENING_TYPE_LABELS[opening.type]}
        </span>
        <span className="opening-item__seq">
          {opening.name.split(' ').pop()}
        </span>
      </button>
      {expanded && (
        <div className="opening-item__body">
          <NumberField
            label="Width"
            value={mToFt(opening.width)}
            unit="ft"
            step={0.5}
            limits={toFtLimits(OPENING_WIDTH_LIMITS)}
            onCommit={(v) => walls.setOpeningWidth(opening.id, ftToM(v))}
          />
          <NumberField
            label="Height"
            value={mToFt(opening.height)}
            unit="ft"
            step={0.5}
            limits={toFtLimits(OPENING_HEIGHT_LIMITS)}
            onCommit={(v) => walls.setOpeningHeight(opening.id, ftToM(v))}
          />
          {opening.kind === 'window' && (
            <NumberField
              label="Sill height"
              value={mToFt(opening.bottomHeight)}
              unit="ft"
              step={0.5}
              limits={toFtLimits(SILL_HEIGHT_LIMITS)}
              onCommit={(v) => walls.setOpeningBottomHeight(opening.id, ftToM(v))}
            />
          )}
          <div className="section section--actions">
            <button
              type="button"
              className="button button--danger"
              onClick={() => walls.deleteOpening(opening.id)}
            >
              <DeleteIcon />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OpeningsSection({
  wallId,
}: {
  readonly wallId: string;
}): ReactElement {
  const allOpenings = useEditorState((s) => s.openings);
  const wallOpenings = allOpenings.filter((o) => o.wallId === wallId);

  return (
    <fieldset className="section">
      <legend className="section__title">
        Openings ({wallOpenings.length})
      </legend>
      {wallOpenings.length === 0 ? (
        <p className="panel__empty" style={{ marginTop: 4 }}>
          No openings. Use the Openings menu in the toolbar.
        </p>
      ) : (
        <div className="opening-list">
          {wallOpenings.map((opening) => (
            <OpeningItem key={opening.id} opening={opening} />
          ))}
        </div>
      )}
    </fieldset>
  );
}

function WallProperties({
  wall,
}: {
  readonly wall: WallSummary;
}): ReactElement {
  const { walls } = useEditor();
  const resizing = useEditorState((s) => s.mode === 'resize');
  const [showOC, setShowOC] = useState(false);

  const studMeasurements = showOC ? walls.getStudMeasurements(wall.id) : [];

  useEffect(() => {
    if (!showOC) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowOC(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showOC]);

  return (
    <>
      <div className="inspector__title">
        <span className="inspector__name">{wall.name}</span>
        <span className="inspector__kind">Wall</span>
      </div>

      <fieldset className="section">
        <legend className="section__title">Dimensions</legend>
        <NumberField
          label="Length"
          value={mToFt(wall.length)}
          unit="ft"
          step={0.5}
          limits={toFtLimits(WALL_LENGTH_LIMITS)}
          onCommit={(value) => walls.setWallLength(wall.id, ftToM(value))}
        />
        <NumberField
          label="Height"
          value={mToFt(wall.height)}
          unit="ft"
          step={0.5}
          limits={toFtLimits(WALL_HEIGHT_LIMITS)}
          onCommit={(value) => walls.setWallHeight(wall.id, ftToM(value))}
        />
        <NumberField
          label="Thickness"
          value={mToFt(wall.thickness)}
          unit="ft"
          step={0.1}
          limits={toFtLimits(WALL_THICKNESS_LIMITS)}
          onCommit={(value) => walls.setWallThickness(wall.id, ftToM(value))}
        />
      </fieldset>

      <fieldset className="section">
        <legend className="section__title">Placement</legend>
        <ReadOnlyField
          label="Orientation"
          value={wall.orientation === 'x' ? 'X axis' : 'Z axis'}
        />
        <ReadOnlyField
          label="Start (X, Z)"
          value={formatPoint(wall.start)}
          unit="ft"
        />
        <ReadOnlyField
          label="End (X, Z)"
          value={formatPoint(wall.end)}
          unit="ft"
        />
      </fieldset>

      <OpeningsSection wallId={wall.id} />

      {showOC && createPortal(
        <div
          className="framing-modal-backdrop"
          onClick={() => setShowOC(false)}
        >
          <div
            className="framing-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="framing-modal__header">
              <span className="framing-modal__title">
                {wall.name} — Framing Elevation
              </span>
              <button
                type="button"
                className="framing-modal__close"
                aria-label="Close"
                onClick={() => setShowOC(false)}
              >
                ✕
              </button>
            </div>
            <div className="framing-modal__body">
              <StudFramingPlan wallLength={wall.length} measurements={studMeasurements} />
            </div>
          </div>
        </div>,
        document.body,
      )}

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
          className="button"
          onClick={() => walls.showWallFraming(wall.id)}
        >
          Show Framing
        </button>
        <button
          type="button"
          className="button"
          onClick={() => setShowOC(true)}
        >
          Stud OC
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
  const selected = selectedId
    ? wallList.find((wall) => wall.id === selectedId)
    : undefined;

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
          <p className="panel__empty">
            No object selected. Click a wall in the viewport or hierarchy.
          </p>
        )}
      </div>
    </section>
  );
}
