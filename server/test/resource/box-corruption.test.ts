import { expect, test } from "bun:test";
import type { Boxes } from "@pokemon-memory-reader/api/schemas";
import type { Log } from "../../src/log";
import { createBoxCorruptionLog } from "../../src/resource/box-corruption";

function recorder() {
  const warnings: object[] = [];
  const log: Log = {
    debug() {},
    info() {},
    error() {},
    warn: (_message, data) => {
      warnings.push(data ?? {});
    },
  };
  return { log, warnings };
}

const boxesWith = (corrupt: Record<number, number[]>): Boxes => ({
  currentBox: 0,
  boxes: Array.from({ length: 14 }, (_, index) => ({
    index,
    name: null,
    wallpaper: null,
    readable: true,
    corruptSlots: corrupt[index] ?? [],
    slots: [],
  })),
});

test("a corrupt slot warns once per box and slot, however often it's reported", () => {
  const { log, warnings } = recorder();
  const corruption = createBoxCorruptionLog(log);
  corruption.report(boxesWith({ 1: [3], 2: [3, 4] }));
  corruption.report(boxesWith({ 1: [3], 2: [3, 4] }));
  corruption.report(boxesWith({ 1: [3, 9] }));
  expect(warnings).toEqual([
    { box: 1, slot: 3 },
    { box: 2, slot: 3 },
    { box: 2, slot: 4 },
    { box: 1, slot: 9 },
  ]);
});

test("a game change warns again", () => {
  const { log, warnings } = recorder();
  const corruption = createBoxCorruptionLog(log);
  corruption.report(boxesWith({ 0: [0] }));
  corruption.reset();
  corruption.report(boxesWith({ 0: [0] }));
  expect(warnings).toHaveLength(2);
});

test("boxes with no corrupt slot never warn", () => {
  const { log, warnings } = recorder();
  createBoxCorruptionLog(log).report(boxesWith({}));
  expect(warnings).toEqual([]);
});
