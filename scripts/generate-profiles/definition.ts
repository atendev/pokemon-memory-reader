import type { SpeciesInfoTable } from "./stride";

/** What the generator knows about one official profile. Symbols come from pret. Everything else is hand-written. */
export interface ProfileDefinition {
  readonly id: string;
  readonly name: string;
  readonly dataFormat: "gen3";
  readonly artVersion: string;
  readonly fixture: "full" | "smoke" | "none";
  readonly source: {
    readonly repo: string;
    /** A commit on the repo's `symbols` branch. */
    readonly commit: string;
    readonly symbolFile: string;
  };
  /** The pret file that lists the build's SHA-1, at a pinned commit on the repo's main branch. Every SHA-1 in it goes into `identify.sha1`. */
  readonly sha1: { readonly commit: string; readonly file: string };
  /** The No-Intro DAT in libretro-database that holds the CRC32 for each SHA-1, at a pinned commit. */
  readonly noIntro: { readonly commit: string; readonly file: string };
  /** Profile key to symbol. A pointer symbol becomes a pointer entry that reads the target at offset 0, and any other symbol becomes a static address. */
  readonly addresses: ReadonlyArray<{
    readonly key: string;
    readonly symbol: string;
    readonly pointer?: true;
  }>;
  /** The `player` block as hand-written, verified values: save block offsets and badge flag IDs from the pinned pret source. It is written into the profile as-is. */
  readonly player: Readonly<Record<string, number | readonly number[]>>;
  /** The `bag` block as hand-written, verified values: the pocket offsets in save block 1 and the slot counts from the pinned pret source. It is written into the profile as-is. */
  readonly bag: Readonly<Record<string, number | readonly number[]>>;
  /** The species table the generator checks for the vanilla stride. The count is the species count of this data format's reference data. */
  readonly speciesInfo: SpeciesInfoTable;
  /** The profile's `constants` block as hand-written, verified values. Absent where the game matches the decoder defaults (Emerald and FireRed). */
  readonly constants?: Readonly<Record<string, number>>;
  /**
   * Table symbol to its entry size in bytes. The count is the symbol's size divided by it. A table symbol
   * whose size is 0 (a label with no `.size`) gives its `count` by hand from the pinned pret source instead.
   */
  readonly trainerTables: {
    readonly trainers: TrainerTable;
    readonly classNames: TrainerTable;
    readonly money: TrainerTable;
  };
  readonly identify: {
    readonly header: { readonly gameCode: string; readonly revision: number };
    /** The signature words (spec §5.4 and amendment 036 item 4). */
    readonly signature: readonly SignatureWord[];
  };
}

interface TrainerTable {
  readonly symbol: string;
  readonly entrySize: number;
  readonly count?: number;
}

/**
 * One signature word: 4 bytes at `at`, holding the address of `value.symbol` plus `value.offset`. A
 * number `at` is a fixed address (a GF ROM header word). An anchor `at` is a named symbol, local or
 * global, plus an offset, and the generator checks the symbol appears once with exactly `size` bytes.
 */
export interface SignatureWord {
  readonly at:
    | number
    | {
        readonly symbol: string;
        readonly offset: number;
        readonly size: number;
      };
  readonly value: { readonly symbol: string; readonly offset?: number };
}

/**
 * A revision the generator skips because its pret SHA-1 matches no No-Intro entry (amendment 022 item 4).
 * Taking it out of `heldBack` is the one-line change that re-enters it, once its chain is repaired or the
 * owner's ROM has passed `test:local`.
 */
export interface HeldBackDefinition {
  readonly id: string;
  readonly name: string;
  readonly repo: string;
  readonly sha1: ProfileDefinition["sha1"];
  readonly noIntro: ProfileDefinition["noIntro"];
  readonly reason: string;
}
