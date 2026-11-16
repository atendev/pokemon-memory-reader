import {
  getParty,
  getStatus,
  PmrApiError,
} from "@pokemon-memory-reader/api/client";
import type { Party, StatusResource } from "@pokemon-memory-reader/api/schemas";
import { useEffect, useState, useSyncExternalStore } from "react";

/** Until the SSE stream lands, the viewer polls the snapshot routes. */
export const POLL_MS = 1000;

export type Loaded<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly value: T }
  /** `code` is the 503 code, or null when the program could not be reached. */
  | { readonly kind: "unavailable"; readonly code: string | null };

function usePolled<T>(load: () => Promise<T>, enabled: boolean): Loaded<T> {
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
      if (live) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [load, enabled]);
  return state;
}

const options = { baseUrl: "" };
const loadStatus = () => getStatus(options);
const loadParty = () => getParty(options);

export function useStatus(): Loaded<StatusResource> {
  return usePolled(loadStatus, true);
}

/** The party is only requested while a game is identified, so no request holds demand otherwise. */
export function useParty(enabled: boolean): Loaded<Party> {
  return usePolled(loadParty, enabled);
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
