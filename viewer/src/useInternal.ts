import type { AboutBody } from "@pokemon-memory-reader/internal/about";
import type { AdaptersBody } from "@pokemon-memory-reader/internal/adapters-route";
import type { SettingsBody } from "@pokemon-memory-reader/internal/settings-route";
import type { UpdateBody } from "@pokemon-memory-reader/internal/update";
import { useCallback, useEffect, useState } from "react";
import {
  getAbout,
  getAdapters,
  getManualPicks,
  getSettings,
  getUpdate,
  type ManualPicksBody,
  type Outcome,
} from "./internal-api";

export type Polled<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly value: T }
  | {
      readonly kind: "unavailable";
      readonly code: string | null;
      readonly status: number | null;
      readonly message: string;
    };

const LOADING = { kind: "loading" } as const;

/** Settings read for the form: slow, since a read stats the icon cache (amendment 021, item 12). */
export const SETTINGS_POLL_MS = 5000;
/** The adapter list, while the connection screen or Settings is open (amendment 021, item 5). */
export const ADAPTERS_POLL_MS = 2000;
/** The update banner re-reads on load and every 30 minutes (amendment 021, item 10). */
export const UPDATE_POLL_MS = 30 * 60 * 1000;

/** Fired after a save that changes `updateCheck`, so the banner re-reads `/update` at once. */
export const UPDATE_REFRESH_EVENT = "pmr:update-refresh";

/**
 * Reads an internal route on a timer while `enabled`, and again whenever `reload` is called.
 * `intervalMs` of null reads once. `set` replaces the value, for a write that answers with the
 * new body.
 */
function useInternalRead<T>(
  load: () => Promise<Outcome<T>>,
  enabled: boolean,
  intervalMs: number | null,
): {
  state: Polled<T>;
  reload: () => void;
  set: (value: T) => void;
} {
  const [state, setState] = useState<Polled<T>>(LOADING);
  const [nonce, setNonce] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `nonce` restarts the read on `reload`
  useEffect(() => {
    if (!enabled) {
      setState(LOADING);
      return;
    }
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const outcome = await load();
      if (!live) return;
      setState(
        outcome.ok
          ? { kind: "ready", value: outcome.value }
          : {
              kind: "unavailable",
              code: outcome.code,
              status: outcome.status,
              message: outcome.message,
            },
      );
      if (intervalMs !== null) timer = setTimeout(tick, intervalMs);
    };
    void tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [load, enabled, intervalMs, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const set = useCallback((value: T) => setState({ kind: "ready", value }), []);
  return { state, reload, set };
}

const loadSettings = () => getSettings();
const loadAdapters = () => getAdapters();
const loadPicks = () => getManualPicks();
const loadAbout = () => getAbout();
const loadUpdate = () => getUpdate();

export const useSettings = (enabled: boolean) =>
  useInternalRead<SettingsBody>(loadSettings, enabled, SETTINGS_POLL_MS);

export const useAdapters = (enabled: boolean) =>
  useInternalRead<AdaptersBody>(loadAdapters, enabled, ADAPTERS_POLL_MS);

/** The candidates are read once, and again by `reload` after a pick, a forget or a status change (amendment 021, item 8). */
export const useManualPicks = (enabled: boolean) =>
  useInternalRead<ManualPicksBody>(loadPicks, enabled, null);

export const useAbout = (enabled: boolean) =>
  useInternalRead<AboutBody>(loadAbout, enabled, null);

/** The last update check, read on load, every 30 minutes and when a save changes `updateCheck`. */
export function useUpdate(): Polled<UpdateBody> {
  const { state, reload } = useInternalRead<UpdateBody>(
    loadUpdate,
    true,
    UPDATE_POLL_MS,
  );
  useEffect(() => {
    window.addEventListener(UPDATE_REFRESH_EVENT, reload);
    return () => window.removeEventListener(UPDATE_REFRESH_EVENT, reload);
  }, [reload]);
  return state;
}
