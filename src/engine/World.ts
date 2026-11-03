import * as THREE from 'three';
import type { AnyComponentClass, Component, ComponentClass } from './Component';
import { SelectableRegistry } from './SelectableRegistry';

export interface WorldOptions {
  /** Element the renderer canvas is appended to; its size drives the viewport. */
  readonly container: HTMLElement;
  readonly background?: THREE.ColorRepresentation;
}

const DEFAULT_BACKGROUND = 0x2b2b2b;

/**
 * One Three.js environment: scene, camera, renderer, lights and the
 * components that operate on them. Contains no BIM-object business logic.
 */
export class World {
  readonly id: string;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly selectables = new SelectableRegistry();
  readonly container: HTMLElement;

  private readonly components = new Map<AnyComponentClass, Component>();
  private readonly resizeObserver: ResizeObserver;
  private width = 1;
  private height = 1;
  private disposed = false;

  constructor(id: string, options: WorldOptions) {
    this.id = id;
    this.container = options.container;

    this.scene.background = new THREE.Color(options.background ?? DEFAULT_BACKGROUND);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 1000);
    this.camera.position.set(14, 11, 14);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.classList.add('viewport-canvas');
    this.container.appendChild(this.renderer.domElement);

    this.addLights();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Creates, registers and initialises a component. Throws if the component
   * is already registered or if any declared dependency has not been added,
   * so the registration order in the bootstrap code is always valid.
   */
  add<T extends Component, O>(Ctor: ComponentClass<T, O>, options?: O): T {
    this.assertNotDisposed();
    if (this.components.has(Ctor)) {
      throw new Error(`${Ctor.name} is already registered on world "${this.id}".`);
    }
    for (const dependency of Ctor.dependencies) {
      if (!this.components.has(dependency)) {
        throw new Error(`${Ctor.name} requires ${dependency.name}; add it to world "${this.id}" first.`);
      }
    }

    const component = options === undefined ? new Ctor(this) : new Ctor(this, options);
    this.components.set(Ctor, component);
    component.init();
    component.resize(this.width, this.height);
    return component;
  }

  get<T extends Component>(Ctor: ComponentClass<T, never>): T {
    const component = this.components.get(Ctor);
    if (!(component instanceof Ctor)) {
      throw new Error(`${Ctor.name} is not registered on world "${this.id}".`);
    }
    return component;
  }

  has(Ctor: AnyComponentClass): boolean {
    return this.components.has(Ctor);
  }

  update(delta: number): void {
    if (this.disposed) return;
    for (const component of this.components.values()) component.update(delta);
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    if (this.disposed) return;
    const width = Math.max(1, Math.floor(this.container.clientWidth));
    const height = Math.max(1, Math.floor(this.container.clientHeight));
    if (width === this.width && height === this.height) return;

    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    for (const component of this.components.values()) component.resize(width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver.disconnect();

    const registered = [...this.components.values()].reverse();
    for (const component of registered) component.dispose();
    this.components.clear();
    this.selectables.clear();

    this.disposeLights();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private addLights(): void {
    const hemisphere = new THREE.HemisphereLight(0xdfe4ea, 0x3a3a3a, 1.4);
    hemisphere.name = 'world-hemisphere-light';
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    ambient.name = 'world-ambient-light';
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.name = 'world-directional-light';
    sun.position.set(12, 20, 8);
    this.scene.add(hemisphere, ambient, sun);
  }

  private disposeLights(): void {
    const lights: THREE.Light[] = [];
    this.scene.traverse((object) => {
      if (object instanceof THREE.Light) lights.push(object);
    });
    for (const light of lights) {
      light.dispose();
      light.removeFromParent();
    }
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error(`World "${this.id}" has been disposed.`);
  }
}
