import { Worlds } from './Worlds';

/** Longest frame step passed to components, so a backgrounded tab does not cause a jump. */
const MAX_DELTA_SECONDS = 0.1;

/** Owns the single animation loop and drives every registered World. */
export class Engine {
  readonly worlds = new Worlds();

  private frameHandle: number | null = null;
  private lastTimestamp: number | null = null;
  private disposed = false;

  get running(): boolean {
    return this.frameHandle !== null;
  }

  start(): void {
    if (this.disposed) throw new Error('Engine has been disposed.');
    if (this.running) return;
    this.lastTimestamp = null;
    this.frameHandle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.frameHandle !== null) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
    this.lastTimestamp = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.worlds.dispose();
    this.disposed = true;
  }

  private readonly tick = (timestamp: number): void => {
    const delta = this.lastTimestamp === null ? 0 : (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    this.worlds.update(Math.min(delta, MAX_DELTA_SECONDS));
    this.frameHandle = requestAnimationFrame(this.tick);
  };
}
