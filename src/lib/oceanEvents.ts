/**
 * Tiny app-wide event channel for the ocean background. Any part of the UI can emit; the
 * background listens. Kept outside React so emitting never re-renders anything.
 */
export type OceanEvent =
  | { type: 'classification-success' }
  | { type: 'novel-taxon' }
  | { type: 'health'; healthy: boolean };

type Listener = (event: OceanEvent) => void;

const listeners = new Set<Listener>();

export function emitOceanEvent(event: OceanEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      // A visual effect must never break the action that triggered it
      console.warn('Ocean background listener failed:', err);
    }
  }
}

/** Subscribe; returns the unsubscribe function. */
export function onOceanEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
