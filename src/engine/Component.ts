import type { World } from './World';

/**
 * Constructor signature every component class satisfies. `O` is the options
 * object accepted by the component; components without options use `never`.
 */
export interface ComponentClass<T extends Component = Component, O = never> {
  new (world: World, options?: O): T;
  /** Components that must already be registered on the World before this one. */
  readonly dependencies: readonly AnyComponentClass[];
}

// `never` options make every concrete component class assignable to this type.
export type AnyComponentClass = ComponentClass<Component, never>;

/**
 * Base class for World-scoped systems. A component is created and initialised
 * by World.add and disposed by World.dispose; it should never be constructed
 * directly by application code.
 */
export abstract class Component {
  static readonly dependencies: readonly AnyComponentClass[] = [];

  protected readonly world: World;

  constructor(world: World) {
    this.world = world;
  }

  /** Called once after construction, when all declared dependencies exist. */
  init(): void {}

  /** Called every frame before the World renders. `delta` is in seconds. */
  update(_delta: number): void {}

  /** Called after the viewport size changes, with CSS pixel dimensions. */
  resize(_width: number, _height: number): void {}

  /** Release owned resources and event listeners. Called in reverse registration order. */
  dispose(): void {}
}
