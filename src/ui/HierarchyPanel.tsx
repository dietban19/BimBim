import type { ReactElement } from 'react';
import { useEditor, useEditorState } from '../editor/EditorContext';
import { WallListIcon } from './icons';
import { formatMetres } from './instructions';

export function HierarchyPanel(): ReactElement {
  const { walls } = useEditor();
  const wallList = useEditorState((s) => s.walls);
  const selectedId = useEditorState((s) => s.selectedId);
  const hoveredId = useEditorState((s) => s.hoveredId);

  return (
    <section className="panel" aria-labelledby="hierarchy-title">
      <h2 className="panel__header" id="hierarchy-title">
        Hierarchy
      </h2>
      <div className="panel__body panel__body--flush">
        <div className="tree">
          <div className="tree__group">
            <span>Walls</span>
            <span className="tree__count">{wallList.length}</span>
          </div>
          {wallList.length === 0 ? (
            <p className="tree__empty">No walls yet. Use the Wall tool to draw one.</p>
          ) : (
            <ul className="tree__list" aria-label="Walls">
              {wallList.map((wall) => {
                const selected = wall.id === selectedId;
                const className = [
                  'tree__item',
                  selected ? 'tree__item--selected' : '',
                  wall.id === hoveredId && !selected ? 'tree__item--hovered' : '',
                ].join(' ');
                return (
                  <li key={wall.id}>
                    <button
                      type="button"
                      className={className}
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => walls.selectWall(wall.id)}
                      onPointerEnter={() => walls.hoverWall(wall.id)}
                      onPointerLeave={() => walls.hoverWall(null)}
                    >
                      <WallListIcon />
                      <span className="tree__label">{wall.name}</span>
                      <span className="tree__meta">{formatMetres(wall.length)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
