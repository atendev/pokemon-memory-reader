import { describe, expect, test } from "bun:test";
import type { Box, Boxes } from "@pokemon-memory-reader/api/schemas";
import {
  boxName,
  gridColumns,
  hasStaleBoxes,
  monAt,
  pickBox,
  slotKind,
} from "./boxes";
import { mon } from "./testing";

const box = (overrides: Partial<Box> = {}): Box => ({
  index: 0,
  name: "BOX1",
  wallpaper: 0,
  readable: true,
  corruptSlots: [],
  slots: Array.from({ length: 30 }, () => null),
  ...overrides,
});

describe("box names", () => {
  test("a null name is Box <n> counted from 1", () => {
    expect(boxName(box({ index: 2, name: null }))).toBe("Box 3");
    expect(boxName(box({ name: "BOX1" }))).toBe("BOX1");
  });
});

describe("slot kinds", () => {
  test("a corrupt slot is null and listed, so it differs from an empty one", () => {
    const b = box({
      corruptSlots: [4],
      slots: [mon(), ...Array(29).fill(null)],
    });
    expect(slotKind(b, 0)).toBe("mon");
    expect(slotKind(b, 1)).toBe("empty");
    expect(slotKind(b, 4)).toBe("corrupt");
    expect(monAt(b, 4)).toBeNull();
    expect(monAt(b, 99)).toBeNull();
  });
});

describe("the box shown", () => {
  const boxes: Boxes = {
    currentBox: 1,
    boxes: [box({ index: 0 }), box({ index: 1 }), box({ index: 2 })],
  };

  test("is the chosen box, else the current one, else the first", () => {
    expect(pickBox(boxes, 2)?.index).toBe(2);
    expect(pickBox(boxes, null)?.index).toBe(1);
    expect(pickBox(boxes, 9)?.index).toBe(1);
    expect(pickBox({ currentBox: null, boxes: boxes.boxes }, null)?.index).toBe(
      0,
    );
    expect(pickBox({ currentBox: null, boxes: [] }, null)).toBeNull();
  });
});

describe("the grid and staleness", () => {
  test("is 5 across for the 20 slots of Gen 1-2 and 6 across for the 30 of Gen 3", () => {
    expect(gridColumns(box({ slots: Array(20).fill(null) }))).toBe(5);
    expect(gridColumns(box())).toBe(6);
  });

  test("the staleness note applies to Gen 1-2 only", () => {
    expect(hasStaleBoxes(1)).toBe(true);
    expect(hasStaleBoxes(2)).toBe(true);
    expect(hasStaleBoxes(3)).toBe(false);
    expect(hasStaleBoxes(undefined)).toBe(false);
  });
});
