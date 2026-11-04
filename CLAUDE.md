# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server at http://localhost:5173
npm run build        # type-check + production build to dist/
npm test             # run all unit tests once
npm run test:watch   # unit tests in watch mode
npm run typecheck    # TypeScript type-check only
npm run lint         # ESLint
```

To run a single test file: `npx vitest run src/model/WallSegment.test.ts`

Tests run in a Node environment (no DOM, no WebGL). Only pure logic is tested; rendering and interaction are not.

## Architecture

### Dependency direction

```
ui → editor → components → tools / objects → model / utils
```

Nothing below `ui` imports React. `model` and `utils` import neither React nor Three.js. This is enforced by convention, not tooling.

### Engine / World / Component

`Engine` owns the `requestAnimationFrame` loop and drives `Worlds`. A `World` owns one Three.js scene, camera, renderer, and a component registry. Components are registered via `world.add(ComponentClass, options)`, which constructs the component, enforces `static dependencies` (throws if a dependency isn't registered yet), calls `init()`, then `resize()`.

Components declare their dependencies statically:
```ts
static readonly dependencies = [RaycastComponent, GridComponent] as const;
```

`world.get(SomeComponent)` retrieves a typed instance; `world.dispose()` tears down components in reverse registration order.

The bootstrap order in `createEditor.ts` is: `RaycastComponent → GridComponent → OrbitControlsComponent → WallToolComponent`. This is the only valid registration order.

### UI ↔ Engine communication

**UI → engine:** The React UI calls typed command methods on the `EditorSession` (returned by `createEditor`), e.g. `walls.setMode()`, `walls.setWallHeight(id, v)`, `walls.deleteWall(id)`, `camera.resetView()`.

**Engine → UI:** `WallToolComponent` publishes snapshots to an `ObservableState<EditorState>`. React subscribes via `useEditorState(selector)`, which uses `useSyncExternalStore`. Snapshots are emitted on user actions, never per frame; unchanged slices keep reference identity.

`createEditor(container)` is called from a React ref callback on the viewport element. Its cleanup disposes the entire engine including WebGL resources.

### BIM objects

`BaseMesh` (extends `THREE.Mesh`) is the base for all 3D objects. It provides a `bimId`, kind, display name, selected/hovered state, and owns its geometry and material (one material per instance, so visual state changes are always isolated).

`WallSegment` (in `model/`) is a pure, immutable class with no Three.js dependency — all wall geometry math lives here and is fully unit tested. `WallMesh` (in `objects/`) wraps a `WallSegment` and turns it into a Three.js box + outline.

Resize rules (axis projection, fixed opposite end, minimum length, no flipping) live in `WallSegment.resizeEndpoint()`.

### Adding a new BIM element type

1. Create a pure model class (like `WallSegment`) for the math — keep it free of Three.js.
2. Subclass `BaseMesh` for the 3D object.
3. Add tool classes in `tools/` and/or a new component in `components/`.
4. Add an Inspector in `ui/`.

Persistence, undo/redo, and multiple storeys are not implemented. A command layer in front of `WallToolComponent` methods is the natural place to add them.
