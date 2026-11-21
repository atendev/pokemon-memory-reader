import { describe, expect, test } from "bun:test";
import type { GameInfo } from "../../src/adapter/types";
import { baseKey, romKeys } from "../../src/identify/pick-keys";
import type { RomHeader } from "../../src/profile/registry";

const game = (over: Partial<GameInfo> = {}) => ({
  platform: "gba" as const,
  sha1: null,
  crc32: null,
  contentName: null,
  ...over,
});

const gbaHeader: RomHeader = {
  platform: "gba",
  title: "POKEMON EMER",
  gameCode: "BPEE",
  revision: 1,
};
const gbHeader: RomHeader = {
  platform: "gb",
  title: "POKEMON RED",
  maskRomVersion: 1,
  globalChecksum: 0xab,
};

describe("romKeys", () => {
  test("a SHA-1 gives its key, lowercased", () => {
    expect(romKeys(game({ sha1: "ABCDEF" }), gbaHeader)).toEqual([
      "sha1:abcdef",
    ]);
  });

  test("a CRC32 gives its key", () => {
    expect(romKeys(game({ crc32: "1F1C08FB" }), gbaHeader)).toEqual([
      "crc32:1f1c08fb",
    ]);
  });

  test("both hashes give both keys, SHA-1 first", () => {
    expect(romKeys(game({ sha1: "aa", crc32: "bb" }), null)).toEqual([
      "sha1:aa",
      "crc32:bb",
    ]);
  });

  test("a hash wins over the header and the content name", () => {
    expect(
      romKeys(game({ crc32: "bb", contentName: "Emerald" }), gbaHeader),
    ).toEqual(["crc32:bb"]);
  });

  test("no hash gives a GBA header key with code, revision and title", () => {
    expect(romKeys(game(), gbaHeader)).toEqual([
      "header:gba:BPEE:1:POKEMON EMER",
    ]);
  });

  test("no hash gives a GB header key with mask ROM version, checksum in four hex digits and title", () => {
    expect(romKeys(game({ platform: "gb" }), gbHeader)).toEqual([
      "header:gb:1:00ab:POKEMON RED",
    ]);
  });

  test("a RetroArch header key ends with the content name", () => {
    expect(romKeys(game({ contentName: "Emerald" }), gbaHeader)).toEqual([
      "header:gba:BPEE:1:POKEMON EMER:name:Emerald",
    ]);
  });

  test("no hash and no header gives the content name key, tagged with the platform", () => {
    expect(romKeys(game({ contentName: "Emerald" }), null)).toEqual([
      "name:gba:Emerald",
    ]);
    expect(romKeys(game({ platform: "gb", contentName: "Red" }), null)).toEqual(
      ["name:gb:Red"],
    );
  });

  test("no signal gives no key, so the pick lasts for the session", () => {
    expect(romKeys(game(), null)).toEqual([]);
  });

  test("another platform gets no key whatever the signals", () => {
    expect(
      romKeys(game({ platform: "other", sha1: "aa", contentName: "x" }), null),
    ).toEqual([]);
  });

  test("colons and percent signs in a title or content name are escaped", () => {
    const header = { ...gbaHeader, title: "A:B%C" };
    expect(romKeys(game({ contentName: "x:y" }), header)).toEqual([
      "header:gba:BPEE:1:A%3AB%25C:name:x%3Ay",
    ]);
    expect(romKeys(game({ contentName: "50%:off" }), null)).toEqual([
      "name:gba:50%25%3Aoff",
    ]);
  });
});

test("a base-game key names the profile", () => {
  expect(baseKey("emerald-us-1.0")).toBe("base:emerald-us-1.0");
});
