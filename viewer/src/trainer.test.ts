import { describe, expect, test } from "bun:test";
import type { MapLocation, Pocket } from "@pokemon-memory-reader/api/schemas";
import {
  areaName,
  badgeName,
  badgeRowLabel,
  badgeRows,
  formatId,
  formatMoney,
  formatPlayTime,
  mapLabel,
  obtainedCount,
  pocketFill,
  pocketLabel,
} from "./trainer";

const location = (overrides: Partial<MapLocation> = {}): MapLocation => ({
  mapGroup: 0,
  mapNumber: 9,
  x: 4,
  y: 7,
  section: { id: 3, name: "LITTLEROOT TOWN" },
  ...overrides,
});
const badges = (count: number, obtained: readonly number[] = []) =>
  Array.from({ length: count }, (_, id) => ({
    id,
    name: null,
    obtained: obtained.includes(id),
  }));
const pocket = (items: number, capacity: number): Pocket => ({
  id: "items",
  capacity,
  items: Array.from({ length: items }, (_, i) => ({
    item: { id: i + 1, name: null },
    quantity: 1,
  })),
});

describe("trainer formatting", () => {
  test("money gets the Poké Dollar sign and separators", () => {
    expect(formatMoney(0)).toBe("₽0");
    expect(formatMoney(1234567)).toBe("₽1,234,567");
  });

  test("IDs pad to the five digits the game shows", () => {
    expect(formatId(7)).toBe("00007");
    expect(formatId(65535)).toBe("65535");
  });

  test("play time is hours:mm:ss with unbounded hours and no frames", () => {
    expect(
      formatPlayTime({ hours: 0, minutes: 5, seconds: 9, frames: 59 }),
    ).toBe("0:05:09");
    expect(
      formatPlayTime({ hours: 1234, minutes: 59, seconds: 0, frames: 0 }),
    ).toBe("1234:59:00");
  });
});

describe("location", () => {
  test("the area is the section name, #id when unnamed, null with no section", () => {
    expect(areaName(location())).toBe("LITTLEROOT TOWN");
    expect(areaName(location({ section: { id: 3, name: null } }))).toBe("#3");
    expect(areaName(location({ section: null }))).toBeNull();
  });

  test("the map shows its group, and Gen 1 has none", () => {
    expect(mapLabel(location())).toBe("Map 0:9");
    expect(mapLabel(location({ mapGroup: null }))).toBe("Map 9");
  });
});

describe("badges", () => {
  test("a null name counts from Badge 1", () => {
    expect(badgeName({ id: 0, name: null, obtained: false })).toBe("Badge 1");
    expect(badgeName({ id: 0, name: "Stone Badge", obtained: true })).toBe(
      "Stone Badge",
    );
  });

  test("eight badges are one row and sixteen are two", () => {
    expect(badgeRows(badges(8))).toHaveLength(1);
    const rows = badgeRows(badges(16));
    expect(rows).toHaveLength(2);
    expect(rows[1]?.[0]?.id).toBe(8);
  });

  test("only a sixteen-badge row carries a Johto or Kanto label", () => {
    expect(badgeRowLabel(8, 0)).toBeNull();
    expect(badgeRowLabel(16, 0)).toBe("Johto");
    expect(badgeRowLabel(16, 1)).toBe("Kanto");
  });

  test("counts the obtained ones", () => {
    expect(obtainedCount(badges(8, [0, 3, 5]))).toBe(3);
  });
});

describe("pockets", () => {
  test("labels the five pockets and passes an unknown one through", () => {
    expect(pocketLabel("tmhm")).toBe("TMs & HMs");
    expect(pocketLabel("keyItems")).toBe("Key items");
    expect(pocketLabel("medicine")).toBe("medicine");
  });

  test("empty, open and full", () => {
    expect(pocketFill(pocket(0, 30))).toBe("empty");
    expect(pocketFill(pocket(5, 30))).toBe("open");
    expect(pocketFill(pocket(30, 30))).toBe("full");
  });
});
