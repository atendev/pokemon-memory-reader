import type { AboutBody } from "@pokemon-memory-reader/internal/about";
import type { AdaptersBody } from "@pokemon-memory-reader/internal/adapters-route";
import type { SettingsPatch } from "@pokemon-memory-reader/internal/config";
import type {
  PickBody,
  PickRequest,
} from "@pokemon-memory-reader/internal/manual-picks-route";
import type { SettingsBody } from "@pokemon-memory-reader/internal/settings-route";
import type { UpdateBody } from "@pokemon-memory-reader/internal/update";

/**
 * `GET /manual-picks` (amendment 021, item 8). The route is ticket 108's, so this mirrors the
 * amendment until that ticket exports the body from `internal/`.
 */
export interface ManualPicksBody {
  readonly romKey: string | null;
  readonly current: {
    readonly key: string;
    readonly scope: "rom" | "base";
    readonly profileId: string;
  } | null;
  readonly candidates: readonly {
    readonly id: string;
    readonly name: string;
    readonly kind: string;
    readonly dataFormat: string;
    readonly headerMatch: boolean;
    readonly signature: "match" | "mismatch" | "unchecked" | null;
    readonly baseEligible: boolean;
  }[];
}

/** An internal route's answer: the body, or the refusal with the code the program sent (amendment 021, item 4). */
export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      /** null when the program couldn't be reached or sent no error body, such as a route it doesn't have. */
      readonly code: string | null;
      readonly status: number | null;
      readonly message: string;
    };

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const UNREACHABLE = "Could not reach the program.";

function errorFrom(body: unknown): { code: string; message: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return typeof code === "string" && typeof message === "string"
    ? { code, message }
    : null;
}

/**
 * One call to an internal route. Writes always send a JSON body, `{}` when they have nothing to
 * say, because the write guard checks `Content-Type` on every one of them (amendment 021, item 3).
 * It never throws: a network failure or an unreadable answer comes back as a refusal with a message.
 */
export async function call<T>(
  method: "GET" | "PUT" | "POST",
  path: string,
  body: unknown = undefined,
  fetchFn: Fetch = (input, init) => fetch(input, init),
): Promise<Outcome<T>> {
  let response: Response;
  try {
    response = await fetchFn(
      path,
      method === "GET"
        ? { method }
        : {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body ?? {}),
          },
    );
  } catch {
    return { ok: false, code: null, status: null, message: UNREACHABLE };
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    parsed = undefined;
  }
  if (response.ok) {
    return parsed === undefined
      ? {
          ok: false,
          code: null,
          status: response.status,
          message: `The program answered ${response.status} with something unreadable.`,
        }
      : { ok: true, value: parsed as T };
  }
  const error = errorFrom(parsed);
  return {
    ok: false,
    code: error?.code ?? null,
    status: response.status,
    message: error?.message ?? `The program answered ${response.status}.`,
  };
}

export const getSettings = (fetchFn?: Fetch) =>
  call<SettingsBody>("GET", "/settings", undefined, fetchFn);
export const putSettings = (patch: SettingsPatch, fetchFn?: Fetch) =>
  call<SettingsBody>("PUT", "/settings", patch, fetchFn);
export const getAdapters = (fetchFn?: Fetch) =>
  call<AdaptersBody>("GET", "/adapters", undefined, fetchFn);
export const probeAdapters = (fetchFn?: Fetch) =>
  call<AdaptersBody>("POST", "/adapters/probe", {}, fetchFn);
export const switchAdapter = (id: string, fetchFn?: Fetch) =>
  call<{ live: string }>("POST", "/adapters/switch", { id }, fetchFn);
export const getManualPicks = (fetchFn?: Fetch) =>
  call<ManualPicksBody>("GET", "/manual-picks", undefined, fetchFn);
export const pickProfile = (request: PickRequest, fetchFn?: Fetch) =>
  call<PickBody>("POST", "/manual-picks", request, fetchFn);
export const forgetPick = (fetchFn?: Fetch) =>
  call<Record<string, never>>("POST", "/manual-picks/forget", {}, fetchFn);
export const getAbout = (fetchFn?: Fetch) =>
  call<AboutBody>("GET", "/about", undefined, fetchFn);
export const getUpdate = (fetchFn?: Fetch) =>
  call<UpdateBody>("GET", "/update", undefined, fetchFn);

/** The short heading over a refusal, by code. A code this build doesn't know shows only the program's message. */
const REFUSAL_TITLES: Readonly<Record<string, string>> = {
  write_forbidden: "The program refused the change",
  invalid_setting: "That setting isn't valid",
  invalid_request: "That request isn't valid",
  saves_refused: "Saving is turned off",
  save_failed: "The change wasn't saved",
  adapter_pinned: "Unpin in Settings to switch",
  adapter_not_usable: "That adapter isn't ready",
  adapter_connect_failed: "Could not connect to that adapter",
  switch_in_progress: "A switch is already running",
  no_rom: "No game is loaded",
  pick_not_allowed: "A pick isn't allowed now",
  forget_not_allowed: "There is no manual pick to forget",
  base_pick_not_allowed: "That profile can't be picked for a base game",
  unknown_profile: "That profile isn't a candidate",
  expansion_rom: "Expansion ROMs can't be picked",
};

/** What a refusal shows: a title when the code is known, and always the program's own message. */
export function refusalCopy(refusal: {
  code: string | null;
  message: string;
}): { title: string | null; message: string } {
  return {
    title:
      refusal.code === null ? null : (REFUSAL_TITLES[refusal.code] ?? null),
    message: refusal.message,
  };
}
