import { World, type WorldOptions } from './World';

/** Registry and lifecycle owner for every World in the application. */
export class Worlds {
  private readonly worlds = new Map<string, World>();

  create(id: string, options: WorldOptions): World {
    if (this.worlds.has(id)) {
      throw new Error(`A world with id "${id}" already exists.`);
    }
    const world = new World(id, options);
    this.worlds.set(id, world);
    return world;
  }

  get(id: string): World {
    const world = this.worlds.get(id);
    if (!world) throw new Error(`No world with id "${id}".`);
    return world;
  }

  has(id: string): boolean {
    return this.worlds.has(id);
  }

  remove(id: string): void {
    const world = this.worlds.get(id);
    if (!world) return;
    this.worlds.delete(id);
    world.dispose();
  }

  update(delta: number): void {
    for (const world of this.worlds.values()) world.update(delta);
  }

  dispose(): void {
    for (const world of this.worlds.values()) world.dispose();
    this.worlds.clear();
  }
}
