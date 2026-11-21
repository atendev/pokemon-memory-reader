import type { Box, Boxes, Pokemon } from "@pokemon-memory-reader/api/schemas";

/** A box with no stored name is `Box <n>`, numbered from 1 as the game's own screens do. */
export function boxName(box: Box): string {
  return box.name ?? `Box ${box.index + 1}`;
}

export type SlotKind = "mon" | "corrupt" | "empty";

/** An empty slot is `null` and a corrupt one is `null` and listed, so the list is what tells them apart (spec §7.9). */
export function slotKind(box: Box, slot: number): SlotKind {
  if (box.slots[slot]) return "mon";
  return box.corruptSlots.includes(slot) ? "corrupt" : "empty";
}

/** The box shown: the chosen one while it exists, else the current box, else the first. */
export function pickBox(boxes: Boxes, chosen: number | null): Box | null {
  const by = (index: number | null) =>
    index === null ? undefined : boxes.boxes.find((b) => b.index === index);
  return by(chosen) ?? by(boxes.currentBox) ?? boxes.boxes[0] ?? null;
}

/** Gen 1-2 boxes hold 20 mons and show 5 across, and Gen 3's hold 30 and show 6 across (spec §11.5). */
export function gridColumns(box: Box): number {
  return box.slots.length === 20 ? 5 : 6;
}

/** Gen 1-2 keep non-current boxes in save RAM, so they are only as fresh as the last save or box switch (spec §7.9). */
export function hasStaleBoxes(generation: number | undefined): boolean {
  return generation !== undefined && generation <= 2;
}

/** The mon in a slot, or null for an empty, corrupt or out-of-range one. */
export function monAt(box: Box, slot: number): Pokemon | null {
  return box.slots[slot] ?? null;
}
