import {
  get,
  getParty,
  getStatus,
  PmrApiError,
} from "@pokemon-memory-reader/api/client";
import type {
  Bag,
  Battle,
  Boxes,
  Party,
  Player,
  StatusResource,
} from "@pokemon-memory-reader/api/schemas";
import { useEffect, useState, useSyncExternalStore } from "react";
import { type IconMode, parseIconMode } from "./icons";

/** Until the SSE stream lands, the viewer polls the snapshot routes. */
export const POLL_MS = 1000;

export type Loaded<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly value: T }
  /** `code` is the 503 code, or null when the program could not be reached. */
  | { readonly kind: "unavailable"; readonly code: string | null };

function usePolled<T>(
  load: () => Promise<T>,
  enabled: boolean,
  intervalMs = POLL_MS,
): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ kind: "loading" });
  useEffect(() => {
    if (!enabled) {
      setState({ kind: "loading" });
      return;
    }
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const value = await load();
        if (live) setState({ kind: "ready", value });
      } catch (error) {
        const code = error instanceof PmrApiError ? error.code : null;
        if (live) setState({ kind: "unavailable", code });
      }
      if (live) timer = setTimeout(tick, intervalMs);
    };
    void tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [load, enabled, intervalMs]);
  return state;
}

const options = { baseUrl: "" };
const loadStatus = () => getStatus(options);
const loadParty = () => getParty(options);
const loadBattle = () => get("battle", options);
const loadBoxes = () => get("boxes", options);
const loadPlayer = () => get("player", options);
const loadBag = () => get("bag", options);

export function useStatus(): Loaded<StatusResource> {
  return usePolled(loadStatus, true);
}

/** The party is only requested while a game is identified, so no request holds demand otherwise. */
export function useParty(enabled: boolean): Loaded<Party> {
  return usePolled(loadParty, enabled);
}

/**
 * The battle is read whenever a game is identified, not only on its own screen, because the
 * sidebar's red dot needs to know whether a battle is live (spec §11.1).
 */
export function useBattle(enabled: boolean): Loaded<Battle> {
  return usePolled(loadBattle, enabled);
}

/**
 * The boxes are requested only while their screen is open (spec §11.5), at the poll rate the
 * server already limits to once a second (spec §8.3). Until the SSE stream lands this is a poll.
 */
export function useBoxes(enabled: boolean): Loaded<Boxes> {
  return usePolled(loadBoxes, enabled);
}

/**
 * The player and the bag are requested only while the Trainer & bag screen is open, like the
 * boxes. Until the SSE stream lands these are polls.
 */
export function usePlayer(enabled: boolean): Loaded<Player> {
  return usePolled(loadPlayer, enabled);
}

export function useBag(enabled: boolean): Loaded<Bag> {
  return usePolled(loadBag, enabled);
}

/** `icons.mode` changes apply live, but a settings read stats the icon cache, so it is polled slowly. */
export const ICON_MODE_POLL_MS = 5000;

async function loadIconMode(): Promise<IconMode> {
  const response = await fetch("/settings");
  if (!response.ok) throw new Error(`settings answered ${response.status}`);
  const mode = parseIconMode(await response.json());
  if (mode === null) throw new Error("settings carry no icon mode");
  return mode;
}

/**
 * The icon mode, read from `GET /settings` while a game is identified. It is null until the first
 * answer and again if settings can't be read, so no icon is requested on a guess (spec §11.9).
 */
export function useIconMode(enabled: boolean): IconMode | null {
  const mode = usePolled(loadIconMode, enabled, ICON_MODE_POLL_MS);
  return mode.kind === "ready" ? mode.value : null;
}

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** The current `location.hash`, for the viewer's hash routes. */
export function useHash(): string {
  return useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => "",
  );
}
