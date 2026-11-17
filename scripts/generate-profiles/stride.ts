import { requireSymbol, type SymbolInfo } from "./sym";

/** sizeof(struct SpeciesInfo) in vanilla Gen 3: 0x1A bytes of fields plus 2 of padding. */
export const SPECIES_INFO_STRIDE = 0x1c;

/** Where a repo keeps its species table and how many species the reference data lists for its data format. */
export interface SpeciesInfoTable {
  /** `gSpeciesInfo` or `gBaseStats`, whichever name the pinned commit uses. */
  readonly symbol: string;
  readonly speciesCount: number;
}

/** Fails when the table symbol isn't exactly `speciesCount` entries of `SPECIES_INFO_STRIDE` bytes (amendment 023 decision 1). */
export function checkSpeciesInfoStride(
  repo: string,
  symbols: ReadonlyMap<string, SymbolInfo>,
  table: SpeciesInfoTable,
): void {
  const { size } = requireSymbol(symbols, table.symbol);
  const expected = table.speciesCount * SPECIES_INFO_STRIDE;
  if (size !== expected) {
    throw new Error(
      `${repo}: ${table.symbol} is 0x${size.toString(16)} bytes, but ${table.speciesCount} species at 0x${SPECIES_INFO_STRIDE.toString(16)} is 0x${expected.toString(16)}`,
    );
  }
}
