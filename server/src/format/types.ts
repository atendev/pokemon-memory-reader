import type {
  Bag,
  Boxes,
  Party,
  Player,
} from "@pokemon-memory-reader/api/schemas";
import type { DataFormatId, Profile } from "../profile/schema";
import type { BattleFrame, BattleTick } from "../resource/battle-tracker";
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
  /** The trainer tables' part of a battle, for formats that have one. A frame without it keeps the nulls the frame decoder left. */
  readonly trainers?: TrainerFill<P>;
}

/** RAM a trainer's prize money needs besides the frame. Its own part, so an unreadable `gBattleStruct` nulls the money and never the frame. */
export interface BattleExtras {
  readonly moneyMultiplier: number;
}

/**
 * Fills the `Trainer` fields that come from ROM tables (spec §7.8). The frame decoder lists each
 * trainer with those fields null. The loop reads the ROM regions `rom` names, once per session for
 * each name, and `fill` returns the frame with the fields set. A region the profile has no table
 * for, or that failed to read, is absent from `rom` and nulls only the fields that need it.
 */
export interface TrainerFill<P> {
  /** The RAM the money needs. Read in the frame's batch. */
  readonly extras: ResourceDecoder<P, Regions, BattleExtras>;
  /** The ROM regions this frame's trainers need, named so the loop can cache them. None for a battle that has no tables. */
  rom(profile: P, frame: BattleFrame): Regions;
  /** Every ROM region at its maximum size, for the bridge request caps. */
  maxRom(profile: P): Regions;
  /** Pure. `rom` holds the slice of each region that was read. */
  fill(
    frame: BattleFrame,
    ctx: DecodeContext<P>,
    rom: Readonly<Record<string, Bytes>>,
    extras: BattleExtras | null,
  ): BattleFrame;
}

export interface Decoder<F extends DataFormatId> {
  readonly party?: ResourceDecoder<Profile<F>, Regions, Party>;
  readonly boxes?: ResourceDecoder<Profile<F>, Regions, Boxes>;
  readonly player?: ResourceDecoder<Profile<F>, Regions, Player>;
  readonly bag?: ResourceDecoder<Profile<F>, Regions, Bag>;
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
