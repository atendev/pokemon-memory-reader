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
  /** Profile key to symbol. A pointer symbol becomes a pointer entry that reads the target at offset 0. */
  readonly addresses: ReadonlyArray<{
    readonly key: string;
    readonly symbol: string;
    readonly pointer?: true;
  }>;
  /** Table symbol to its entry size in bytes. The count is the symbol's size divided by it. */
  readonly trainerTables: {
    readonly trainers: { readonly symbol: string; readonly entrySize: number };
    readonly classNames: {
      readonly symbol: string;
      readonly entrySize: number;
    };
    readonly money: { readonly symbol: string; readonly entrySize: number };
  };
  readonly identify: {
    readonly sha1: readonly string[];
    readonly crc32: readonly string[];
    readonly header: { readonly gameCode: string; readonly revision: number };
    /** GF ROM header words that must point at the symbol's address (spec §5.4). */
    readonly signature: ReadonlyArray<{
      readonly address: number;
      readonly symbol: string;
    }>;
  };
}
