import { GridComponent } from '../components/GridComponent';
import { OrbitControlsComponent } from '../components/OrbitControlsComponent';
import { RaycastComponent } from '../components/RaycastComponent';
import { WallToolComponent } from '../components/WallToolComponent';
import { Engine } from '../engine/Engine';

export const MAIN_WORLD_ID = 'main';

/** The handles the UI needs; everything else stays inside the engine. */
export interface EditorSession {
  readonly walls: WallToolComponent;
  readonly camera: OrbitControlsComponent;
  readonly grid: GridComponent;
  dispose(): void;
}

/**
 * Builds the engine, its main world and the component stack in dependency
 * order, and starts rendering. Disposing the session tears all of it down.
 */
export function createEditor(container: HTMLElement): EditorSession {
  const engine = new Engine();
  const world = engine.worlds.create(MAIN_WORLD_ID, { container });

  world.add(RaycastComponent);
  // size: 200 ft (60.96 m), spacing: 1 ft (0.3048 m), major line every 10 ft
  const grid = world.add(GridComponent, { size: 60.96, spacing: 0.3048, majorEvery: 10 });
  const camera = world.add(OrbitControlsComponent);
  const walls = world.add(WallToolComponent);

  engine.start();

  return {
    walls,
    camera,
    grid,
    dispose: () => engine.dispose(),
  };
}
