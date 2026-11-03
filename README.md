# BIM Starter

A browser-based BIM editor foundation: a 3D workspace with a snapping grid, camera navigation, and a complete wall modelling workflow (draw, select, edit, resize, delete). Built with React, TypeScript (strict), Three.js and Vite. It runs entirely in the browser with no backend.

This is the foundation for a larger architectural modelling application. The scope is intentionally small; the structure is designed for doors, windows, slabs, roofs and other BIM objects to be added without changing the engine.

## Getting started

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run unit tests once |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | ESLint |

### Docker

Dependencies are installed while the image is built, so containers run without network access.

```bash
# Production build, served on :4173 (runs the tests during the build)
docker build -t bim-starter .
docker run --rm -p 4173:4173 bim-starter

# Development server with hot reload, editing src/ from the host
docker build --target dev -t bim-starter:dev .
docker run --rm -p 5173:5173 -v "$PWD/src:/app/src" bim-starter:dev
```

## Using the editor

The layout is toolbar on top, Hierarchy on the left, 3D viewport in the centre, Inspector on the right, and a status bar showing contextual instructions, the snapped cursor position and the snap interval. The side panels can be resized by dragging their borders (or focusing a border and using the arrow keys).

| Action | Mouse | Keyboard |
| --- | --- | --- |
| Orbit | Left-drag | |
| Pan | Right-drag or Shift + left-drag | |
| Zoom (towards cursor) | Wheel | |
| Select tool | Toolbar | `V` |
| Wall tool | Toolbar | `W` |
| Toggle Resize mode (needs a selection) | Toolbar / Inspector | `R` |
| Delete selected wall | Toolbar / Inspector | `Delete` / `Backspace` |
| Back out one step | | `Esc` |

`Esc` cancels a handle drag, then an unfinished wall, then the active tool, then the selection. Shortcuts are ignored while typing in an input.

**Drawing walls.** Choose Wall, click a grid point for the start, move to preview, and click again for the end. Walls lock to the X or Z axis (whichever the pointer has travelled further along) and snap to the 0.5 m grid. Zero-length walls and points off the grid are rejected with a message. New walls are 3 m high and 0.3 m thick.

**Selecting.** Click a wall in the viewport or in the Hierarchy. Hovering highlights a wall in both places. Clicking empty space clears the selection. A drag never selects or places anything; only stationary clicks do.

**Editing.** The Inspector shows length (read-only), height, thickness, orientation and both endpoints. Height and thickness apply on every valid keystroke. Invalid, zero, negative or out-of-range values show an inline error and revert on blur or `Esc`. Arrow Up/Down step a field (Shift for ×10).

**Resizing.** With a wall selected, enter Resize mode. Drag either endpoint handle; the opposite end stays fixed, the moving end snaps to the grid and stays on the wall's axis, and the wall cannot shrink below 0.5 m or flip past its fixed end. Camera navigation is suspended only while a handle is held.

## Architecture

```
src/
  engine/       Engine, Worlds, World, Component, SelectableRegistry
  components/   RaycastComponent, GridComponent, OrbitControlsComponent, WallToolComponent
  objects/      BaseMesh, WallMesh, visualStyle
  model/        WallSegment (pure wall math), wall dimension defaults/limits
  tools/        WallPlacementTool, WallResizeTool, SelectionController, PointerGesture
  editor/       createEditor (bootstrap), React context + state hook
  ui/           Toolbar, HierarchyPanel, WallInspector, NumberField, StatusBar, ViewportOverlay, Splitter
  utils/        math (snapping), validation, ObservableState, ids
  types/        shared geometry and editor-state types
```

Dependencies point one way: `ui` → `editor` → `components` → `tools` / `objects` → `model` / `utils`. Nothing below `ui` imports React, and `model` and `utils` import neither React nor Three.js.

### Engine

`Engine` owns the only `requestAnimationFrame` loop. Each frame it computes the delta time (clamped to 0.1 s so a backgrounded tab cannot cause a jump) and calls `worlds.update(delta)`. It knows nothing about walls, input or UI. `start()`, `stop()` and `dispose()` control the loop; `dispose()` also disposes every world.

### Worlds and World

`Worlds` creates, registers, retrieves and removes `World` instances by id, updates all of them each frame, and disposes them. The app uses one world (`main`); a second view, such as a plan viewport, would be another world on the same engine.

A `World` is one Three.js environment. It owns the scene, perspective camera, WebGL renderer, lights, a `ResizeObserver` on its container, the registry of selectable objects, and the component registry:

- `add(ComponentClass, options)` constructs a component, calls `init()`, then `resize()` with the current size. It throws if the class is already registered or if any of its declared `dependencies` is missing, so the bootstrap order is checked at startup.
- `get(ComponentClass)` returns the typed instance (or throws); `has(ComponentClass)` checks registration.
- `update(delta)` updates components in registration order, then renders.
- `resize()` updates the camera aspect and renderer size, then notifies components.
- `dispose()` disposes components in reverse order, then lights and the renderer, and removes the canvas.

The World manages shared infrastructure only; it contains no wall logic.

### Components

Every component extends the abstract `Component`, receives its World in the constructor, declares `static dependencies`, and overrides only the lifecycle methods it needs: `init`, `update`, `resize`, `dispose`.

- **RaycastComponent** converts pointer client coordinates to normalised device coordinates and casts rays against horizontal planes, arbitrary objects, or the World's selectables. Other components use it as a shared picking service.
- **GridComponent** renders the XZ grid (minor lines every 0.5 m, major every 1 m, coloured X and Z axes), snaps plan points, checks bounds, converts a pointer to a snapped grid point, and draws the hover marker. Size, spacing and major interval are configurable. Grid coordinates are world coordinates, so they do not depend on the camera.
- **OrbitControlsComponent** wraps Three.js `OrbitControls` with damping, distance limits, a ground-plane pan, and a polar limit that keeps the camera above ground. `setEnabled()` lets another component take the pointer temporarily; `resetView()` restores the initial camera.
- **WallToolComponent** implements the Select / Draw Wall / Resize workflow. It listens to pointer and keyboard events, owns the collection of walls, keeps the selectable registry in sync, and publishes an immutable `EditorState`. It delegates the mechanics to small classes in `tools/`:
  - `PointerGesture` separates clicks from drags, so orbiting never places or selects.
  - `SelectionController` maintains single selection and hover, and the matching visual flags.
  - `WallPlacementTool` runs the two-click placement and owns the preview wall, which is never registered as selectable.
  - `WallResizeTool` owns the endpoint handles and turns pointer drags into segment resizes.

  For handle drags it listens to `pointerdown` in the capture phase, so it can disable OrbitControls before the controls see the press, and it captures the pointer until release.

### BIM objects

`BaseMesh` (abstract, extends `THREE.Mesh`) provides what every BIM object needs: a unique `bimId`, a kind, a display name, selected and hovered state, and ownership of its geometry and material. Each instance owns its own material, so changing one object's state cannot affect another and `dispose()` is always safe and idempotent. Subclasses implement `applyVisualState()` and may add cleanup in `disposeOwnedResources()`.

`WallMesh` extends `BaseMesh`. Its plan-view centreline is a `WallSegment` (start, end, length, orientation, midpoint), which is a pure, immutable class with no Three.js dependency, so all wall math is unit tested. `WallMesh` adds height and thickness and turns them into a box and an outline, positioned so the wall stands on the ground plane. Its public API is `getLength()`, `getOrientation()`, `getStart()`/`getEnd()`, `getHeight()`/`getThickness()`, `setEndpoints()`, `setSegment()`, `setHeight()`, `setThickness()`, `updateGeometry()`, `toSummary()` and `dispose()`. Setters validate their input and return a result; invalid values leave the wall unchanged, and every accepted change rebuilds the geometry.

Resize rules (axis projection, fixed opposite end, minimum length, no flipping) live in `WallSegment.resizeEndpoint()`. The resize tool decides *what* to resize; the wall decides *how* to render it.

### How the pieces communicate

```
React UI ──commands──▶ WallToolComponent ──▶ WallMesh / tools
   ▲                          │
   └── useSyncExternalStore ◀─┘  ObservableState<EditorState>
```

- **UI → engine:** components call typed command methods on the session, such as `walls.setMode()`, `walls.selectWall(id)`, `walls.setWallHeight(id, value)`, `walls.deleteWall(id)` and `camera.resetView()`.
- **Engine → UI:** `WallToolComponent` publishes snapshots to an `ObservableState`. React reads slices with `useEditorState(selector)`, which uses `useSyncExternalStore`. Snapshots change on user actions, never per frame, and unchanged slices keep their identity, so only affected components re-render.
- **Component → component:** components fetch each other with `world.get(OtherComponent)`. These dependencies are also declared in `static dependencies` and enforced at registration.

`WallSummary` objects in the state are read-only copies for display. The `WallMesh` remains the single source of truth.

`createEditor(container)` wires everything up: engine → main world → Raycast → Grid → OrbitControls → WallTool → start. React ties this to the viewport element's lifetime with a ref callback, and its cleanup disposes the whole engine, including WebGL resources and listeners.

### Extending

To add an element type, for example a slab:

1. Subclass `BaseMesh` (`SlabMesh`), keeping its math in a pure model class like `WallSegment`.
2. Add a tool component, or tool classes in `tools/`, that creates instances and registers them with `world.selectables`. Selection, hover and picking already work for any `BaseMesh`.
3. Add an Inspector view for the new kind.

Persistence, undo/redo and multiple storeys are not implemented. Natural places for them are a command layer in front of the `WallToolComponent` methods and serialisation of the model classes.

## Testing

`npm test` runs 55 Vitest unit tests on the non-rendering logic:

- `model/WallSegment.test.ts`: length, X/Z orientation, axis locking, zero-length, diagonal and non-finite rejection, minimum length, endpoint resizing (fixed end, axis projection, no flipping).
- `utils/math.test.ts`: grid snapping, floating-point clean-up, `-0` normalisation, invalid spacing.
- `utils/validation.test.ts`: dimension parsing and validation.
- `objects/WallMesh.test.ts`: geometry bounds match the dimensions, endpoint, height and thickness updates, invalid input leaves the wall unchanged, visual states, disposal, id sequencing.
- `tools/interaction.test.ts`: click-vs-drag detection, single selection, placement and preview cleanup.

The interactive workflows (the ten steps in the original brief, plus Escape handling, minimum-length clamping, invalid input and narrow layouts) were checked in headless Chromium against the production build. That script is not part of this repository.
# BimBim
