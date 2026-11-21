/** Consecutive timeouts that long make the adapter stalled (spec §8.6). */
export const STALL_AFTER_MS = 1000;

export interface StallTracker {
  readonly stalled: boolean;
  /** A batch that started at `startedAt` timed out at `now`. */
  timeout(startedAt: number, now: number): void;
  /** A batch that started at `startedAt` failed without timing out. It neither counts nor ends the run. */
  failed(startedAt: number, now: number): void;
  /** A batch got a reply at `now`. */
  good(now: number): void;
}

/**
 * Tracks `status.adapter.stalled` (spec §8.6). The run of timeouts starts at the first timed-out
 * batch's start. A good read ends it, and so does a pause of over a second with no batch at all.
 * A read that failed without timing out (a bridge error) neither counts nor ends the run, but it
 * does show that batches are still running. `onChange` runs when the flag flips.
 */
export function createStallTracker(
  onChange: (stalled: boolean) => void,
): StallTracker {
  let since: number | null = null;
  let lastBatchAt = -Infinity;
  let stalled = false;
  const set = (next: boolean) => {
    if (next === stalled) return;
    stalled = next;
    onChange(next);
  };
  /** A batch started at `startedAt`. A pause of over a second since the last one breaks the run. */
  const begin = (startedAt: number) => {
    if (startedAt - lastBatchAt > STALL_AFTER_MS) since = null;
  };
  return {
    get stalled() {
      return stalled;
    },
    timeout(startedAt, now) {
      begin(startedAt);
      since ??= startedAt;
      lastBatchAt = now;
      if (now - since >= STALL_AFTER_MS) set(true);
    },
    failed(startedAt, now) {
      begin(startedAt);
      lastBatchAt = now;
    },
    good(now) {
      lastBatchAt = now;
      since = null;
      set(false);
    },
  };
}
