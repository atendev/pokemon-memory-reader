import {
  type Bag,
  POCKET_IDS,
  type Pocket,
} from "@pokemon-memory-reader/api/schemas";
import type { Profile } from "../../profile/schema";
import { type Region, region } from "../regions";
import { ok, type ResourceDecoder } from "../types";
import { ref } from "./mon";
import { at } from "./save";
import { BAG } from "./structs";

interface BagRegions {
  readonly [name: string]: Region;
  readonly items: Region;
  readonly keyItems: Region;
  readonly balls: Region;
  readonly tmhm: Region;
  readonly berries: Region;
  readonly key: Region;
}

/**
 * The bag: five slot pockets in save block 1, each a run of `struct ItemSlot` (u16 item ID, u16
 * quantity), with the profile naming each pocket's offset and slot count. Item ID 0 marks an empty
 * slot and is skipped. Where the profile names an encryption key (Emerald and FireRed), quantities
 * are XORed with its low 16 bits, as pokeemerald's `GetBagItemQuantity` does. Item IDs are not
 * encrypted. An ID the item name table doesn't know keeps its number with a null name, and a
 * quantity of 0 is kept as stored (amendment 017 §5).
 */
export const gen3Bag: ResourceDecoder<Profile<"gen3">, BagRegions, Bag> = {
  regions({ addresses, bag, player }) {
    const pocket = (index: number) =>
      region(
        at(addresses.gSaveBlock1, bag.pocketOffsets[index] ?? 0),
        (bag.pocketCapacities[index] ?? 0) * BAG.slotSize,
      );
    return {
      items: pocket(0),
      keyItems: pocket(1),
      balls: pocket(2),
      tmhm: pocket(3),
      berries: pocket(4),
      // A region name can't be optional, so a game with no key reads the first pocket twice and decode ignores the copy.
      key:
        player.encryptionKeyOffset === undefined
          ? pocket(0)
          : region(at(addresses.gSaveBlock2, player.encryptionKeyOffset), 4),
    };
  },
  decode(slices, ctx) {
    const { bag, player } = ctx.profile;
    const mask =
      player.encryptionKeyOffset === undefined
        ? 0
        : slices.key.u32le(0) & 0xffff;
    const pockets: Pocket[] = POCKET_IDS.map((id, index) => {
      const bytes = slices[id];
      const capacity = bag.pocketCapacities[index] ?? 0;
      const items: Pocket["items"] = [];
      for (let slot = 0; slot < capacity; slot++) {
        const itemId = bytes.u16le(slot * BAG.slotSize + BAG.itemId);
        if (itemId === 0) continue;
        items.push({
          item: ref(itemId, ctx.names.items(itemId)),
          quantity: bytes.u16le(slot * BAG.slotSize + BAG.quantity) ^ mask,
        });
      }
      return { id, capacity, items };
    });
    return ok({ pockets });
  },
};
