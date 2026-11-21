import type { ArtVersion } from "../profile/schema";

/** Kept by hand, in game order (amendment 017 §3). pret has no badge-name table in every repo. */
const KANTO = [
  "Boulder",
  "Cascade",
  "Thunder",
  "Rainbow",
  "Soul",
  "Marsh",
  "Volcano",
  "Earth",
] as const;

const HOENN = [
  "Stone",
  "Knuckle",
  "Dynamo",
  "Heat",
  "Balance",
  "Feather",
  "Mind",
  "Rain",
] as const;

const JOHTO = [
  "Zephyr",
  "Hive",
  "Plain",
  "Fog",
  "Storm",
  "Mineral",
  "Glacier",
  "Rising",
] as const;

export const BADGE_NAMES: Readonly<
  Record<ArtVersion, readonly string[] | undefined>
> = {
  "red-blue": KANTO,
  "red-green-japan": KANTO,
  yellow: KANTO,
  gold: [...JOHTO, ...KANTO],
  silver: [...JOHTO, ...KANTO],
  crystal: [...JOHTO, ...KANTO],
  "ruby-sapphire": HOENN,
  emerald: HOENN,
  "firered-leafgreen": KANTO,
};
