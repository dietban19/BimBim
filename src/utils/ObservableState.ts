export type Listener = () => void;

/**
 * Minimal immutable state container that React can consume through
 * useSyncExternalStore. Listeners are only notified when a new snapshot is set.
 */
export class ObservableState<T extends object> {
  private snapshot: T;
  private readonly listeners = new Set<Listener>();

  constructor(initial: T) {
    this.snapshot = initial;
  }

  readonly get = (): T => this.snapshot;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Shallow-merges a patch; skips notification when no field changes identity. */
  update(patch: Partial<T>): void {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof T)[]) {
      if (!Object.is(this.snapshot[key], patch[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  clearListeners(): void {
    this.listeners.clear();
  }
}
