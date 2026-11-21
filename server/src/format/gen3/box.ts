import type { Box, Boxes } from "@pokemon-memory-reader/api/schemas";
import type { Profile } from "../../profile/schema";
import { type Region, region } from "../regions";
import { ok, type ResourceDecoder } from "../types";
import { decodeBoxMon } from "./mon";
import { BOX_MON_SIZE, STORAGE } from "./structs";

interface BoxRegions {
  readonly [name: string]: Region;
  readonly storage: Region;
}

/** Every box unreadable with nothing known, for a storage block that couldn't be read (spec §7.9). */
export function unreadableBoxes(): Boxes {
  return {
    currentBox: null,
    boxes: Array.from({ length: STORAGE.boxCount }, (_, index) => ({
      index,
      name: null,
      wallpaper: null,
      readable: false,
      corruptSlots: [],
      slots: [],
    })),
  };
}

/**
 * The PC: all of `PokemonStorage` in one read. A checksum failure or bad egg gives a `null` slot
 * listed in `corruptSlots`, and an empty slot is `null` without being listed. A `currentBox` byte
 * past the last box means the memory isn't a storage block (a game mid-load), so every box is
 * unreadable.
 */
export const gen3Boxes: ResourceDecoder<Profile<"gen3">, BoxRegions, Boxes> = {
  regions: (profile) => ({
    storage: region(profile.addresses.gPokemonStorage, STORAGE.size),
  }),
  decode({ storage }, ctx) {
    const currentBox = storage.u8(STORAGE.currentBox);
    if (currentBox >= STORAGE.boxCount) return ok(unreadableBoxes());
    const boxes: Box[] = [];
    for (let index = 0; index < STORAGE.boxCount; index++) {
      const corruptSlots: number[] = [];
      const slots: Box["slots"] = [];
      for (let slot = 0; slot < STORAGE.slotCount; slot++) {
        const offset =
          STORAGE.boxes + (index * STORAGE.slotCount + slot) * BOX_MON_SIZE;
        const decoded = decodeBoxMon(storage.sub(offset, BOX_MON_SIZE), ctx);
        if (!decoded.ok) corruptSlots.push(slot);
        slots.push(decoded.ok ? decoded.value : null);
      }
      boxes.push({
        index,
        name: ctx.charmap.decode(
          storage.sub(
            STORAGE.names + index * STORAGE.nameStride,
            STORAGE.nameStride,
          ),
          STORAGE.nameLength,
        ),
        wallpaper: storage.u8(STORAGE.wallpapers + index),
        readable: true,
        corruptSlots,
        slots,
      });
    }
    return ok({ currentBox, boxes });
  },
};
