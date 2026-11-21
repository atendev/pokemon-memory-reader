import type {
  AdaptersBody,
  ProbeResult,
} from "@pokemon-memory-reader/internal/adapters-route";
import type { InternalErrorCode } from "@pokemon-memory-reader/internal/errors";
import type { Clock } from "../clock";
import type { Log } from "../log";
import type {
  Adapter,
  AdapterId,
  AdapterState,
  Endpoint,
  ManagedAdapter,
} from "./types";

/** Priority order (spec §3.3). */
export const ADAPTER_PRIORITY: readonly AdapterId[] = [
  "mgba",
  "retroarch",
  "bizhawk",
];

/** Long enough for RetroArch's 1 s probe, so a silent higher-priority adapter stops holding a lower one back. */
const SETTLE_MS = 1500;
/** The hello timer (spec §4.7), and RetroArch's `GET_STATUS` wait (amendment 026). */
const BRIDGE_CHECK_MS = 3000;
const RETROARCH_CHECK_MS = 1000;

const DISCONNECTED: AdapterState = {
  connection: "disconnected",
  bridge: null,
  problem: null,
  game: null,
  gameEpoch: 0,
};

type Probe = AdaptersBody["adapters"][number]["probe"];
type Refusal = {
  readonly ok: false;
  readonly code: Extract<
    InternalErrorCode,
    | "adapter_pinned"
    | "adapter_not_usable"
    | "adapter_connect_failed"
    | "switch_in_progress"
  >;
  readonly message: string;
};
export type SwitchResult =
  | { readonly ok: true; readonly live: AdapterId }
  | Refusal;
export type ProbeNowResult =
  | { readonly ok: true; readonly body: AdaptersBody }
  | Refusal;

export interface SelectorDeps {
  /** Builds the long-lived adapter for an id. Ids the build doesn't ship return null. */
  readonly create: (id: AdapterId) => ManagedAdapter | null;
  readonly endpoint: (id: AdapterId) => Endpoint;
  /** The `adapter` setting at startup. */
  readonly pin: AdapterId | "auto";
  readonly clock: Clock;
  readonly log: Log;
}

export interface Selector {
  /** What the read loop reads. It follows whichever adapter is live (spec §3.3). */
  readonly adapter: Adapter;
  /** The last known state of every adapter. Never probes. */
  list(): AdaptersBody;
  probeNow(): Promise<ProbeNowResult>;
  /** A switch for this run only. It never touches the pin or the config. */
  switchTo(id: AdapterId): Promise<SwitchResult>;
  /** A live `adapter` setting change. */
  setPin(pin: AdapterId | "auto"): void;
  /** A live `adapters` setting change. Rebuilds each adapter whose endpoint differs from the one it was built with. */
  refreshEndpoints(): void;
  close(): Promise<void>;
}

interface Seen {
  /** The last time the selector saw this adapter answer, for the retention of a usable result after a probe closes. */
  usableAt: number | null;
  settled: boolean;
  checkedAt: number | null;
}

/**
 * Discovery, the live adapter and the switch (spec §3.3, amendment 021 items 5-7). Each
 * managed adapter probes by itself in `probe` mode. The selector decides inside that adapter's
 * state listener, so a usable connection carries over into `live` or `hold`.
 */
export function createSelector(deps: SelectorDeps): Selector {
  const { clock, log } = deps;
  const startedAt = clock.now();
  const adapters = new Map<AdapterId, ManagedAdapter>();
  const records = new Map<AdapterId, Seen>();
  const unsubscribe = new Map<AdapterId, () => void>();
  /** The endpoint each attached adapter was built with. */
  const built = new Map<AdapterId, Endpoint>();
  const listeners = new Set<(state: AdapterState) => void>();
  let pin: AdapterId | "auto" = deps.pin;
  let live: ManagedAdapter | null = null;
  let busy: "switch" | "probe" | null = null;
  let probeRun: Promise<void> | null = null;
  let epoch = 0;
  let underlying = 0;
  let closed = false;
  let emitted: AdapterState = DISCONNECTED;

  const ordered = (): ManagedAdapter[] =>
    ADAPTER_PRIORITY.flatMap((id) => adapters.get(id) ?? []);
  const connected = (a: ManagedAdapter): boolean =>
    a.state.connection === "connected" && a.state.problem === null;

  // --- the facade the read loop reads ---

  /** While nothing is live, `status.adapter` describes the first problem adapter in priority order (spec §4.7). */
  const problemAdapter = (): ManagedAdapter | undefined =>
    ordered().find((a) => a.state.problem !== null);
  const facadeState = (): AdapterState => {
    if (live !== null) return { ...live.state, gameEpoch: epoch };
    const worst = problemAdapter();
    return worst === undefined
      ? { ...DISCONNECTED, gameEpoch: epoch }
      : {
          ...worst.state,
          connection: "disconnected",
          game: null,
          gameEpoch: epoch,
        };
  };
  const refreshFacade = (): void => {
    const next = facadeState();
    const same =
      next.connection === emitted.connection &&
      next.bridge === emitted.bridge &&
      next.problem === emitted.problem &&
      next.game === emitted.game &&
      next.gameEpoch === emitted.gameEpoch;
    if (same) return;
    emitted = next;
    for (const listener of [...listeners]) listener(next);
  };

  const facade: Adapter = {
    get id() {
      return (live ?? problemAdapter() ?? ordered()[0])?.id ?? "mgba";
    },
    get limits() {
      return live?.limits ?? { minIntervalMs: 0, mergeGap: 32 };
    },
    get state() {
      return emitted;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    read: (ranges, timeoutMs) =>
      live === null
        ? Promise.resolve({ kind: "failed", reason: "disconnected" })
        : live.read(ranges, timeoutMs),
  };

  // --- probe results ---

  const record = (id: AdapterId): Seen => {
    let found = records.get(id);
    if (!found) {
      found = { usableAt: null, settled: false, checkedAt: null };
      records.set(id, found);
    }
    return found;
  };

  function probeOf(id: AdapterId): Probe {
    const a = adapters.get(id);
    const rec = record(id);
    const none = (result: ProbeResult): Probe => ({
      result,
      bridge: null,
      problem: null,
      checkedAt: null,
    });
    if (a === undefined) return none("not_probed");
    const s = a.state;
    const checkedAt =
      rec.checkedAt === null ? null : new Date(rec.checkedAt).toISOString();
    const hello = s.bridge === null ? null : { ...s.bridge };
    if (a === live && connected(a))
      return { result: "live", bridge: hello, problem: null, checkedAt };
    if (s.problem === "busy")
      return { result: "busy", bridge: hello, problem: null, checkedAt };
    if (s.problem !== null)
      return {
        result: "problem",
        bridge: hello,
        problem: s.problem,
        checkedAt,
      };
    if (a.lastMiss !== undefined) {
      // RetroArch: a miss changes no state, and an answered probe leaves `disconnected` behind.
      const miss = a.lastMiss;
      if (
        connected(a) ||
        (rec.usableAt !== null && (miss === null || miss.at < rec.usableAt))
      )
        return { result: "usable", bridge: null, problem: null, checkedAt };
      if (miss !== null)
        return {
          result: miss.kind,
          bridge: null,
          problem: null,
          checkedAt: new Date(miss.at).toISOString(),
        };
      return none("not_probed");
    }
    if (s.connection === "connected" || s.bridge !== null)
      return { result: "usable", bridge: hello, problem: null, checkedAt };
    if (rec.settled && s.connection === "disconnected")
      return { result: "refused", bridge: null, problem: null, checkedAt };
    return none("not_probed");
  }

  // --- deciding ---

  function goLive(a: ManagedAdapter): void {
    const old = live;
    live = a;
    epoch += 1;
    underlying = a.state.gameEpoch;
    a.setMode("live");
    for (const other of ordered()) if (other !== a) other.setMode("probe");
    log.info("adapter is live", { adapter: a.id, previous: old?.id ?? null });
  }

  function evaluate(): void {
    if (closed || live !== null || busy === "switch" || pin !== "auto") return;
    const waiting = clock.now() - startedAt < SETTLE_MS;
    let blocked = false;
    for (const a of ordered()) {
      const result = probeOf(a.id).result;
      if (!blocked) {
        if (result === "usable") {
          if (connected(a)) {
            goLive(a);
            return;
          }
          // Its probe connection closed. Connect again now and keep it open.
          blocked = true;
          a.setMode("hold");
        } else if (result === "not_probed" && waiting) blocked = true;
      } else if (result === "usable" && connected(a)) a.setMode("hold");
    }
  }

  function onState(
    id: AdapterId,
    a: ManagedAdapter,
    state: AdapterState,
  ): void {
    if (closed || adapters.get(id) !== a) return;
    const rec = record(id);
    if (state.connection !== "connecting") {
      rec.settled = true;
      rec.checkedAt = clock.now();
    }
    if (a.lastMiss !== undefined && connected(a)) rec.usableAt = clock.now();
    if (a === live && pin === "auto" && state.connection === "disconnected") {
      // It stopped answering. Auto probing resumes in priority order (spec §3.3).
      log.warn("the live adapter disconnected", { adapter: id });
      live = null;
      epoch += 1;
      underlying = 0;
      a.setMode("probe");
    } else if (a === live && state.gameEpoch !== underlying) {
      underlying = state.gameEpoch;
      epoch += 1;
    }
    evaluate();
    refreshFacade();
  }

  function attach(id: AdapterId): ManagedAdapter | null {
    const existing = adapters.get(id);
    if (existing) return existing;
    const endpoint = { ...deps.endpoint(id) };
    const made = deps.create(id);
    if (made === null) return null;
    adapters.set(id, made);
    built.set(id, endpoint);
    unsubscribe.set(
      id,
      made.subscribe((state) => onState(id, made, state)),
    );
    const state = made.state;
    // An adapter built mid-run may already have a state the listener never saw.
    if (state.connection !== "connecting") onState(id, made, state);
    return made;
  }

  async function detach(id: AdapterId): Promise<void> {
    const a = adapters.get(id);
    if (!a) return;
    unsubscribe.get(id)?.();
    unsubscribe.delete(id);
    adapters.delete(id);
    built.delete(id);
    records.delete(id);
    if (live === a) {
      live = null;
      epoch += 1;
      underlying = 0;
    }
    await a.close();
  }

  function refreshEndpoints(): void {
    if (closed) return;
    let rebuilt = false;
    for (const [id, was] of [...built]) {
      const now = deps.endpoint(id);
      if (now.host === was.host && now.port === was.port) continue;
      log.info("adapter endpoint changed", { adapter: id, ...now });
      void detach(id);
      rebuilt = true;
    }
    if (!rebuilt) return;
    // Rebuilds what is missing: every adapter in auto, the pinned one when pinned.
    applyPin();
    refreshFacade();
  }

  function applyPin(): void {
    if (pin === "auto") {
      for (const id of ADAPTER_PRIORITY) attach(id);
      evaluate();
      return;
    }
    const target = attach(pin);
    for (const id of ADAPTER_PRIORITY) if (id !== pin) void detach(id);
    if (target !== null && live !== target) {
      live = target;
      epoch += 1;
      underlying = target.state.gameEpoch;
      target.setMode("live");
    } else if (target === null) {
      live = null;
      epoch += 1;
    }
    refreshFacade();
  }

  // --- the switch and the probe ---

  function waitFor(
    a: ManagedAdapter,
    limit: number,
    done: (state: AdapterState) => boolean,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let over = false;
      const finish = (ok: boolean) => {
        if (over) return;
        over = true;
        cancel();
        stop();
        resolve(ok);
      };
      const stop = a.subscribe((s) => {
        if (done(s)) finish(true);
      });
      const cancel = clock.setTimeout(() => finish(false), limit);
    });
  }

  const limitOf = (a: ManagedAdapter): number =>
    a.id === "retroarch" ? RETROARCH_CHECK_MS : BRIDGE_CHECK_MS;

  async function switchTo(id: AdapterId): Promise<SwitchResult> {
    if (pin !== "auto")
      return {
        ok: false,
        code: "adapter_pinned",
        message: "Unpin in Settings to switch.",
      };
    if (live?.id === id) return { ok: true, live: id };
    if (busy !== null)
      return {
        ok: false,
        code: "switch_in_progress",
        message: "A switch or probe is running.",
      };
    const target = adapters.get(id);
    if (target === undefined || probeOf(id).result !== "usable")
      return {
        ok: false,
        code: "adapter_not_usable",
        message: "That adapter's last probe was not usable.",
      };
    busy = "switch";
    try {
      // A real connection with the hello and game checks, while the old adapter stays live.
      const check = waitFor(
        target,
        limitOf(target),
        (s) => s.problem !== null || s.connection === "connected",
      );
      target.setMode("live");
      const passed = connected(target) || (await check);
      if (closed || pin !== "auto")
        // A pin set mid-switch already closed the target and chose its own adapter.
        return {
          ok: false,
          code: closed ? "adapter_connect_failed" : "adapter_pinned",
          message: closed
            ? "The server is stopping."
            : "Unpin in Settings to switch.",
        };
      if (!passed || !connected(target)) {
        target.setMode("probe");
        return {
          ok: false,
          code: "adapter_connect_failed",
          message: "The adapter did not answer the connection checks.",
        };
      }
      const old = live;
      live = target;
      epoch += 1;
      underlying = target.state.gameEpoch;
      for (const other of ordered())
        if (other !== target) other.setMode("probe");
      log.info("switched adapter", { to: id, from: old?.id ?? null });
      refreshFacade();
      return { ok: true, live: id };
    } finally {
      busy = null;
    }
  }

  async function probeRun_(): Promise<void> {
    const targets = ordered().filter((a) => a !== live);
    // `hold` makes an idle adapter connect now. The backoff is not reset.
    await Promise.all(
      targets.map((a) => {
        const wait = connected(a)
          ? Promise.resolve(true)
          : waitFor(a, limitOf(a), (s) => s.connection !== "connecting");
        a.setMode("hold");
        return wait;
      }),
    );
    for (const a of targets) if (a !== live) a.setMode("probe");
  }

  async function probeNow(): Promise<ProbeNowResult> {
    if (pin !== "auto")
      return {
        ok: false,
        code: "adapter_pinned",
        message: "Unpin in Settings to probe.",
      };
    if (busy === "switch")
      return {
        ok: false,
        code: "switch_in_progress",
        message: "A switch is running.",
      };
    if (probeRun === null) {
      busy = "probe";
      probeRun = probeRun_().finally(() => {
        probeRun = null;
        busy = null;
        evaluate();
        refreshFacade();
      });
    }
    await probeRun;
    return { ok: true, body: list() };
  }

  function list(): AdaptersBody {
    return {
      mode: pin === "auto" ? "auto" : "pinned",
      live: live?.id ?? null,
      adapters: ADAPTER_PRIORITY.filter(
        (id) => adapters.has(id) || pin !== "auto",
      ).map((id) => ({
        id,
        endpoint: { ...deps.endpoint(id) },
        live: live?.id === id,
        probe: probeOf(id),
      })),
    };
  }

  applyPin();
  const timer = clock.setTimeout(() => {
    evaluate();
    refreshFacade();
  }, SETTLE_MS);
  emitted = facadeState();

  return {
    adapter: facade,
    list,
    probeNow,
    switchTo,
    setPin(next) {
      if (next === pin) return;
      pin = next;
      applyPin();
    },
    refreshEndpoints,
    async close() {
      closed = true;
      timer();
      for (const stop of unsubscribe.values()) stop();
      await Promise.all([...adapters.values()].map((a) => a.close()));
      adapters.clear();
      listeners.clear();
    },
  };
}
