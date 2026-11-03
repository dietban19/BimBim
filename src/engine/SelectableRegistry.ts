import type { Object3D } from 'three';
import { BaseMesh } from '../objects/BaseMesh';

/**
 * Tracks the BIM objects in a World that can be picked in the viewport.
 * Preview geometry, helpers and handles are deliberately never registered.
 */
export class SelectableRegistry {
  private readonly objects = new Map<string, BaseMesh>();

  add(object: BaseMesh): void {
    if (this.objects.has(object.bimId)) {
      throw new Error(`Selectable "${object.bimId}" is already registered.`);
    }
    this.objects.set(object.bimId, object);
  }

  remove(object: BaseMesh): void {
    this.objects.delete(object.bimId);
  }

  get(id: string): BaseMesh | undefined {
    return this.objects.get(id);
  }

  has(object: BaseMesh): boolean {
    return this.objects.get(object.bimId) === object;
  }

  list(): BaseMesh[] {
    return [...this.objects.values()];
  }

  /** Resolves a raycast hit, which may be a child object, to its owning selectable. */
  resolve(hit: Object3D): BaseMesh | null {
    let current: Object3D | null = hit;
    while (current) {
      if (current instanceof BaseMesh && this.has(current)) return current;
      current = current.parent;
    }
    return null;
  }

  clear(): void {
    this.objects.clear();
  }
}
