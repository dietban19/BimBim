import * as THREE from 'three';
import { Component } from '../engine/Component';
import type { BaseMesh } from '../objects/BaseMesh';
import type { PlanPoint } from '../types/geometry';

/** Anything with viewport client coordinates, such as a PointerEvent. */
export interface PointerPosition {
  readonly clientX: number;
  readonly clientY: number;
}

/**
 * Shared picking service. Converts pointer positions to normalised device
 * coordinates and casts rays against planes, arbitrary objects, or the
 * World's registered selectable BIM objects.
 */
export class RaycastComponent extends Component {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hitPoint = new THREE.Vector3();

  /** Converts client coordinates to NDC in [-1, 1], with +Y up. */
  toNdc(pointer: PointerPosition, target = new THREE.Vector2()): THREE.Vector2 {
    const rect = this.world.canvas.getBoundingClientRect();
    const width = rect.width || 1;
    const height = rect.height || 1;
    return target.set(
      ((pointer.clientX - rect.left) / width) * 2 - 1,
      -((pointer.clientY - rect.top) / height) * 2 + 1,
    );
  }

  /** Intersects the pointer ray with the horizontal plane at `elevation` (default: ground). */
  intersectHorizontalPlane(pointer: PointerPosition, elevation = 0): PlanPoint | null {
    this.aim(pointer);
    this.plane.constant = -elevation;
    const hit = this.raycaster.ray.intersectPlane(this.plane, this.hitPoint);
    return hit ? { x: hit.x, z: hit.z } : null;
  }

  /**
   * Intersects the pointer ray with the vertical plane perpendicular to `axis`
   * at `offset` (e.g. axis='z', offset=2 → the plane z=2). Returns the XZ hit
   * point, or null if the ray is parallel to the plane.
   *
   * Use this when placing elements on a wall: the wall's own centreline plane
   * gives an accurate XZ position regardless of camera angle, whereas the
   * ground plane (y=0) introduces a parallax offset for walls away from origin.
   */
  intersectVerticalPlane(pointer: PointerPosition, axis: 'x' | 'z', offset: number): PlanPoint | null {
    this.aim(pointer);
    const normal = axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const plane = new THREE.Plane(normal, -offset);
    const hit = this.raycaster.ray.intersectPlane(plane, this.hitPoint);
    return hit ? { x: hit.x, z: hit.z } : null;
  }

  intersectObjects(pointer: PointerPosition, objects: readonly THREE.Object3D[], recursive = false): THREE.Intersection[] {
    if (objects.length === 0) return [];
    this.aim(pointer);
    return this.raycaster.intersectObjects([...objects], recursive);
  }

  /** Returns the nearest registered selectable object under the pointer. */
  pickSelectable(pointer: PointerPosition): BaseMesh | null {
    const registry = this.world.selectables;
    const [nearest] = this.intersectObjects(pointer, registry.list());
    return nearest ? registry.resolve(nearest.object) : null;
  }

  private aim(pointer: PointerPosition): void {
    this.raycaster.setFromCamera(this.toNdc(pointer, this.ndc), this.world.camera);
  }
}
