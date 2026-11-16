import type { Range } from "../adapter/types";
import type { RomHeader } from "../profile/registry";

/** The GBA header bytes identification needs: title at 0xA0, game code at 0xAC, version at 0xBC. */
const GBA_HEADER: Range = { domain: "rom", offset: 0xa0, length: 0x1d };
/** The GB header bytes: title from 0x134, CGB flag at 0x143, mask ROM version at 0x14C, global checksum at 0x14E. */
const GB_HEADER: Range = { domain: "rom", offset: 0x134, length: 0x1c };

export function headerRange(platform: "gb" | "gba"): Range {
  return platform === "gba" ? GBA_HEADER : GB_HEADER;
}

/**
 * Header text as `status.rom.title` shows it (amendment 020 §7): cut at the first NUL, every byte
 * outside 0x20-0x7E becomes `?`, trailing spaces go. Bytes are ASCII, never the game charmap.
 */
function ascii(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  const text = Array.from(end < 0 ? bytes : bytes.subarray(0, end), (byte) =>
    byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : "?",
  ).join("");
  return text.trimEnd();
}

/** null when the bytes are shorter than the header read asked for. */
export function parseHeader(
  platform: "gb" | "gba",
  bytes: Uint8Array,
): RomHeader | null {
  const wanted = headerRange(platform).length;
  if (bytes.length < wanted) return null;
  if (platform === "gba") {
    return {
      platform: "gba",
      title: ascii(bytes.subarray(0, 12)),
      gameCode: ascii(bytes.subarray(12, 16)),
      revision: bytes[0x1c] ?? 0,
    };
  }
  // The CGB flag at 0x143 (index 15) takes the title's last byte when bit 7 is set.
  const cgb = ((bytes[15] ?? 0) & 0x80) !== 0;
  return {
    platform: "gb",
    title: ascii(bytes.subarray(0, cgb ? 15 : 16)),
    maskRomVersion: bytes[0x18] ?? 0,
    globalChecksum: ((bytes[0x1a] ?? 0) << 8) | (bytes[0x1b] ?? 0),
  };
}
