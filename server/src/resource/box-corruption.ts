import type { Boxes } from "@pokemon-memory-reader/api/schemas";
import type { Log } from "../log";

/**
 * Warns once per box index and slot about a Pokémon the decoder couldn't read, until `reset()`
 * (spec §6.5). The read loop calls `report` with each decoded `boxes` value and `reset` when the
 * game changes.
 */
export function createBoxCorruptionLog(log: Log) {
  const seen = new Set<string>();
  return {
    report(boxes: Boxes): void {
      for (const box of boxes.boxes) {
        for (const slot of box.corruptSlots) {
          const key = `${box.index}:${slot}`;
          if (seen.has(key)) continue;
          seen.add(key);
          log.warn("a boxed Pokémon is corrupt and reads as empty", {
            box: box.index,
            slot,
          });
        }
      }
    },
    reset(): void {
      seen.clear();
    },
  };
}
