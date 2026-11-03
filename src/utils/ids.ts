const counters = new Map<string, number>();

/**
 * Generates a readable identifier unique within the session, e.g. "wall-3".
 * crypto.randomUUID is avoided because it is unavailable on non-secure origins
 * such as a dev server reached over a LAN address.
 */
export function createId(prefix: string): { id: string; sequence: number } {
  const sequence = (counters.get(prefix) ?? 0) + 1;
  counters.set(prefix, sequence);
  return { id: `${prefix}-${sequence}`, sequence };
}
