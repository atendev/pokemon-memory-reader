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

test("a live adapter that reports a problem keeps it in the facade state after it drops", () => {
  const { made, selector } = build();
  made.mgba.answer();
  made.mgba.push({ connection: "disconnected", problem: "bridge_error" });
  expect(selector.list().live).toBeNull();
  expect(selector.adapter.state.problem).toBe("bridge_error");
  expect(selector.adapter.state.connection).toBe("disconnected");
});

test("a pin set during a switch wins and the switch reports adapter_pinned", async () => {
  const { made, selector } = build();
  made.mgba.answer();
  made.retroarch.push({ connection: "connected" });
  made.retroarch.push({ connection: "disconnected" });
  made.retroarch.lastMiss = null;
  const pending = selector.switchTo("retroarch");
  selector.setPin("mgba");
  made.retroarch.push({ connection: "connected" });
  expect(await pending).toMatchObject({ ok: false, code: "adapter_pinned" });
  expect(selector.list()).toMatchObject({ mode: "pinned", live: "mgba" });
});

test("a switch is not remembered by a fresh selector", async () => {
  const { made, selector } = build();
  made.mgba.answer();
  made.retroarch.push({ connection: "connected" });
  made.retroarch.push({ connection: "disconnected" });
  made.retroarch.lastMiss = null;
  const pending = selector.switchTo("retroarch");
  made.retroarch.push({ connection: "connected" });
  await pending;
  expect(selector.list().live).toBe("retroarch");
  expect(build().selector.list()).toMatchObject({ mode: "auto", live: null });
});

test("a live adapter that drops with no problem reads disconnected with no problem", () => {
  const { made, selector } = build();
  made.mgba.answer();
  made.mgba.push({ connection: "disconnected" });
  expect(selector.adapter.state).toMatchObject({
    connection: "disconnected",
    problem: null,
  });
  expect(selector.list().live).toBeNull();
});

/** Builds a fresh adapter on every create, so a rebuild shows as a second instance. */
function buildLive(
  pin: AdapterId | "auto" = "auto",
  scripted: readonly AdapterId[] = [],
) {
  const clock = new ManualClock();
  const endpoints = {
    mgba: { host: "127.0.0.1", port: 5000 },
    retroarch: { host: "127.0.0.1", port: 55355 },
    bizhawk: { host: "127.0.0.1", port: 5001 },
  };
  const made: Scripted[] = [];
  const created: { id: AdapterId; port: number }[] = [];
  const selector = createSelector({
    create: (id) => {
      if (id === "bizhawk") return null;
      const adapter = new Scripted(id, id === "retroarch");
      made.push(adapter);
      created.push({ id, port: endpoints[id].port });
      return adapter;
    },
    endpoint: (id) => endpoints[id],
    scripted,
    pin,
    clock,
    log: silentLog,
  });
  const latest = (id: AdapterId) =>
    made.filter((a) => a.id === id).at(-1) as Scripted;
  return { endpoints, made, created, selector, latest };
}

test("a changed mGBA endpoint closes the old adapter, builds a new one on the new endpoint and drops live", () => {
  const { endpoints, made, created, selector, latest } = buildLive();
  latest("retroarch").lastMiss = { kind: "refused", at: 1 };
  const old = latest("mgba");
  old.answer();
  expect(selector.list().live).toBe("mgba");
  endpoints.mgba = { host: "127.0.0.1", port: 6000 };
  selector.refreshEndpoints();
  expect(old.closedCount).toBe(1);
  expect(created.filter((c) => c.id === "mgba")).toEqual([
    { id: "mgba", port: 5000 },
    { id: "mgba", port: 6000 },
  ]);
  expect(made).toHaveLength(3);
  expect(selector.list().live).toBeNull();
  expect(selector.list().adapters[0]?.endpoint.port).toBe(6000);
  // The new adapter's own answer takes over, and nothing from the old session lingers.
  latest("mgba").answer();
  expect(selector.list().live).toBe("mgba");
  expect(latest("mgba")).not.toBe(old);
});

test("a changed RetroArch endpoint rebuilds only RetroArch", () => {
  const { endpoints, created, selector, latest } = buildLive();
  const mgba = latest("mgba");
  mgba.answer();
  const old = latest("retroarch");
  endpoints.retroarch = { host: "192.168.1.5", port: 55355 };
  selector.refreshEndpoints();
  expect(old.closedCount).toBe(1);
  expect(mgba.closedCount).toBe(0);
  expect(created.filter((c) => c.id === "retroarch")).toHaveLength(2);
  expect(selector.list().live).toBe("mgba");
  expect(latest("retroarch")).not.toBe(old);
});

test("a changed endpoint of the live RetroArch adapter drops it and a pinned selector rebuilds the pin", () => {
  const { endpoints, created, selector, latest } = buildLive("retroarch");
  const old = latest("retroarch");
  expect(selector.list().live).toBe("retroarch");
  endpoints.retroarch = { host: "127.0.0.1", port: 55400 };
  selector.refreshEndpoints();
  expect(old.closedCount).toBe(1);
  expect(created).toEqual([
    { id: "retroarch", port: 55355 },
    { id: "retroarch", port: 55400 },
  ]);
  expect(selector.list().live).toBe("retroarch");
  expect(latest("retroarch").mode).toBe("live");
});

test("an unchanged endpoint touches nothing", () => {
  const { endpoints, made, selector, created } = buildLive();
  latest(made).answer();
  endpoints.mgba = { ...endpoints.mgba };
  selector.refreshEndpoints();
  selector.refreshEndpoints();
  expect(created).toHaveLength(2);
  expect(made.every((a) => a.closedCount === 0)).toBe(true);
  expect(selector.list().live).toBe("mgba");
});

function latest(made: Scripted[]) {
  return made.find((a) => a.id === "mgba") as Scripted;
}

const stale = (selector: ReturnType<typeof buildLive>["selector"]) =>
  Object.fromEntries(
    selector.list().adapters.map((a) => [a.id, a.scriptStale]),
  );

test("a changed endpoint marks the scripted adapter's script stale until a script answers on the new one", () => {
  const { endpoints, selector, latest } = buildLive("auto", ["mgba"]);
  latest("mgba").answer();
  expect(stale(selector)).toEqual({ mgba: false, retroarch: false });
  endpoints.mgba = { host: "127.0.0.1", port: 6000 };
  selector.refreshEndpoints();
  expect(stale(selector)).toEqual({ mgba: true, retroarch: false });
  // A second refresh with nothing new keeps the flag.
  selector.refreshEndpoints();
  expect(stale(selector).mgba).toBe(true);
  // The rebuilt adapter connecting with no hello yet does not clear it.
  latest("mgba").push({ connection: "connecting" });
  expect(stale(selector).mgba).toBe(true);
  latest("mgba").answer();
  expect(stale(selector).mgba).toBe(false);
});

test("an unchanged endpoint never marks a script stale", () => {
  const { endpoints, selector, latest } = buildLive("auto", ["mgba"]);
  latest("mgba").answer();
  endpoints.mgba = { ...endpoints.mgba };
  selector.refreshEndpoints();
  expect(stale(selector).mgba).toBe(false);
});

test("a changed endpoint marks the script stale even while the pin keeps mGBA detached", () => {
  const { endpoints, selector } = buildLive("retroarch", ["mgba"]);
  endpoints.mgba = { host: "127.0.0.1", port: 6000 };
  selector.refreshEndpoints();
  expect(stale(selector).mgba).toBe(true);
});

test("an adapter with no script is never stale", () => {
  const { endpoints, selector } = buildLive("auto", ["mgba"]);
  endpoints.retroarch = { host: "127.0.0.1", port: 55400 };
  selector.refreshEndpoints();
  expect(stale(selector).retroarch).toBe(false);
});

test("a change that goes back to the endpoint the script was made for is not stale", () => {
  const { endpoints, selector, latest } = buildLive("auto", ["mgba"]);
  latest("mgba").answer();
  endpoints.mgba = { host: "127.0.0.1", port: 6000 };
  selector.refreshEndpoints();
  expect(stale(selector).mgba).toBe(true);
  endpoints.mgba = { host: "127.0.0.1", port: 5000 };
  selector.refreshEndpoints();
  expect(stale(selector).mgba).toBe(false);
});

test("a script that connects on the new endpoint becomes the baseline", () => {
  const { endpoints, selector, latest } = buildLive("auto", ["mgba"]);
  latest("mgba").answer();
  endpoints.mgba = { host: "127.0.0.1", port: 6000 };
  selector.refreshEndpoints();
  latest("mgba").answer();
  expect(stale(selector).mgba).toBe(false);
  endpoints.mgba = { host: "127.0.0.1", port: 5000 };
  selector.refreshEndpoints();
  expect(stale(selector).mgba).toBe(true);
});

test("a changed host alone marks the script stale", () => {
  const { endpoints, selector, latest } = buildLive("auto", ["mgba"]);
  latest("mgba").answer();
  endpoints.mgba = { host: "::1", port: 5000 };
  selector.refreshEndpoints();
  expect(stale(selector).mgba).toBe(true);
});
