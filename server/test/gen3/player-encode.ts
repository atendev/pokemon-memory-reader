import { encodeText } from "./encode";

/** What one synthetic Emerald save puts in memory (pokeemerald `SaveBlock1` and `SaveBlock2`). */
export interface PlayerScene {
  name?: string;
  trainerId?: number;
  secretId?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  frames?: number;
  /** The money as the player sees it. It is stored XORed with `key`. */
  money?: number;
  key?: number;
  /** The badges the player has, by 0-based index. */
  badges?: readonly number[];
  x?: number;
  y?: number;
  mapGroup?: number;
  mapNumber?: number;
  /** `gMapHeader.regionMapSectionId`. */
  section?: number;
  /** Where each block sits in EWRAM, so a test can move it. */
  blocks?: { readonly one: number; readonly two: number };
}

const EWRAM_BASE = 0x02000000;
const SAVE_BLOCK_1_PTR = 0x5d8c;
const SAVE_BLOCK_2_PTR = 0x5d90;
const MAP_HEADER = 0x37318;
const MONEY = 0x490;
const FLAGS = 0x1270;
const KEY = 0xac;
const BADGE_FLAG_1 = 0x867;
export const DEFAULT_BLOCKS = { one: 0x25000, two: 0x29000 } as const;

/** Writes a player into Emerald memory and points `gSaveBlock1Ptr` and `gSaveBlock2Ptr` at it. */
export function writePlayer(
  memory: { ewram: Uint8Array; iwram: Uint8Array },
  scene: PlayerScene = {},
): void {
  const { one, two } = scene.blocks ?? DEFAULT_BLOCKS;
  const { ewram } = memory;
  const view = new DataView(ewram.buffer);
  const iwram = new DataView(memory.iwram.buffer);
  iwram.setUint32(SAVE_BLOCK_1_PTR, EWRAM_BASE + one, true);
  iwram.setUint32(SAVE_BLOCK_2_PTR, EWRAM_BASE + two, true);

  const key = scene.key ?? 0;
  ewram.set(encodeText(scene.name ?? "BRENDAN", 8), two);
  view.setUint16(two + 0x0a, scene.trainerId ?? 12345, true);
  view.setUint16(two + 0x0c, scene.secretId ?? 6789, true);
  view.setUint16(two + 0x0e, scene.hours ?? 0, true);
  ewram[two + 0x10] = scene.minutes ?? 0;
  ewram[two + 0x11] = scene.seconds ?? 0;
  ewram[two + 0x12] = scene.frames ?? 0;
  view.setUint32(two + KEY, key, true);

  view.setInt16(one, scene.x ?? 0, true);
  view.setInt16(one + 0x02, scene.y ?? 0, true);
  ewram[one + 0x04] = scene.mapGroup ?? 0;
  ewram[one + 0x05] = scene.mapNumber ?? 0;
  view.setUint32(one + MONEY, ((scene.money ?? 0) ^ key) >>> 0, true);
  for (const id of scene.badges ?? []) {
    const flag = BADGE_FLAG_1 + id;
    const at = one + FLAGS + (flag >> 3);
    ewram[at] = (ewram[at] ?? 0) | (1 << (flag & 7));
  }
  ewram[MAP_HEADER + 0x14] = scene.section ?? 0;
}
