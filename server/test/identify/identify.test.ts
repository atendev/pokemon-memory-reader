import { describe, expect, test } from "bun:test";
import type { GameInfo } from "../../src/adapter/types";
import { headerRange, parseHeader } from "../../src/identify/header";
import { identification } from "../../src/identify/identify";
import { runJob } from "../../src/loop/job";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import { emeraldMemory, serve, TREECKO } from "../support/emerald-memory";

const EMERALD_CRC32 = "1f1c08fb";
const EMERALD_SHA1 = "f3ae088181bf583e55daf962a92bb46f4f1d07b7";

const { registry } = loadProfiles({ builtin: [emerald], user: [] });

/** Same game code as Emerald, another revision: a header-only profile with no signature, and one with its own. */
const unsigned = {
  id: "emerald-unsigned",
  kind: "official",
  name: "Emerald (unsigned test revision)",
  extends: "emerald-us-1.0",
  identify: {
    crc32: ["aaaaaaaa"],
    header: { gameCode: "BPEE", revision: 1 },
    signature: [],
  },
} as const;
const signed = {
  ...unsigned,
  id: "emerald-signed",
  name: "Emerald (signed test revision)",
  identify: {
    ...unsigned.identify,
    crc32: ["bbbbbbbb"],
    header: { gameCode: "BPEE", revision: 2 },
    signature: [{ address: "0x080001bc", bytes: "01020304" }],
  },
} as const;
const strict = {
  ...signed,
  id: "emerald-strict",
  identify: {
    ...signed.identify,
    crc32: ["cccccccc"],
    header: { gameCode: "BPEE", revision: 1 },
  },
} as const;
const sharedHeader = loadProfiles({
  builtin: [emerald],
  user: [
    { path: "unsigned.json", json: unsigned },
    { path: "strict.json", json: strict },
  ],
});
const withBoth = loadProfiles({
  builtin: [emerald],
  user: [
    { path: "unsigned.json", json: unsigned },
    { path: "signed.json", json: signed },
  ],
});
if (withBoth.problems.length > 0)
  throw new Error(JSON.stringify(withBoth.problems));

const ascii = (text: string) => new TextEncoder().encode(text);

function gbaHeader(code = "BPEE", revision = 0): Uint8Array {
  const bytes = new Uint8Array(0x1d);
  bytes.set(ascii("POKEMON EMER"));
  bytes.set(ascii(code), 12);
  bytes[0x1c] = revision;
  return bytes;
}

const gba = (over: Partial<GameInfo> = {}): GameInfo => ({
  platform: "gba",
  crc32: null,
  sha1: null,
  romName: null,
  domains: { rom: 0x100000 },
  ...over,
});

describe("parseHeader", () => {
  test("reads the GBA title, code and revision", () => {
    expect(parseHeader("gba", gbaHeader("BPEE", 2))).toEqual({
      platform: "gba",
      title: "POKEMON EMER",
      gameCode: "BPEE",
      revision: 2,
    });
  });

  test("shows bytes outside printable ASCII as ? and stops at a NUL", () => {
    const bytes = gbaHeader();
    bytes.set([0x41, 0x80, 0x00, 0x42], 0);
    expect(parseHeader("gba", bytes)).toMatchObject({ title: "A?" });
  });

  test("reads the GB title, mask ROM version and global checksum", () => {
    const bytes = new Uint8Array(0x1c);
    bytes.set(ascii("POKEMON RED"));
    bytes[0x18] = 1;
    bytes[0x1a] = 0xab;
    bytes[0x1b] = 0xcd;
    expect(parseHeader("gb", bytes)).toEqual({
      platform: "gb",
      title: "POKEMON RED",
      maskRomVersion: 1,
      globalChecksum: 0xabcd,
    });
  });

  test("a CGB flag in the title's last byte drops it from the title", () => {
    const bytes = new Uint8Array(0x1c);
    bytes.set(ascii("POKEMON CRYSTAL"));
    bytes[15] = 0x80;
    expect(parseHeader("gb", bytes)).toMatchObject({
      title: "POKEMON CRYSTAL",
    });
  });

  test("short bytes give null", () => {
    expect(parseHeader("gba", new Uint8Array(4))).toBeNull();
    expect(parseHeader("gb", new Uint8Array(4))).toBeNull();
  });
});

describe("identification job", () => {
  const reader =
    (memory = emeraldMemory([TREECKO])) =>
    async (ranges: Parameters<typeof serve>[1]) => ({
      kind: "data" as const,
      slices: ranges.map((r) => serve(memory, [r])),
    });

  test("a timeout or failed read finishes with null so the loop retries", async () => {
    for (const outcome of [
      { kind: "timeout" } as const,
      { kind: "failed", reason: "dropped" } as const,
    ]) {
      const result = await runJob(
        identification(gba(), registry),
        async () => outcome,
      );
      expect(result).toBeNull();
    }
  });

  test("a game with no ROM access is unidentified without reading", async () => {
    let reads = 0;
    const result = await runJob(
      identification(gba({ domains: {} }), registry),
      async () => {
        reads++;
        return { kind: "timeout" };
      },
    );
    expect(reads).toBe(0);
    expect(result?.kind).toBe("unidentified");
  });

  const identify = (
    game: GameInfo,
    memory: ReturnType<typeof emeraldMemory>,
    profiles = registry,
  ) => runJob(identification(game, profiles), reader(memory));

  const tamper = (revision = 0) => {
    const memory = emeraldMemory([TREECKO]);
    memory.rom[0xbc] = revision;
    return memory;
  };

  describe("exact hash", () => {
    test("a CRC32 match identifies by hash, with the signature checked in the same read", async () => {
      const reads: unknown[] = [];
      const read = reader();
      const result = await runJob(
        identification(gba({ crc32: EMERALD_CRC32 }), registry),
        async (r) => {
          reads.push(r);
          return read(r);
        },
      );
      expect(reads).toHaveLength(1);
      expect(result).toMatchObject({
        kind: "identified",
        match: "exact",
        signature: "match",
        header: { gameCode: "BPEE" },
      });
    });

    test("a SHA-1 match identifies, and SHA-1 is tried before CRC32", async () => {
      const both = await identify(
        gba({ sha1: EMERALD_SHA1, crc32: "aaaaaaaa" }),
        emeraldMemory([TREECKO]),
        withBoth.registry,
      );
      expect(both).toMatchObject({ match: "exact" });
      if (both?.kind === "identified")
        expect(both.profile.id).toBe("emerald-us-1.0");
    });

    test("a supplied SHA-1 that matches nothing is not rescued by a CRC32 match", async () => {
      const result = await identify(
        gba({ sha1: "0".repeat(40), crc32: EMERALD_CRC32 }),
        emeraldMemory([TREECKO]),
      );
      expect(result).toMatchObject({
        kind: "unidentified",
        reason: "modified_rom",
      });
    });

    test("an uppercase hash still matches", async () => {
      const result = await identify(
        gba({ crc32: EMERALD_CRC32.toUpperCase() }),
        emeraldMemory([TREECKO]),
      );
      expect(result).toMatchObject({ kind: "identified", match: "exact" });
    });

    test("a failed signature on a hash match still identifies and reports the mismatch", async () => {
      const memory = emeraldMemory([TREECKO]);
      memory.rom.set([1, 2, 3, 4], 0x1bc);
      const result = await identify(gba({ crc32: EMERALD_CRC32 }), memory);
      expect(result).toMatchObject({
        kind: "identified",
        match: "exact",
        signature: "mismatch",
      });
    });

    test("a profile with no signature reports null on a hash match", async () => {
      const result = await identify(
        gba({ crc32: "aaaaaaaa" }),
        tamper(1),
        withBoth.registry,
      );
      expect(result).toMatchObject({
        kind: "identified",
        match: "exact",
        signature: null,
      });
    });

    test("an adapter that can't read ROM still matches by hash, with the signature unchecked and no header", async () => {
      let reads = 0;
      const result = await runJob(
        identification(gba({ crc32: EMERALD_CRC32, domains: {} }), registry),
        async () => {
          reads++;
          return { kind: "timeout" };
        },
      );
      expect(reads).toBe(0);
      expect(result).toMatchObject({
        kind: "identified",
        match: "exact",
        signature: "unchecked",
        header: null,
      });
    });

    test("an unsigned profile on such an adapter reports a null signature", async () => {
      const result = await runJob(
        identification(
          gba({ crc32: "aaaaaaaa", domains: {} }),
          withBoth.registry,
        ),
        async () => ({ kind: "timeout" }),
      );
      expect(result).toMatchObject({ match: "exact", signature: null });
    });

    test("a hash that matches nothing while the header matches a base game is a modified ROM", async () => {
      const result = await identify(
        gba({ crc32: "deadbeef" }),
        emeraldMemory([TREECKO]),
      );
      expect(result).toMatchObject({
        kind: "unidentified",
        reason: "modified_rom",
        header: { gameCode: "BPEE" },
      });
    });

    test("a hash that matches nothing with an unknown header is no match", async () => {
      const memory = emeraldMemory([TREECKO]);
      memory.rom.set(ascii("ZZZZ"), 0xac);
      expect(await identify(gba({ crc32: "deadbeef" }), memory)).toMatchObject({
        kind: "unidentified",
        reason: "no_match",
      });
    });

    test("a hash that matches nothing on an adapter that can't read ROM is no match", async () => {
      const result = await runJob(
        identification(gba({ crc32: "deadbeef", domains: {} }), registry),
        async () => ({ kind: "timeout" }),
      );
      expect(result).toMatchObject({
        kind: "unidentified",
        reason: "no_match",
      });
    });
  });

  describe("header and signature, with no hash", () => {
    test("a header match whose signature matches identifies by header", async () => {
      const result = await identify(gba(), emeraldMemory([TREECKO]));
      expect(result).toMatchObject({
        kind: "identified",
        match: "header",
        signature: "match",
      });
      if (result?.kind === "identified")
        expect(result.profile.id).toBe("emerald-us-1.0");
    });

    test("reads the header first, then the signature words", async () => {
      const reads: unknown[] = [];
      const read = reader();
      await runJob(identification(gba(), registry), async (r) => {
        reads.push(r);
        return read(r);
      });
      expect(reads).toEqual([
        [headerRange("gba")],
        [
          { domain: "rom", offset: 0x1bc, length: 4 },
          { domain: "rom", offset: 0x1c8, length: 4 },
          { domain: "rom", offset: 0x1cc, length: 4 },
        ],
      ]);
    });

    test("a signature mismatch is a modified ROM", async () => {
      const memory = emeraldMemory([TREECKO]);
      memory.rom.set([9, 9, 9, 9], 0x1c8);
      expect(await identify(gba(), memory)).toMatchObject({
        kind: "unidentified",
        reason: "modified_rom",
        header: { gameCode: "BPEE" },
      });
    });

    test("a signature word that can't be read is a modified ROM", async () => {
      const memory = emeraldMemory([TREECKO]);
      memory.rom = memory.rom.slice(0, 0x1c0);
      expect(await identify(gba(), memory)).toMatchObject({
        kind: "unidentified",
        reason: "modified_rom",
      });
    });

    test("a header match on a profile with no signature identifies with a null signature", async () => {
      const result = await identify(gba(), tamper(1), withBoth.registry);
      expect(result).toMatchObject({
        kind: "identified",
        match: "header",
        signature: null,
      });
      if (result?.kind === "identified")
        expect(result.profile.id).toBe("emerald-unsigned");
    });

    test("a header match is header-only with no signature words to read", async () => {
      const reads: unknown[] = [];
      const read = reader(tamper(1));
      await runJob(identification(gba(), withBoth.registry), async (r) => {
        reads.push(r);
        return read(r);
      });
      expect(reads).toHaveLength(1);
    });

    test("a profile whose signature fails is not identified", async () => {
      const result = await identify(gba(), tamper(2), withBoth.registry);
      expect(result).toMatchObject({
        kind: "unidentified",
        reason: "modified_rom",
      });
    });

    test("a failed signature on a shared header keeps an unsigned profile from taking the ROM", async () => {
      expect(
        await identify(gba(), tamper(1), sharedHeader.registry),
      ).toMatchObject({ kind: "unidentified", reason: "modified_rom" });
    });

    test("an unknown game code is unidentified", async () => {
      const memory = emeraldMemory([TREECKO]);
      memory.rom.set(ascii("ZZZZ"), 0xac);
      expect(await identify(gba(), memory)).toMatchObject({
        kind: "unidentified",
        reason: "no_match",
      });
    });

    test("a timeout while reading the signature finishes with null", async () => {
      const read = reader();
      let calls = 0;
      const result = await runJob(
        identification(gba(), registry),
        async (r) => {
          calls++;
          return calls === 1 ? read(r) : { kind: "timeout" };
        },
      );
      expect(result).toBeNull();
    });
  });
});
