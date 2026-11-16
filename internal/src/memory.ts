export const PLATFORMS = ["gb", "gba"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const DOMAINS = [
  "rom",
  "ewram",
  "iwram",
  "wram",
  "hram",
  "sram",
] as const;
export type Domain = (typeof DOMAINS)[number];
