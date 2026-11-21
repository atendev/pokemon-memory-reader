import { describe, expect, test } from "bun:test";
import {
  fieldBadges,
  lastBattleSummary,
  partyOf,
  pokemonLeft,
  readShowUnrevealed,
  SHOW_UNREVEALED_KEY,
  showUnrevealedOverride,
  trainerTitle,
  writeShowUnrevealed,
} from "./battle";
import { activeBattle, opponentMon, trainer } from "./testing";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("the saved unrevealed setting", () => {
  test("is off with nothing saved, no storage or an unknown value", () => {
    expect(readShowUnrevealed(fakeStorage())).toBe(false);
    expect(readShowUnrevealed(null)).toBe(false);
    expect(
      readShowUnrevealed(fakeStorage({ [SHOW_UNREVEALED_KEY]: "yes" })),
    ).toBe(false);
  });

  test("round-trips on and off", () => {
    const storage = fakeStorage();
    writeShowUnrevealed(storage, true);
    expect(readShowUnrevealed(storage)).toBe(true);
    writeShowUnrevealed(storage, false);
    expect(readShowUnrevealed(storage)).toBe(false);
  });

  test("a storage that throws doesn't break reading or writing", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readShowUnrevealed(broken)).toBe(false);
    expect(() => writeShowUnrevealed(broken, true)).not.toThrow();
  });
});

describe("the one-load override", () => {
  test("=1 and =0 come from the page query", () => {
    expect(showUnrevealedOverride("?showUnrevealed=1", "")).toBe(true);
    expect(showUnrevealedOverride("?showUnrevealed=0", "#/battle")).toBe(false);
  });

  test("they also come from the hash route's query, for OBS source URLs", () => {
    expect(showUnrevealedOverride("", "#/battle?showUnrevealed=1")).toBe(true);
    expect(showUnrevealedOverride("", "#/battle?showUnrevealed=0")).toBe(false);
  });

  test("any other value or none is no override", () => {
    expect(showUnrevealedOverride("", "")).toBeNull();
    expect(showUnrevealedOverride("?showUnrevealed=true", "")).toBeNull();
    expect(showUnrevealedOverride("?x=1", "#/battle")).toBeNull();
  });
});

describe("trainer titles", () => {
  test("a name wins, then the class name, then Trainer", () => {
    expect(
      trainerTitle(trainer({ name: "JOEY", className: "YOUNGSTER" })),
    ).toBe("JOEY");
    expect(trainerTitle(trainer({ className: "YOUNGSTER" }))).toBe("YOUNGSTER");
    expect(trainerTitle(trainer())).toBe("Trainer");
  });
});

describe("Pokémon left", () => {
  test("counts mons with HP above 0, revealed or not", () => {
    const party = [
      opponentMon({ partySlot: 0, hp: 10, revealed: true }),
      opponentMon({ partySlot: 1, hp: 0, revealed: true }),
      opponentMon({ partySlot: 2, hp: 30, revealed: false }),
      opponentMon({ partySlot: 3, hp: 0, revealed: false }),
    ];
    expect(pokemonLeft(party)).toBe(2);
  });

  test("a mon with unknown HP counts as still in the fight", () => {
    expect(pokemonLeft([opponentMon({ hp: null })])).toBe(1);
  });

  test("splits by trainer index in a multi-trainer battle", () => {
    const trainers = [trainer({ id: 1 }), trainer({ id: 2 })];
    const party = [
      opponentMon({ partySlot: 0, trainer: 0, hp: 5 }),
      opponentMon({ partySlot: 1, trainer: 0, hp: 0 }),
      opponentMon({ partySlot: 2, trainer: 1, hp: 5 }),
      opponentMon({ partySlot: 3, trainer: 1, hp: 5 }),
    ];
    expect(pokemonLeft(partyOf(party, trainers, 0))).toBe(1);
    expect(pokemonLeft(partyOf(party, trainers, 1))).toBe(2);
  });

  test("mons with no trainer index belong to the only trainer", () => {
    const party = [
      opponentMon({ partySlot: 0, trainer: null, hp: 5 }),
      opponentMon({ partySlot: 1, trainer: null, hp: 5 }),
    ];
    expect(partyOf(party, [trainer()], 0)).toHaveLength(2);
    expect(partyOf(party, [trainer(), trainer({ id: 2 })], 0)).toHaveLength(0);
  });
});

describe("field badges", () => {
  const field = activeBattle().field;

  test("none, null, false and 0 are all hidden", () => {
    const badges = fieldBadges({
      ...field,
      weather: "none",
      terrain: "none",
      sides: {
        player: { ...field.sides.player, reflect: false, spikes: 0 },
        opponent: field.sides.opponent,
      },
    });
    expect([...badges.shared, ...badges.player, ...badges.opponent]).toEqual(
      [],
    );
  });

  test("active effects show, per side where they belong to one", () => {
    const badges = fieldBadges({
      ...field,
      weather: "rain",
      terrain: "grassy",
      sides: {
        player: { ...field.sides.player, reflect: true },
        opponent: { ...field.sides.opponent, spikes: 2, mist: true },
      },
    });
    expect(badges.shared.map((b) => b.label)).toEqual([
      "Rain",
      "Grassy Terrain",
    ]);
    expect(badges.player.map((b) => b.label)).toEqual(["Reflect"]);
    expect(badges.opponent.map((b) => b.label)).toEqual(["Mist", "Spikes ×2"]);
  });
});

describe("the last battle summary", () => {
  const base = {
    battleId: 3,
    outcome: "won" as const,
    endedAt: "2026-11-21T10:00:00.000Z",
    kind: "trainer" as const,
    format: "single" as const,
    modes: [],
    trainers: [trainer({ name: "JOEY" })],
    opponentParty: [],
  };

  test("names the outcome, the trainers and the format", () => {
    expect(lastBattleSummary(base)).toBe("Won · JOEY · single");
  });

  test("a wild battle says so, and a trainer battle with no entry stays generic", () => {
    expect(
      lastBattleSummary({
        ...base,
        kind: "wild",
        outcome: "caught",
        trainers: [],
      }),
    ).toBe("Caught · wild encounter · single");
    expect(lastBattleSummary({ ...base, trainers: [], outcome: "lost" })).toBe(
      "Lost · trainer battle · single",
    );
  });
});
