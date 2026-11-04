import { resolveFramingCorners } from '../model/wallFraming';
import { resolveJunctions } from '../model/wallJunctions';
import type { WallMesh } from '../objects/WallMesh';

/**
 * Re-closes every corner in a layout.
 *
 * The whole collection is resolved at once from the centrelines the walls were
 * drawn with, so the result depends only on where the walls are: not on the
 * order they were drawn in, the direction each one runs, or what was resolved
 * before. Walls that no longer meet anything go back to being plain boxes.
 *
 * Pass every wall that shares the layout, including the placement preview
 * while one is being drawn.
 */
export function applyWallJunctions(walls: Iterable<WallMesh>): void {
  const meshes = [...walls];
  const inputs = meshes.map((wall) => wall.toJunctionWall());
  const offsets = resolveJunctions(inputs);
  const corners = resolveFramingCorners(inputs);

  meshes.forEach((wall, index) => {
    const resolved = offsets[index];
    if (resolved) wall.setJunctionOffsets(resolved, corners[index]);
  });
}

