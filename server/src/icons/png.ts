/** The most the route serves (spec §11.9, "Route rules"). */
export const MAX_ICON_BYTES = 512 * 1024;

const MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A PNG by its eight magic bytes, at most 512 KB. */
export const isServablePng = (bytes: Uint8Array): boolean =>
  bytes.length <= MAX_ICON_BYTES &&
  bytes.length >= MAGIC.length &&
  MAGIC.every((byte, i) => bytes[i] === byte);
