import type { Clock } from "../../src/clock";

/** A clock that only moves when a test says so. Timers fire in due order. */
export class ManualClock implements Clock {
  #now = 0;
  #timers: { at: number; run: () => void; live: boolean }[] = [];

  now(): number {
    return this.#now;
  }

  setTimeout(callback: () => void, ms: number): () => void {
    const timer = { at: this.#now + ms, run: callback, live: true };
    this.#timers.push(timer);
    return () => {
      timer.live = false;
    };
  }

  advance(ms: number): void {
    const target = this.#now + ms;
    for (;;) {
      const due = this.#timers
        .filter((t) => t.live && t.at <= target)
        .sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      due.live = false;
      this.#now = Math.max(this.#now, due.at);
      due.run();
    }
    this.#now = target;
    this.#timers = this.#timers.filter((t) => t.live);
  }
}
