const MAX_LEVEL = 100;

const cube = (n: number) => n * n * n;

/**
 * Experience needed to reach level `n` per growth rate ID, as pokeemerald's `gExperienceTables`
 * computes it with C integer division. Level 1 is stored as 1. IDs 6 and 7 are unused copies of
 * medium fast and aren't listed.
 */
const EXPERIENCE: ReadonlyArray<(n: number) => number> = [
  (n) => cube(n),
  (n) => {
    if (n <= 50) return Math.floor(((100 - n) * cube(n)) / 50);
    if (n <= 68) return Math.floor(((150 - n) * cube(n)) / 100);
    if (n <= 98)
      return Math.floor((Math.floor((1911 - 10 * n) / 3) * cube(n)) / 500);
    return Math.floor(((160 - n) * cube(n)) / 100);
  },
  (n) => {
    if (n <= 15)
      return Math.floor(((Math.floor((n + 1) / 3) + 24) * cube(n)) / 50);
    if (n <= 36) return Math.floor(((n + 14) * cube(n)) / 50);
    return Math.floor(((Math.floor(n / 2) + 32) * cube(n)) / 50);
  },
  (n) =>
    n === 1 ? 1 : Math.floor((6 * cube(n)) / 5) - 15 * n * n + 100 * n - 140,
  (n) => Math.floor((4 * cube(n)) / 5),
  (n) => Math.floor((5 * cube(n)) / 4),
];

/**
 * The level an experience total reaches, the way `GetLevelFromMonExp` counts it, but never below 1.
 * null for a growth rate ID outside the six the game uses.
 */
export function levelFromExperience(
  growthRate: number,
  experience: number,
): number | null {
  const needed = EXPERIENCE[growthRate];
  if (needed === undefined) return null;
  let level = 1;
  while (level < MAX_LEVEL && needed(level + 1) <= experience) level++;
  return level;
}
