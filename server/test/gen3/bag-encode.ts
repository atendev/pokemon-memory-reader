import { DEFAULT_BLOCKS } from "./player-encode";

/** One stack in a synthetic pocket. */
export interface SceneSlot {
  readonly id: number;
  /** The quantity as the player sees it. It is stored XORed with the low 16 bits of `key`. */
  readonly quantity: number;
}

/** What one synthetic Emerald bag puts in memory (pokeemerald `SaveBlock1.bagPocket_*`). A pocket left out is empty. */
export interface BagScene {
  items?: readonly SceneSlot[];
  keyItems?: readonly SceneSlot[];
  balls?: readonly SceneSlot[];
  tmhm?: readonly SceneSlot[];
  berries?: readonly SceneSlot[];
  key?: number;
  blocks?: { readonly one: number; readonly two: number };
}

const EWRAM_BASE = 0x02000000;
const SAVE_BLOCK_1_PTR = 0x5d8c;
const SAVE_BLOCK_2_PTR = 0x5d90;
const KEY = 0xac;
/** `struct SaveBlock1` offsets, written out here so the fixture checks the profile instead of reading it. */
const POCKETS = {
  items: { offset: 0x560, capacity: 30 },
  keyItems: { offset: 0x5d8, capacity: 30 },
  balls: { offset: 0x650, capacity: 16 },
  tmhm: { offset: 0x690, capacity: 64 },
  berries: { offset: 0x790, capacity: 46 },
} as const;

/** Writes a bag into Emerald memory and points `gSaveBlock1Ptr` and `gSaveBlock2Ptr` at it. */
export function writeBag(
  memory: { ewram: Uint8Array; iwram: Uint8Array },
  scene: BagScene = {},
): void {
  const { one, two } = scene.blocks ?? DEFAULT_BLOCKS;
  const view = new DataView(memory.ewram.buffer);
  const iwram = new DataView(memory.iwram.buffer);
  iwram.setUint32(SAVE_BLOCK_1_PTR, EWRAM_BASE + one, true);
  iwram.setUint32(SAVE_BLOCK_2_PTR, EWRAM_BASE + two, true);
  const key = scene.key ?? 0;
  view.setUint32(two + KEY, key, true);
  for (const [name, { offset, capacity }] of Object.entries(POCKETS)) {
    const slots = scene[name as keyof typeof POCKETS] ?? [];
    if (slots.length > capacity) throw new Error(`${name} holds ${capacity}`);
    slots.forEach((slot, index) => {
      const at = one + offset + index * 4;
      view.setUint16(at, slot.id, true);
      view.setUint16(at + 2, (slot.quantity ^ key) & 0xffff, true);
    });
  }
}
