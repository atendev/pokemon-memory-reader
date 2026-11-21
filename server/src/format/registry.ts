import type {
  Bag,
  Boxes,
  Party,
  Player,
} from "@pokemon-memory-reader/api/schemas";
import type { Profile } from "../profile/schema";
import { referenceData } from "../reference";
import type { BattleFrame, BattleTick } from "../resource/battle-tracker";
import type { Bytes } from "./bytes";
import { gen3Decoder } from "./gen3";
import { STORAGE } from "./gen3/structs";
import type { Regions, Slices } from "./regions";
import { isSupported, SUPPORTED, type SupportFlags } from "./support";
import type {
  BattleExtras,
  BattleProbe,
  DecodeContext,
  ResourceDecoder,
  Result,
} from "./types";

export const GENERATION = { gen1: 1, gen2: 2, gen3: 3, cfru: 3 } as const;

/** A decoder part with its profile and per-game lookups already applied. */
export interface BoundPart<T> {
  readonly regions: Regions;
  /** Throws only on a layout bug, such as a slice read out of bounds. */
  decode(slices: Readonly<Record<string, Bytes>>): Result<T>;
}

/** The battle reader's two reads (spec §8.2): the flag with the outcome every tick, and the whole frame while the flag is set. */
export interface BoundBattle {
  readonly probe: BoundPart<BattleProbe>;
  readonly frame: BoundPart<BattleTick>;
  /** The trainer tables' part, for a format that has one (spec §7.8). */
  readonly trainers?: BoundTrainers;
}

/** The `Trainer` fields that come from ROM tables, with the profile and per-game lookups applied. */
export interface BoundTrainers {
  /** RAM read in the frame's batch. A read that fails leaves the money null and the frame intact. */
  readonly extras: BoundPart<BattleExtras>;
  /** The ROM regions this frame's trainers need, by cache name. Empty when the battle has no tables. */
  rom(frame: BattleFrame): Regions;
  fill(
    frame: BattleFrame,
    rom: Readonly<Record<string, Bytes>>,
    extras: BattleExtras | null,
  ): BattleFrame;
}

/** The box reader, with the box count the format fixes so `/boxes/:n` can refuse an out-of-range `n` before any read (amendment 020 §3). */
export interface BoundBoxes extends BoundPart<Boxes> {
  readonly count: number;
}

/** What the read loop reads and decodes for the loaded game. A part left out makes its resource 503 `unsupported` (spec §7.2). */
export interface BoundGame {
  /**
   * Whether the profile's data format is `supported` (spec §6.1). False refuses every resource with
   * 503 `unsupported`, even one the format has a decoder for. `bindGame` always sets it. A binding
   * without it is judged by its parts alone.
   */
  readonly supported?: boolean;
  readonly party?: BoundPart<Party>;
  readonly player?: BoundPart<Player>;
  readonly bag?: BoundPart<Bag>;
  readonly boxes?: BoundBoxes;
  readonly battle?: BoundBattle;
}

function bind<P, R extends Regions, T>(
  decoder: ResourceDecoder<P, R, T>,
  profile: P,
  ctx: DecodeContext<P>,
): BoundPart<T> {
  return {
    regions: decoder.regions(profile),
    // The loop slices every declared region by name, so the record matches Slices<R>.
    decode: (slices) => decoder.decode(slices as Slices<R>, ctx),
  };
}

/** A decoder part's name with every region it declares at maximum size. */
export interface DeclaredPart {
  readonly part: string;
  readonly regions: Regions;
}

/**
 * What the loaded game's decoders read, split into the main batch and the box request (amendment
 * 026 §6). It needs no reference data, so a profile is measured the same whether or not its
 * language has any.
 */
export function declaredRegions(profile: Profile): {
  readonly main: readonly DeclaredPart[];
  readonly boxes: readonly DeclaredPart[];
  /** The trainer-table ROM read, its own request after the main batch. */
  readonly rom: readonly DeclaredPart[];
} {
  switch (profile.dataFormat) {
    case "gen3":
      return {
        main: [
          ...(gen3Decoder.party
            ? [{ part: "party", regions: gen3Decoder.party.regions(profile) }]
            : []),
          ...(gen3Decoder.player
            ? [{ part: "player", regions: gen3Decoder.player.regions(profile) }]
            : []),
          ...(gen3Decoder.bag
            ? [{ part: "bag", regions: gen3Decoder.bag.regions(profile) }]
            : []),
          ...(gen3Decoder.battle
            ? [
                {
                  part: "battle",
                  regions: gen3Decoder.battle.frame.regions(profile),
                },
              ]
            : []),
          ...(gen3Decoder.battle?.trainers
            ? [
                {
                  part: "battleExtras",
                  regions: gen3Decoder.battle.trainers.extras.regions(profile),
                },
              ]
            : []),
        ],
        boxes:
          gen3Decoder.boxes && profile.features.boxes
            ? [{ part: "boxes", regions: gen3Decoder.boxes.regions(profile) }]
            : [],
        rom: gen3Decoder.battle?.trainers
          ? [
              {
                part: "battleRom",
                regions: gen3Decoder.battle.trainers.maxRom(profile),
              },
            ]
          : [],
      };
    default:
      return { main: [], boxes: [], rom: [] };
  }
}

/**
 * Binds the profile's data format to its decoder and the reference data for its language.
 * A format whose `supported` flag is false binds no parts. So does one with no decoder or no
 * reference data. The coverage guard (spec §12.8) is what lets a flag turn true.
 */
export function bindGame(
  profile: Profile,
  support: SupportFlags = SUPPORTED,
): BoundGame {
  if (!isSupported(support, profile.dataFormat)) return { supported: false };
  const reference = referenceData(profile.dataFormat, profile.language);
  if (reference === null) return { supported: true };
  switch (profile.dataFormat) {
    case "gen3": {
      const ctx: DecodeContext<Profile<"gen3">> = {
        profile,
        ...reference,
        names: {
          ...reference.names,
          locations: reference.locations(profile.artVersion),
        },
      };
      const { party, player, bag, battle, boxes } = gen3Decoder;
      const trainers = battle?.trainers;
      return {
        supported: true,
        ...(party && { party: bind(party, profile, ctx) }),
        ...(player && { player: bind(player, profile, ctx) }),
        ...(bag && { bag: bind(bag, profile, ctx) }),
        // A profile that turns `features.boxes` off has no box reader, so its boxes 503 `unsupported` (spec §7.2).
        ...(boxes &&
          profile.features.boxes && {
            boxes: { ...bind(boxes, profile, ctx), count: STORAGE.boxCount },
          }),
        ...(battle && {
          battle: {
            probe: bind(battle.probe, profile, ctx),
            frame: bind(battle.frame, profile, ctx),
            ...(trainers && {
              trainers: {
                extras: bind(trainers.extras, profile, ctx),
                rom: (frame) => trainers.rom(profile, frame),
                fill: (frame, rom, extras) =>
                  trainers.fill(frame, ctx, rom, extras),
              },
            }),
          },
        }),
      };
    }
    default:
      return { supported: true };
  }
}
