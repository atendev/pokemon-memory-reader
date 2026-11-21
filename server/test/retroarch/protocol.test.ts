import { describe, expect, test } from "bun:test";
import {
  parseRead,
  parseStatus,
  planChunks,
  platformOf,
} from "../../src/adapter/retroarch/protocol";

describe("parseStatus", () => {
  test("reads the three valid replies", () => {
    expect(parseStatus("GET_STATUS CONTENTLESS")).toEqual({
      kind: "contentless",
    });
    expect(parseStatus("GET_STATUS PLAYING gba,Emerald\n")).toEqual({
      kind: "content",
      paused: false,
      systemId: "gba",
      contentName: "Emerald",
      crc32: null,
    });
    expect(parseStatus("GET_STATUS PAUSED gba,Emerald,crc32=1a2b3c4d")).toEqual(
      {
        kind: "content",
        paused: true,
        systemId: "gba",
        contentName: "Emerald",
        crc32: "1a2b3c4d",
      },
    );
  });

  test("pads the crc32 to 8 digits and turns 0 into no hash", () => {
    const padded = parseStatus("GET_STATUS PLAYING gba,A,crc32=abc");
    expect(padded).toMatchObject({ crc32: "00000abc" });
    const zero = parseStatus("GET_STATUS PLAYING gba,A,crc32=0");
    expect(zero).toMatchObject({ crc32: null });
  });

  test("a content name keeps its commas and UNKNOWN counts as missing", () => {
    expect(
      parseStatus("GET_STATUS PLAYING gba,Red, Blue (v1.1)"),
    ).toMatchObject({
      contentName: "Red, Blue (v1.1)",
    });
    expect(parseStatus("GET_STATUS PLAYING UNKNOWN,UNKNOWN")).toMatchObject({
      systemId: null,
      contentName: null,
    });
  });

  test("master's ERROR reply parses and anything else does not", () => {
    expect(parseStatus("GET_STATUS ERROR")).toEqual({ kind: "error" });
    expect(parseStatus("GET_STATUS WHAT")).toBeNull();
    expect(parseStatus("GET_STATUS PLAYING nocomma")).toBeNull();
    expect(parseStatus("VERSION 1.22.2")).toBeNull();
  });

  test("system ids map to platforms", () => {
    expect(platformOf("gba")).toBe("gba");
    expect(platformOf("gbc")).toBe("gb");
    expect(platformOf("nes")).toBe("other");
    expect(platformOf(null)).toBe("other");
  });
});

describe("parseRead", () => {
  test("data, error and unrelated text", () => {
    expect(parseRead("READ_CORE_MEMORY 80000a0 50 4f")).toEqual({
      kind: "data",
      address: 0x80000a0,
      bytes: Uint8Array.of(0x50, 0x4f),
    });
    expect(parseRead("READ_CORE_MEMORY 80000a0 -1")).toEqual({
      kind: "error",
      address: 0x80000a0,
    });
    expect(parseRead("GET_STATUS CONTENTLESS")).toBeNull();
  });
});

describe("planChunks", () => {
  test("splits a range at 16 KiB", () => {
    const plan = planChunks(
      "gba",
      [{ domain: "ewram", offset: 0, length: 40000 }],
      [true],
    );
    expect(plan.chunks).toEqual([
      { address: 0x02000000, length: 16384 },
      { address: 0x02004000, length: 16384 },
      { address: 0x02008000, length: 7232 },
    ]);
  });

  test("cuts a GB WRAM range at the 0xD000 descriptor", () => {
    const plan = planChunks(
      "gb",
      [{ domain: "wram", offset: 0xf00, length: 0x200 }],
      [true],
    );
    expect(plan.chunks).toEqual([
      { address: 0xcf00, length: 0x100 },
      { address: 0xd000, length: 0x100 },
    ]);
    expect(plan.pieces[0]?.map((p) => p.at)).toEqual([0, 0x100]);
  });

  test("a range inside one descriptor is not cut", () => {
    const plan = planChunks(
      "gb",
      [{ domain: "wram", offset: 0x1000, length: 0x200 }],
      [true],
    );
    expect(plan.chunks).toEqual([{ address: 0xd000, length: 0x200 }]);
  });

  test("an invalid range makes no chunk, and equal chunks share a datagram", () => {
    const plan = planChunks(
      "gba",
      [
        { domain: "ewram", offset: 0, length: 4 },
        { domain: "ewram", offset: 0, length: 4 },
        { domain: "iwram", offset: 0, length: 4 },
      ],
      [true, true, false],
    );
    expect(plan.chunks).toHaveLength(1);
    expect(plan.pieces[2]).toBeNull();
  });
});
