import type { GameInfo } from "../adapter/types";
import type { RomHeader } from "../profile/registry";

/** A manual-pick key (amendment 014 §2, §3). `base:<profileId>` is the opt-in base-game pick. */
export type PickKey =
  | `sha1:${string}`
  | `crc32:${string}`
  | `header:${string}`
  | `name:${string}`
  | `base:${string}`;

/** `%` and `:` are the only characters a key escapes, in titles and content names. */
const escapeKey = (text: string): string =>
  text.replaceAll("%", "%25").replaceAll(":", "%3A");

const hex4 = (value: number) => value.toString(16).padStart(4, "0");

function headerKey(
  header: RomHeader,
  contentName: string | null,
): PickKey | null {
  const title = escapeKey(header.title);
  const body =
    header.platform === "gba"
      ? `gba:${header.gameCode}:${header.revision}:${title}`
      : `gb:${header.maskRomVersion}:${hex4(header.globalChecksum)}:${title}`;
  return contentName === null
    ? `header:${body}`
    : `header:${body}:name:${escapeKey(contentName)}`;
}

/**
 * The keys a ROM's pick is saved under and found by, strongest first (amendment 014 §2). Any
 * hash the emulator gave decides: SHA-1 and CRC32, SHA-1 first. With no hash the header key, which
 * on RetroArch ends with the content name. With neither, RetroArch's content name alone. Empty
 * when the signals allow no key, so the pick lasts for the session only.
 */
export function romKeys(
  game: Pick<GameInfo, "platform" | "sha1" | "crc32" | "contentName">,
  header: RomHeader | null,
): readonly PickKey[] {
  if (game.platform === "other") return [];
  const hashes: PickKey[] = [];
  if (game.sha1 !== null) hashes.push(`sha1:${game.sha1.toLowerCase()}`);
  if (game.crc32 !== null) hashes.push(`crc32:${game.crc32.toLowerCase()}`);
  if (hashes.length > 0) return hashes;
  const name = game.contentName ?? null;
  if (header !== null) {
    const key = headerKey(header, name);
    return key === null ? [] : [key];
  }
  return name === null ? [] : [`name:${game.platform}:${escapeKey(name)}`];
}

export const baseKey = (profileId: string): PickKey => `base:${profileId}`;
