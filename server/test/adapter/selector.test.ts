import { expect, test } from "bun:test";
import { createSelector } from "../../src/adapter/selector";
import type {
  AdapterId,
  AdapterMode,
  AdapterState,
  ManagedAdapter,
  ProbeMiss,
} from "../../src/adapter/types";
import { silentLog } from "../../src/log";
import { ManualClock } from "../bridge/manual-clock";

const HELLO = {
  bridge: "mgba",
  protocol: 1,
  build: null,
  emulator: null,
};
const START: AdapterState = {
  connection: "connecting",
  bridge: null,
  problem: null,
  game: null,
  gameEpoch: 0,
};

/** A managed adapter a test drives by hand. `answer` is a usable hello, `refuse` a refused connect. */
class Scripted implements ManagedAdapter {
  readonly priority = 0;
  readonly limits = { minIntervalMs: 0, mergeGap: 32 };
  readonly modes: AdapterMode[] = ["probe"];
  lastMiss: ProbeMiss | null | undefined;
  state: AdapterState = START;
  closedCount = 0;
  #listeners = new Set<(s: AdapterState) => void>();
  constructor(
    readonly id: AdapterId,
    retroarch = false,
  ) {
    if (retroarch) {
      this.lastMiss = null;
      this.state = { ...START, connection: "disconnected" };
    }
  }
  get mode() {
    return this.modes[this.modes.length - 1];
  }
  subscribe(l: (s: AdapterState) => void) {
    this.#listeners.add(l);
    return () => this.#listeners.delete(l);
  }
  setMode(m: AdapterMode) {
    if (m !== this.mode) this.modes.push(m);
  }
  read() {
    return Promise.resolve({ kind: "failed", reason: "disconnected" } as const);
  }
  async close() {
    this.closedCount += 1;
  }
  push(change: Partial<AdapterState>) {
    this.state = { ...this.state, ...change };
    for (const l of [...this.#listeners]) l(this.state);
  }
  answer() {
    this.push({
      connection: "connected",
      bridge: { ...HELLO, bridge: this.id },
      problem: null,
    });
    // A probe closes right after the hello unless the selector took the connection.
    if (this.mode === "probe") this.push({ connection: "disconnected" });
  }
  refuse() {
    this.push({ connection: "disconnected", bridge: null, problem: null });
  }
}

function build(pin: AdapterId | "auto" = "auto") {
  const clock = new ManualClock();
  const made = {
    mgba: new Scripted("mgba"),
    retroarch: new Scripted("retroarch", true),
  };
  const selector = createSelector({
    create: (id) => (id === "bizhawk" ? null : made[id]),
    endpoint: () => ({ host: "127.0.0.1", port: 1 }),
    pin,
    clock,
    log: silentLog,
  });
  return { clock, made, selector };
}
const results = (s: ReturnType<typeof build>["selector"]) =>
  Object.fromEntries(s.list().adapters.map((a) => [a.id, a.probe.result]));

test("discovery with only the bridge goes live on mGBA", () => {
  const { made, selector } = build();
  made.retroarch.lastMiss = { kind: "refused", at: 1 };
  made.mgba.answer();
  expect(selector.list().live).toBe("mgba");
  expect(made.mgba.mode).toBe("live");
  expect(results(selector).mgba).toBe("live");
});

test("discovery with only RetroArch waits for mGBA to settle, then goes live on RetroArch", () => {
  const { made, selector } = build();
  made.retroarch.push({ connection: "connected" });
  expect(selector.list().live).toBeNull();
  expect(made.retroarch.mode).toBe("hold");
  made.mgba.refuse();
  expect(selector.list().live).toBe("retroarch");
  expect(results(selector).mgba).toBe("refused");
});

test("discovery with both picks mGBA by priority, even when RetroArch answers first", () => {
  const { made, selector } = build();
  made.retroarch.push({ connection: "connected" });
  made.mgba.answer();
  expect(selector.list().live).toBe("mgba");
  expect(made.retroarch.mode).toBe("probe");
  expect(results(selector).retroarch).toBe("usable");
});

test("discovery with neither stays disconnected and shows refused and no_reply", () => {
  const { clock, made, selector } = build();
  made.mgba.refuse();
  made.retroarch.lastMiss = { kind: "no_reply", at: clock.now() };
  clock.advance(1600);
  expect(selector.list().live).toBeNull();
  expect(results(selector)).toEqual({ mgba: "refused", retroarch: "no_reply" });
  expect(selector.adapter.state.connection).toBe("disconnected");
});

test("a problem bridge shows in status while nothing is usable", () => {
  const { made, selector } = build();
  made.mgba.push({
    connection: "connected",
    problem: "protocol_mismatch",
    bridge: { ...HELLO, protocol: 99 },
  });
  expect(selector.adapter.id).toBe("mgba");
  expect(selector.adapter.state.problem).toBe("protocol_mismatch");
  expect(results(selector).mgba).toBe("problem");
});

test("a switch changes the live adapter, bumps the epoch and returns the old one to probing", async () => {
  const { made, selector } = build();
  made.mgba.answer();
  made.retroarch.push({ connection: "connected" });
  made.retroarch.push({ connection: "disconnected" });
  made.retroarch.lastMiss = null;
  const seen: number[] = [];
  selector.adapter.subscribe((s) => seen.push(s.gameEpoch));
  const before = selector.adapter.state.gameEpoch;
  const pending = selector.switchTo("retroarch");
  made.retroarch.push({ connection: "connected" });
  expect(await pending).toEqual({ ok: true, live: "retroarch" });
  expect(selector.list().live).toBe("retroarch");
  expect(made.mgba.mode).toBe("probe");
  expect(selector.adapter.state.gameEpoch).toBeGreaterThan(before);
  expect(seen.length).toBeGreaterThan(0);
});

test("a failed switch keeps the old adapter live", async () => {
  const { clock, made, selector } = build();
  made.mgba.answer();
  made.retroarch.push({ connection: "connected" });
  made.retroarch.push({ connection: "disconnected" });
  const pending = selector.switchTo("retroarch");
  clock.advance(1100);
  const result = await pending;
  expect(result).toMatchObject({ ok: false, code: "adapter_connect_failed" });
  expect(selector.list().live).toBe("mgba");
  expect(made.retroarch.mode).toBe("probe");
});

test("a switch to a target that is not usable, or while pinned, is refused", async () => {
  const auto = build();
  auto.made.mgba.answer();
  auto.made.retroarch.lastMiss = { kind: "refused", at: 1 };
  expect(await auto.selector.switchTo("retroarch")).toMatchObject({
    code: "adapter_not_usable",
  });
  expect(await auto.selector.switchTo("mgba")).toEqual({
    ok: true,
    live: "mgba",
  });
  const pinned = build("mgba");
  expect(await pinned.selector.switchTo("retroarch")).toMatchObject({
    code: "adapter_pinned",
  });
  expect(await pinned.selector.probeNow()).toMatchObject({
    code: "adapter_pinned",
  });
});

test("a pin closes the other adapters and a restart returns to the configured default", async () => {
  const { made, selector } = build("auto");
  made.mgba.answer();
  selector.setPin("retroarch");
  expect(selector.list()).toMatchObject({ mode: "pinned", live: "retroarch" });
  expect(made.mgba.closedCount).toBe(1);
  // A new selector with the configured default knows nothing of the earlier switch or pin.
  const fresh = build("auto");
  expect(fresh.selector.list()).toMatchObject({ mode: "auto", live: null });
});

test("the live adapter disconnecting drops it and resumes probing", () => {
  const { made, selector } = build();
  made.mgba.answer();
  made.mgba.push({ connection: "disconnected" });
  expect(selector.list().live).toBeNull();
  // Its last hello still reads usable, so it reconnects now and is held if it answers again.
  expect(made.mgba.mode).not.toBe("live");
  made.mgba.push({ connection: "connected" });
  expect(selector.list().live).toBe("mgba");
});
