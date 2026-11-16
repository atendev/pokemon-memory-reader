/** Injected into the read loop and adapters so tests drive time without sleeping. */
export interface Clock {
  now(): number;
  /** Returns a cancel function. */
  setTimeout(callback: () => void, ms: number): () => void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout(callback, ms) {
    const handle = setTimeout(callback, ms);
    return () => clearTimeout(handle);
  },
};
