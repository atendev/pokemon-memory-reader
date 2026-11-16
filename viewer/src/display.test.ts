import { describe, expect, test } from "bun:test";
import {
  cardTitle,
  connectionLabel,
  hpPercent,
  hpTone,
  orDash,
  partySlots,
  refName,
} from "./display";
import { mon, status } from "./testing";

describe("names", () => {
  test("a nickname wins, then the species name, then #id", () => {
    expect(cardTitle(mon({ nickname: "LEAFY" }))).toBe("LEAFY");
    expect(cardTitle(mon())).toBe("Treecko");
    expect(
      cardTitle(mon({ species: { id: 411, dex: null, name: null } })),
    ).toBe("#411");
  });

  test("an egg shows as Egg whatever its nickname", () => {
    expect(cardTitle(mon({ isEgg: true, nickname: "EGG" }))).toBe("Egg");
  });

  test("a reference with no name falls back to #id", () => {
    expect(refName({ id: 13, name: null })).toBe("#13");
    expect(refName({ id: 13, name: "Pecha Berry" })).toBe("Pecha Berry");
  });

  test("a null value shows a dash", () => {
    expect(orDash(null)).toBe("—");
    expect(orDash(0)).toBe("0");
  });
});

describe("party slots", () => {
  test("pad to six and keep the order", () => {
    const first = mon({ nickname: "A" });
    const slots = partySlots([first]);
    expect(slots).toHaveLength(6);
    expect(slots[0]).toBe(first);
    expect(slots.slice(1)).toEqual([null, null, null, null, null]);
  });
});

describe("hp", () => {
  test.each([
    [20, 20, "high"],
    [11, 20, "high"],
    [10, 20, "mid"],
    [5, 20, "mid"],
    [4, 20, "low"],
    [0, 20, "none"],
  ] as const)("%i of %i is %s", (hp, maxHp, tone) => {
    expect(hpTone(mon({ hp, maxHp }))).toBe(tone);
  });

  test("an unknown HP is grey and has no percentage", () => {
    expect(hpTone(mon({ hp: null, maxHp: null }))).toBe("none");
    expect(hpPercent(mon({ hp: null, maxHp: null }))).toBeNull();
    expect(hpPercent(mon({ hp: 5, maxHp: 0 }))).toBeNull();
  });

  test("the percentage stays between 0 and 100", () => {
    expect(hpPercent(mon({ hp: 30, maxHp: 20 }))).toBe(100);
    expect(hpPercent(mon({ hp: 10, maxHp: 20 }))).toBe(50);
  });
});

describe("connection label", () => {
  test("covers every state and an unreachable program", () => {
    expect(connectionLabel(null)).toBe("Cannot reach the program");
    expect(connectionLabel(status("disconnected"))).toBe(
      "Waiting for an emulator",
    );
    expect(connectionLabel(status("no_game"))).toBe(
      "Emulator connected, no game loaded",
    );
    expect(connectionLabel(status("unidentified"))).toBe("Game not recognised");
    expect(connectionLabel(status("game"))).toBe("Connected");
  });
});
