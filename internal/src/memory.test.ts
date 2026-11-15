import { describe, expect, test } from "bun:test";
import { mapPointerValue, parseAddress, parseProfileAddress } from "./memory";

describe("GBA map", () => {
  test("maps the canonical ranges", () => {
    expect(parseAddress("gba", "0x020244EC")).toEqual({
      ok: true,
      value: { domain: "ewram", offset: 0x244ec },
    });
    expect(parseAddress("gba", "0x03005d8c")).toEqual({
      ok: true,
      value: { domain: "iwram", offset: 0x5d8c },
    });
    expect(parseAddress("gba", "0x08000144")).toEqual({
      ok: true,
      value: { domain: "rom", offset: 0x144 },
    });
  });

  test("rejects mirrors, gaps and malformed text", () => {
    for (const text of [
      "0x02040000",
      "0x0A000000",
      "0x04000000",
      "02000000",
      "0x",
      "0xZZ",
    ]) {
      expect(parseAddress("gba", text).ok).toBe(false);
    }
  });
});

describe("GB map", () => {
  test("maps banked ROM, SRAM, WRAM and HRAM", () => {
    expect(parseAddress("gb", "01:4000")).toEqual({
      ok: true,
      value: { domain: "rom", offset: 0x4000 },
    });
    expect(parseAddress("gb", "7f:7fff")).toEqual({
      ok: true,
      value: { domain: "rom", offset: 0x7f * 0x4000 + 0x3fff },
    });
    expect(parseAddress("gb", "02:a000")).toEqual({
      ok: true,
      value: { domain: "sram", offset: 0x4000 },
    });
    expect(parseAddress("gb", "00:d163")).toEqual({
      ok: true,
      value: { domain: "wram", offset: 0x1163 },
    });
    expect(parseAddress("gb", "01:dcd7")).toEqual({
      ok: true,
      value: { domain: "wram", offset: 0x1cd7 },
    });
    expect(parseAddress("gb", "00:ff80")).toEqual({
      ok: true,
      value: { domain: "hram", offset: 0 },
    });
  });

  test("rejects bare addresses, bad banks and unmapped areas", () => {
    for (const text of [
      "dcd7",
      "00:4000",
      "01:0000",
      "00:8000",
      "08:d000",
      "01:c000",
      "00:fe00",
      "00:ffff",
    ]) {
      expect(parseAddress("gb", text).ok).toBe(false);
    }
  });
});

describe("pointer entries", () => {
  test("GBA entry maps the pointer address and keeps the offset", () => {
    expect(
      parseProfileAddress("gba", { ptr: "0x03005D8C", offset: "0x0" }),
    ).toEqual({
      ok: true,
      value: {
        at: { domain: "iwram", offset: 0x5d8c },
        width: 4,
        bank: null,
        offset: 0,
      },
    });
  });

  test("bank is required on GB and rejected on GBA", () => {
    expect(
      parseProfileAddress("gb", { ptr: "00:d000", offset: "0x4" }).ok,
    ).toBe(false);
    expect(
      parseProfileAddress("gb", { ptr: "00:d000", offset: "0x4", bank: "01" }),
    ).toEqual({
      ok: true,
      value: {
        at: { domain: "wram", offset: 0x1000 },
        width: 2,
        bank: 1,
        offset: 4,
      },
    });
    expect(
      parseProfileAddress("gba", {
        ptr: "0x03005D8C",
        offset: "0x0",
        bank: "01",
      }).ok,
    ).toBe(false);
  });

  test("a bad offset fails", () => {
    expect(
      parseProfileAddress("gba", { ptr: "0x03005D8C", offset: "4" }).ok,
    ).toBe(false);
  });
});

describe("pointer values", () => {
  test("0 is null before mapping", () => {
    expect(mapPointerValue("gba", 0, null)).toBeNull();
    expect(mapPointerValue("gb", 0, 0)).toBeNull();
  });

  test("maps through the same table and rejects the unmapped", () => {
    expect(mapPointerValue("gba", 0x02025734, null)).toEqual({
      domain: "ewram",
      offset: 0x25734,
    });
    expect(mapPointerValue("gba", 0xdeadbeef, null)).toBeNull();
    expect(mapPointerValue("gb", 0xd000, 1)).toEqual({
      domain: "wram",
      offset: 0x1000,
    });
    expect(mapPointerValue("gb", 0xd000, null)).toBeNull();
  });
});
