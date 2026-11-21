import type { Boxes, Party } from "@pokemon-memory-reader/api/schemas";
import type { DataFormatId, Profile } from "../profile/schema";
import type { BattleTick } from "../resource/battle-tracker";
import type { Bytes } from "./bytes";
import type { Regions, Slices } from "./regions";

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail(reason: string): Result<never> {
  return { ok: false, reason };
}

/** One part of a decoder: what it reads and how it turns those bytes into a value. */
export interface ResourceDecoder<P, R extends Regions, T> {
  /** Every region at its maximum size (full party, all boxes). Same profile, same regions. */
  regions(profile: P): R;
  /** Pure. Returns fail() for expected bad data, such as a checksum mismatch. Throws only on a bug. */
  decode(slices: Slices<R>, ctx: DecodeContext<P>): Result<T>;
}

/**
 * What one read cycle learned about the in-battle flag without reading the battle: the flag
 * reads clear (with the outcome read in the same cycle), is the Gen 1 end marker, or is set
 * and the full frame still has to be read.
 */
export type BattleProbe =
  | { readonly flag: "set" }
  | Exclude<BattleTick, { readonly flag: "set" }>;

/**
 * A format's battle reader in two reads (spec §8.2). `probe` is the in-battle flag and the
 * outcome, which the loop reads every tick. `frame` is those plus everything a battle needs, and
 * is read while the flag is set. Both return a tick the tracker folds (interfaces 004).
 */
export interface BattleDecoder<P> {
  readonly probe: ResourceDecoder<P, Regions, BattleProbe>;
  readonly frame: ResourceDecoder<P, Regions, BattleTick>;
}

export interface Decoder<F extends DataFormatId> {
  readonly party?: ResourceDecoder<Profile<F>, Regions, Party>;
  readonly boxes?: ResourceDecoder<Profile<F>, Regions, Boxes>;
  readonly battle?: BattleDecoder<Profile<F>>;
}

/** Everything a decoder gets besides its slices. Built once per loaded game. */
export interface DecodeContext<P> {
  readonly profile: P;
  readonly charmap: Charmap;
  readonly names: Names;
  readonly speciesData: SpeciesDataLookup;
  readonly moveData: MoveDataLookup;
}

/** A character set inside a charmap: Japanese games use kana, every other language uses latin. */
export type CharSet = "latin" | "kana";

export interface Charmap {
  /** Decodes up to the 0xFF terminator or `maxLength`. An unmapped byte gives U+FFFD. */
  decode(bytes: Bytes, maxLength?: number, set?: CharSet): string;
}

/** null: an ID beyond the table, an empty entry, a discarded table or no ROM access (spec §5.5). */
export interface Names {
  species(id: number): string | null;
  moves(id: number): string | null;
  items(id: number): string | null;
  abilities(id: number): string | null;
  locations(id: number): string | null;
}

export interface SpeciesInfo {
  readonly genderRatio: number;
  readonly growthRate: number;
  readonly abilities: readonly [number, number];
  /** Raw type IDs. Each format maps them through its own type table (amendment 016 §3). */
  readonly types: readonly [number, number];
}

/** Each lookup returns null when its table failed or the ID falls outside it (spec §5.6). */
export interface SpeciesDataLookup {
  info(species: number): SpeciesInfo | null;
  dex(species: number): number | null;
}

export interface MoveDataLookup {
  move(id: number): { readonly typeId: number; readonly basePp: number } | null;
}
