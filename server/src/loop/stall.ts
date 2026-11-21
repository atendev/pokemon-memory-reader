/** Consecutive timeouts that long make the adapter stalled (spec §8.6). */
export const STALL_AFTER_MS = 1000;

export interface StallTracker {
  readonly stalled: boolean;
  /** A batch that started at `startedAt` timed out at `now`. */
  timeout(startedAt: number, now: number): void;
  /** A batch got a reply. */
  good(): void;
}

/**
 * Tracks `status.adapter.stalled` (spec §8.6). The run of timeouts starts at the first timed-out
 * batch's start and any good read ends it. A read that failed without timing out (a bridge error)
 * is neither, so callers don't report it. `onChange` runs when the flag flips.
 */
export function createStallTracker(
  onChange: (stalled: boolean) => void,
): StallTracker {
  let since: number | null = null;
  let stalled = false;
  const set = (next: boolean) => {
    if (next === stalled) return;
    stalled = next;
    onChange(next);
  };
  return {
    get stalled() {
      return stalled;
    },
    timeout(startedAt, now) {
      since ??= startedAt;
      if (now - since >= STALL_AFTER_MS) set(true);
    },
    good() {
      since = null;
      set(false);
    },
  };
}
