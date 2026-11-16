import type { StatusResource } from "@pokemon-memory-reader/api/schemas";
import type { AdapterState } from "../adapter/types";
import { GENERATION } from "../format/registry";
import type { Identification } from "../identify/identify";

export interface StatusInputs {
  readonly adapterId: string;
  readonly adapter: AdapterState;
  /** null until identification has run for the current game. */
  readonly identification: Identification | null;
}

/** A bridge is usable once connected with no problem (spec §4.7). */
export function isUsable(adapter: AdapterState): boolean {
  return adapter.connection === "connected" && adapter.problem === null;
}

const hex = (value: number, digits: number) =>
  value.toString(16).padStart(digits, "0");

function romOf({ adapter, identification }: StatusInputs) {
  const game = adapter.game;
  if (game === null) return null;
  const header = identification?.header ?? null;
  return {
    platform: game.platform,
    title: header?.title ?? null,
    gameCode: header?.platform === "gba" ? header.gameCode : null,
    revision:
      header === null
        ? null
        : header.platform === "gba"
          ? header.revision
          : header.maskRomVersion,
    globalChecksum:
      header?.platform === "gb" ? hex(header.globalChecksum, 4) : null,
    crc32: game.crc32,
    sha1: game.sha1,
    contentName: null,
    expansion: null,
  };
}

function gameOf(identification: Identification | null) {
  if (identification?.kind !== "identified") return null;
  const { profile, match, signature } = identification;
  // ROM tables load for hack profiles only, and no hack decoder exists yet, so only official profiles have shipped tables.
  const source = profile.kind === "official" ? "builtin" : "unavailable";
  return {
    profileId: profile.id,
    name: profile.name,
    generation: GENERATION[profile.dataFormat],
    language: profile.language,
    dataFormat: profile.dataFormat,
    match,
    signature,
    features: { boxes: profile.features.boxes },
    names: {
      species: source,
      moves: source,
      items: source,
      abilities: profile.dataFormat === "gen1" ? null : source,
    },
    speciesData: { info: source, dex: source, exp: source },
  } as const;
}

/**
 * The `status` resource (spec §7.4, amendment 020). `adapter` is null while the adapter is
 * neither usable nor reporting a problem. `stalled` stays false until the stall check lands
 * (spec §8.6).
 */
export function buildStatus(inputs: StatusInputs): StatusResource {
  const { adapter, identification } = inputs;
  const usable = isUsable(adapter);
  const state: StatusResource["state"] = !usable
    ? "disconnected"
    : adapter.game === null || identification === null
      ? "no_game"
      : identification.kind === "unidentified"
        ? "unidentified"
        : "game";
  return {
    state,
    adapter:
      usable || adapter.problem !== null
        ? {
            id: inputs.adapterId,
            stalled: false,
            bridge: adapter.bridge && { ...adapter.bridge },
            problem: adapter.problem,
          }
        : null,
    rom: usable ? romOf(inputs) : null,
    game: state === "game" ? gameOf(identification) : null,
  };
}
