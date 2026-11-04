# Doors and Windows

This document describes how doors and windows (collectively "openings") work in this BIM editor.

## Using the Feature

### Placing an Opening

1. Draw at least one wall using the Wall tool.
2. Click the wall to select it.
3. Click the **Openings** button in the toolbar to open the menu.
4. Choose a door or window type from the list.
5. The editor enters **Place Opening** mode (shown in the viewport overlay).
6. Move the pointer over the viewport — a translucent preview follows the cursor along the wall.
7. Click to place the opening at that position.
8. Press **Esc** to cancel placement without placing.

You can place multiple openings of the same type without leaving the mode.

### Editing an Opening

Select the wall that contains the opening. In the **Inspector** panel, an **Openings** section lists all openings on that wall. Click an opening row to expand it and edit its dimensions:

| Field | Applies to | Limits |
|-------|-----------|--------|
| Width | Doors and Windows | 0.3 – 6 m |
| Height | Doors and Windows | 0.3 – 4 m |
| Sill height | Windows only | 0.01 – 3 m |

Doors always start at floor level (sill height = 0 and is not editable). The opening is clamped to fit within the wall length automatically.

### Deleting an Opening

Expand the opening in the Inspector and click **Delete**. Deleting a wall also removes all its openings.

---

## Opening Types

### Doors

| Type | Default size | Description |
|------|-------------|-------------|
| Single Door | 0.9 m × 2.1 m | Standard single-leaf hinged door |
| Double Door | 0.9 m × 2.1 m | Double-leaf door (adjust width to taste) |
| Sliding Door | 0.9 m × 2.1 m | Horizontally sliding panel |

### Windows

| Type | Default size | Sill | Description |
|------|-------------|------|-------------|
| Fixed Window | 1.2 m × 1.2 m | 0.9 m | Non-opening fixed pane |
| Casement Window | 1.2 m × 1.2 m | 0.9 m | Side-hinged opening sash |
| Sliding Window | 1.2 m × 1.2 m | 0.9 m | Horizontally sliding sash |
| Awning Window | 1.2 m × 1.2 m | 0.9 m | Top-hinged outward-opening sash |

---

## Architecture

```
src/
  model/openingDimensions.ts  — defaults, dimension limits, type labels
  objects/OpeningMesh.ts      — Three.js mesh, extends BaseMesh
  types/editor.ts             — OpeningKind, OpeningType, OpeningSummary, EditorState fields
  components/WallToolComponent.ts — opening commands, placement mode, preview
  ui/WallInspector.tsx        — OpeningsSection with editable NumberFields
  ui/Toolbar.tsx              — OpeningsDropdown with door/window submenu
```

### How Openings are Stored

`OpeningMesh` extends `BaseMesh` (the same base as `WallMesh`). Each opening is added as a **child of its wall mesh**, so it inherits the wall's world transform automatically. `WallToolComponent` also keeps a `Map<string, OpeningMesh>` for fast lookup by id.

Because `SelectableRegistry.resolve` traverses the parent chain, clicking an opening mesh in the viewport selects its parent wall rather than the opening itself — which is the intended behaviour.

### Positioning

An opening is located using a normalised offset `t ∈ [0, 1]` measured from the wall's start endpoint. In the wall's local coordinate space (X = wall length, Y = up, Z = through thickness):

```
localX = (t – 0.5) × wallLength
localY = bottomHeight + openingHeight/2 – wallHeight/2
localZ = 0  (centred through the wall)
```

The opening box is `wallThickness + 0.02 m` thick so it protrudes through both wall faces.

`syncToWall(wall)` recalculates position and rebuilds the box. It is called after placement and whenever the host wall's height, thickness, or length changes.

### Visual Representation

Openings are rendered as coloured boxes overlaid on the wall:

- **Doors** — very dark near-black fill with dark edge lines
- **Windows** — semi-transparent blue-tinted fill (glass effect)

Preview openings use the same colours at reduced opacity. There is no CSG geometry subtraction — the wall mesh is not actually cut. This is an intentional simplification; true void geometry would require a CSG library.

### Extending

**Add a new type to an existing kind** (e.g. a Pocket Door):

1. Add `'pocket-door'` to `DoorType` in `src/types/editor.ts`.
2. Add it to `DOOR_TYPES` and `OPENING_TYPE_LABELS` in `src/model/openingDimensions.ts`.
3. The toolbar dropdown and inspector pick it up automatically.

**Add a new kind** (e.g. skylights):

1. Add a new string to `OpeningKind` in `src/types/editor.ts`.
2. Add visual styles for it in `src/objects/visualStyle.ts`.
3. Update `OpeningMesh.applyVisualState` to use the new styles.
4. Add a new toolbar section in `OpeningsDropdown`.
