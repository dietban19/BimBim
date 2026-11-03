import * as THREE from 'three';
import { createId } from '../utils/ids';
import type { VisualState } from './visualStyle';

/**
 * Common base for every BIM object rendered in a World. Provides identity,
 * selection/hover state and ownership of its geometry and material.
 *
 * Each instance owns its own material, so changing one object's visual state
 * never affects another and disposal is always safe.
 */
export abstract class BaseMesh extends THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  readonly bimId: string;
  readonly kind: string;

  private selected = false;
  private hovered = false;
  private disposed = false;

  /**
   * @param idPrefix Counter namespace for the id; lets transient objects such as
   * previews avoid consuming the sequence numbers shown for real objects.
   */
  protected constructor(kind: string, displayLabel: string, idPrefix: string = kind) {
    super(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }));
    const { id, sequence } = createId(idPrefix);
    this.bimId = id;
    this.kind = kind;
    this.name = `${displayLabel} ${sequence}`;
  }

  get isSelected(): boolean {
    return this.selected;
  }

  get isHovered(): boolean {
    return this.hovered;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  setSelected(selected: boolean): void {
    if (this.selected === selected) return;
    this.selected = selected;
    this.refreshVisualState();
  }

  setHovered(hovered: boolean): void {
    if (this.hovered === hovered) return;
    this.hovered = hovered;
    this.refreshVisualState();
  }

  /** Removes the object from its parent and frees GPU resources it owns. Idempotent. */
  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeFromParent();
    this.disposeOwnedResources();
    this.geometry.dispose();
    this.material.dispose();
    super.dispose();
  }

  /** Replaces the owned geometry, disposing the previous buffer. */
  protected replaceGeometry(geometry: THREE.BufferGeometry): void {
    const previous = this.geometry;
    this.geometry = geometry;
    previous.dispose();
  }

  protected get visualState(): VisualState {
    if (this.selected) return 'selected';
    if (this.hovered) return 'hovered';
    return 'default';
  }

  /** Re-applies appearance for the current state. Subclasses call this at the end of construction. */
  protected refreshVisualState(): void {
    this.applyVisualState(this.visualState);
  }

  protected abstract applyVisualState(state: VisualState): void;

  /** Hook for subclasses to dispose additional resources such as child helpers. */
  protected disposeOwnedResources(): void {}
}
