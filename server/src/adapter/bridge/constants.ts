import type { Domain } from "@pokemon-memory-reader/internal/memory";

export const PROTOCOL = 1;

export const FRAME_KIND = {
  HELLO: 1,
  GAME: 2,
  READ: 3,
  DATA: 4,
  ERROR: 5,
} as const;
export type FrameKindName = keyof typeof FRAME_KIND;

export const MAX_BODY = {
  HELLO: 4096,
  GAME: 4096,
  READ: 4610,
  DATA: 65536,
  ERROR: 4096,
} as const satisfies Record<FrameKindName, number>;

/** The bridge caps and merge gap. loadProfiles measures every profile's main batch and box request with them (amendment 026). */
export const BRIDGE_CAPS = {
  maxRanges: 512,
  maxBytes: 65536,
  mergeGap: 32,
} as const;

export const DOMAIN_CODES = {
  rom: 1,
  ewram: 2,
  iwram: 3,
  wram: 4,
  hram: 5,
  sram: 6,
} as const satisfies Record<Domain, number>;

export const ERROR_CODES = [
  "bad_frame",
  "busy",
  "no_game",
  "bad_range",
  "too_large",
  "unknown_kind",
  "internal",
] as const;

export const DEFAULT_BRIDGE_PORTS = { mgba: 7426, bizhawk: 7427 } as const;

/** Bytes after the length field that every frame carries: kind (1) and id (4). */
export const FRAME_HEADER_BYTES = 5;
/** Bytes per range in a READ body: domain (1), offset (4), length (4). */
export const RANGE_BYTES = 9;
