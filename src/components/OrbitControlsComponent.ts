import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Component } from '../engine/Component';

/**
 * Orbit (left drag), pan (right drag, or Shift + left drag) and zoom (wheel)
 * navigation. Other components temporarily disable it through `setEnabled`
 * while they own the pointer, e.g. during handle dragging.
 */
export class OrbitControlsComponent extends Component {
  private controls: OrbitControls | null = null;

  override init(): void {
    const controls = new OrbitControls(this.world.camera, this.world.canvas);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.15;
    controls.minDistance = 1.5;
    controls.maxDistance = 120;
    // Keep the camera above the ground plane.
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    // Pan across the ground plane rather than the screen plane, as in plan-based CAD tools.
    controls.screenSpacePanning = false;
    controls.zoomToCursor = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.update();
    controls.saveState();
    this.controls = controls;
  }

  get enabled(): boolean {
    return this.controls?.enabled ?? false;
  }

  setEnabled(enabled: boolean): void {
    if (this.controls) this.controls.enabled = enabled;
  }

  /** Returns the camera to its initial position and target. */
  resetView(): void {
    this.controls?.reset();
  }

  override update(delta: number): void {
    this.controls?.update(delta);
  }

  override dispose(): void {
    this.controls?.dispose();
    this.controls = null;
  }
}
