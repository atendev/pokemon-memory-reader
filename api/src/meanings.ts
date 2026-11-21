/**
 * The meaning record of every open enum in `/api/v2` (spec §7.11, amendment 035). Each record maps a
 * name to a one-line meaning and an optional `retiredIn`, the app version that stopped emitting the
 * name. The known unions in `types.ts` come from these keys. Names are append-only inside `/api/v2`:
 * `open-enums.test.ts` fails when a name or its meaning text disappears from the baseline. This
 * file imports nothing, so `/types` stays free of `zod`.
 */

export type MeaningRecord = {
  /** One line. Frozen once a stable release ships it, so edit it only through a meaning-fix amendment. */
  readonly meaning: string;
  /** The app version that stopped emitting the name. The name stays listed and is never reused. */
  readonly retiredIn?: string;
};

/** The "When" column of spec §7.2, plus `no_data` and `invalid_topics` from amendment 020. */
export const ERROR_CODES = {
  disconnected: { meaning: "No usable adapter." },
  no_game: {
    meaning: "Connected, no ROM or ROM tables still loading.",
  },
  unidentified: { meaning: "A ROM is loaded but no profile matched." },
  unsupported: {
    meaning:
      "The profile's data format isn't supported, the profile marks the resource unsupported, or the adapter can't perform the resource's main read.",
  },
  not_found: {
    meaning: "GET /boxes/:n with an out-of-range or non-integer :n (404).",
  },
  no_data: {
    meaning:
      "A game is loaded and the resource is supported, but the resource has no value yet.",
  },
  invalid_topics: {
    meaning:
      "The event stream's topics query is missing or names no known topic (400).",
  },
} as const satisfies Record<string, MeaningRecord>;

/** The data formats the decoder registry names (spec §6.1). */
export const DATA_FORMATS = {
  gen1: { meaning: "Generation 1 save and party layout." },
  gen2: { meaning: "Generation 2 save and party layout." },
  gen3: { meaning: "Generation 3 vanilla layout." },
  cfru: {
    meaning: "Complete Fire Red Upgrade layout, which extends Generation 3.",
  },
} as const satisfies Record<string, MeaningRecord>;

/** Adapter ids, as `status.adapter.id`. */
export const ADAPTER_IDS = {
  mgba: { meaning: "The mGBA scripting bridge." },
  retroarch: { meaning: "RetroArch network commands." },
  bizhawk: { meaning: "The BizHawk Lua bridge." },
} as const satisfies Record<string, MeaningRecord>;

/** Bridge names, as `status.adapter.bridge.bridge`. RetroArch has no bridge. */
export const BRIDGE_IDS = {
  mgba: { meaning: "The bridge script running inside mGBA." },
  bizhawk: { meaning: "The bridge script running inside BizHawk." },
} as const satisfies Record<string, MeaningRecord>;

/** Adapter problems, as `status.adapter.problem`. */
export const ADAPTER_PROBLEMS = {
  unknown_bridge: {
    meaning:
      "The endpoint sent no valid hello, or the hello names a bridge other than the one the endpoint should answer with.",
  },
  protocol_mismatch: {
    meaning: "The bridge speaks a different protocol version.",
  },
  busy: {
    meaning: "Another program instance already holds the bridge connection.",
  },
  bridge_error: {
    meaning:
      "After a valid hello, the bridge sent an error or a game message that failed validation.",
  },
} as const satisfies Record<string, MeaningRecord>;

/** Topic names, which are also the resource routes. The meaning is the resource the topic names. */
export const TOPIC_NAMES = {
  status: {
    meaning: "The adapter, ROM and game state. Always served.",
  },
  party: { meaning: "The player's party, in slot order." },
} as const satisfies Record<string, MeaningRecord>;

/**
 * `battle.modes` values (amendment 015). A name joins when its verification fixture lands, with a
 * generation-neutral, yes/no meaning, so this record is empty until then. Tags are independent and
 * can co-occur, and the array is sorted in code-point order. Never pre-list an unverified name.
 */
export const BATTLE_MODES = {} as const satisfies Record<string, MeaningRecord>;

/** Every open enum, keyed by the name the contract docs and the baseline file use. */
export const OPEN_ENUMS = {
  errorCode: ERROR_CODES,
  dataFormat: DATA_FORMATS,
  adapterId: ADAPTER_IDS,
  bridgeId: BRIDGE_IDS,
  adapterProblem: ADAPTER_PROBLEMS,
  topic: TOPIC_NAMES,
  battleMode: BATTLE_MODES,
} as const satisfies Record<string, Readonly<Record<string, MeaningRecord>>>;
