import type { Bytes } from "../format/bytes";
import type {
  Charmap,
  CharSet,
  MoveDataLookup,
  Names,
  SpeciesDataLookup,
} from "../format/types";
import type { DataFormatId } from "../profile/schema";
import gen3En from "./data/gen3-en.json";

/** Shipped tables for one data format and language: charmap, names, species data and move data. */
export interface ReferenceData {
  readonly charmap: Charmap;
  readonly names: Omit<Names, "locations">;
  readonly speciesData: SpeciesDataLookup;
  readonly moveData: MoveDataLookup;
}

const TERMINATOR = 0xff;
const REPLACEMENT = "�";
/** Gen 3 knows National Dex numbers 1-386. The generated rows also number the "?" placeholder species past it. */
const LAST_NATIONAL_DEX = 386;

/** The charmap's `decode` stops at the 0xFF terminator, at `maxLength` or at the end of the slice. */
export function createCharmap(
  sets: Readonly<Record<CharSet, ReadonlyArray<string | null>>>,
): Charmap {
  return {
    decode(bytes: Bytes, maxLength = bytes.length, set = "latin") {
      const glyphs = sets[set];
      let text = "";
      for (let i = 0; i < Math.min(maxLength, bytes.length); i++) {
        const byte = bytes.u8(i);
        if (byte === TERMINATOR) break;
        text += glyphs[byte] ?? REPLACEMENT;
      }
      return text;
    },
  };
}

const table =
  (names: ReadonlyArray<string | null>) =>
  (id: number): string | null =>
    names[id] ?? null;

function gen3English(): ReferenceData {
  const data = gen3En;
  return {
    charmap: createCharmap(data.charmap),
    names: {
      species: table(data.names.species),
      moves: table(data.names.moves),
      items: table(data.names.items),
      abilities: table(data.names.abilities),
    },
    speciesData: {
      info(species) {
        const row = data.speciesData[species];
        if (!row) return null;
        return {
          genderRatio: row.genderRatio,
          growthRate: row.growthRate,
          abilities: [row.abilities[0] ?? 0, row.abilities[1] ?? 0],
          types: [row.types[0] ?? 0, row.types[1] ?? 0],
        };
      },
      dex(species) {
        const dex = data.speciesData[species]?.dex ?? null;
        return dex !== null && dex <= LAST_NATIONAL_DEX ? dex : null;
      },
    },
    moveData: {
      move(id) {
        const row = data.moveData[id];
        return row ? { typeId: row.type, basePp: row.pp } : null;
      },
    },
  };
}

/** null when v2.0 ships no table for that pair. */
export function referenceData(
  format: DataFormatId,
  language: string,
): ReferenceData | null {
  if (format === "gen3" && language === "en") return gen3English();
  return null;
}
