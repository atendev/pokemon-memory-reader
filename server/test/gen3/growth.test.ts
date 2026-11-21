import { expect, test } from "bun:test";
import { levelFromExperience } from "../../src/format/gen3/growth";

/**
 * Experience at chosen levels per growth rate ID, taken from pret/pokeemerald's
 * `gExperienceTables` (built with a C compiler from the pinned macros, every level of every rate
 * checked against `levelFromExperience`). Rates: 0 medium fast, 1 erratic, 2 fluctuating,
 * 3 medium slow, 4 fast, 5 slow.
 */
const EXPERIENCE: Record<number, Record<number, number>> = {
  0: {
    2: 8,
    15: 3375,
    36: 46656,
    50: 125000,
    68: 314432,
    98: 941192,
    100: 1000000,
  },
  1: {
    2: 15,
    15: 5737,
    36: 59719,
    50: 125000,
    68: 257834,
    98: 583539,
    100: 600000,
  },
  2: {
    2: 4,
    15: 1957,
    36: 46656,
    50: 142500,
    68: 415050,
    98: 1524731,
    100: 1640000,
  },
  3: {
    2: 9,
    15: 2035,
    36: 40007,
    50: 117360,
    68: 314618,
    98: 995030,
    100: 1059860,
  },
  4: {
    2: 6,
    15: 2700,
    36: 37324,
    50: 100000,
    68: 251545,
    98: 752953,
    100: 800000,
  },
  5: {
    2: 10,
    15: 4218,
    36: 58320,
    50: 156250,
    68: 393040,
    98: 1176490,
    100: 1250000,
  },
};

test("a level starts at its table experience and ends one short of the next", () => {
  for (const [rate, levels] of Object.entries(EXPERIENCE)) {
    for (const [level, experience] of Object.entries(levels)) {
      expect(levelFromExperience(Number(rate), experience)).toBe(Number(level));
      expect(levelFromExperience(Number(rate), experience - 1)).toBe(
        Number(level) - 1,
      );
    }
  }
});

test("level 100 caps, however much experience is stored", () => {
  expect(levelFromExperience(0, 4_000_000_000)).toBe(100);
});

test("experience below level 2 gives level 1, never 0", () => {
  expect(levelFromExperience(3, 0)).toBe(1);
  expect(levelFromExperience(1, 14)).toBe(1);
});

test("a growth rate outside the six the game uses gives null", () => {
  expect(levelFromExperience(6, 1000)).toBeNull();
  expect(levelFromExperience(255, 1000)).toBeNull();
});
