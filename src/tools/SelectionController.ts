import type { BaseMesh } from '../objects/BaseMesh';

/**
 * Single-selection and hover state for any BaseMesh. Keeps object visual
 * flags in sync so only one object is ever marked selected or hovered.
 */
export class SelectionController {
  private selectedObject: BaseMesh | null = null;
  private hoveredObject: BaseMesh | null = null;

  get selected(): BaseMesh | null {
    return this.selectedObject;
  }

  get hovered(): BaseMesh | null {
    return this.hoveredObject;
  }

  /** Returns true if the selection changed. */
  select(object: BaseMesh | null): boolean {
    if (object === this.selectedObject) return false;
    this.selectedObject?.setSelected(false);
    this.selectedObject = object;
    object?.setSelected(true);
    return true;
  }

  /** Returns true if the hovered object changed. */
  hover(object: BaseMesh | null): boolean {
    if (object === this.hoveredObject) return false;
    this.hoveredObject?.setHovered(false);
    this.hoveredObject = object;
    object?.setHovered(true);
    return true;
  }

  /** Drops any reference to an object that is about to be removed. */
  forget(object: BaseMesh): void {
    if (this.selectedObject === object) this.select(null);
    if (this.hoveredObject === object) this.hover(null);
  }

  clear(): void {
    this.select(null);
    this.hover(null);
  }
}
