import { describe, expect, test } from "bun:test";
import type { GameInfo } from "../../src/adapter/types";
import { headerRange, parseHeader } from "../../src/identify/header";
import { identification, identifyByHeader } from "../../src/identify/identify";
import { runJob } from "../../src/loop/job";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import { emeraldMemory, serve, TREECKO } from "../support/emerald-memory";

const { registry } = loadProfiles({ builtin: [emerald], user: [] });

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

describe("identifyByHeader", () => {
  test("a header that matches one profile identifies it by header", () => {
    const header = parseHeader("gba", gbaHeader());
    const result = identifyByHeader(gba(), header, registry);
    expect(result).toMatchObject({
      kind: "identified",
      match: "header",
      signature: "unchecked",
    });
    if (result.kind === "identified")
      expect(result.profile.id).toBe("emerald-us-1.0");
  });

  test("an unknown game code is unidentified", () => {
    const header = parseHeader("gba", gbaHeader("ZZZZ"));
    expect(identifyByHeader(gba(), header, registry)).toMatchObject({
      kind: "unidentified",
      reason: "no_match",
    });
  });

  test("a missing header is unidentified", () => {
    expect(identifyByHeader(gba(), null, registry)).toMatchObject({
      kind: "unidentified",
      reason: "no_match",
      header: null,
    });
  });

  test("another platform is unidentified without a header", () => {
    expect(
      identifyByHeader(gba({ platform: "other" }), null, registry),
    ).toMatchObject({ kind: "unidentified", reason: "other_platform" });
  });
});

describe("identification job", () => {
  const reader =
    (memory = emeraldMemory([TREECKO])) =>
    async (ranges: Parameters<typeof serve>[1]) => ({
      kind: "data" as const,
      slices: ranges.map((r) => serve(memory, [r])),
    });

  test("reads the header range once, then identifies", async () => {
    const reads: unknown[] = [];
    const read = reader();
    const result = await runJob(identification(gba(), registry), async (r) => {
      reads.push(r);
      return read(r);
    });
    expect(reads).toEqual([[headerRange("gba")]]);
    expect(result?.kind).toBe("identified");
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
});
