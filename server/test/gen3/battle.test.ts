import { describe, expect, test } from "bun:test";
import type { BattleOutcome } from "@pokemon-memory-reader/api/types";
import { Bytes } from "../../src/format/bytes";
import { gen3Battle, gen3Outcome } from "../../src/format/gen3/battle";
import type { Regions, Slices } from "../../src/format/regions";
import type { BattleProbe, DecodeContext } from "../../src/format/types";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import type { Profile } from "../../src/profile/schema";
import { referenceData } from "../../src/reference";
import type { BattleTick } from "../../src/resource/battle-tracker";
import { emeraldMemory, serve, TREECKO } from "../support/emerald-memory";
import {
  type BattleMonSpec,
  type BattleScene,
  endBattle,
  writeBattle,
} from "./battle-encode";

const loaded = loadProfiles({ builtin: [emerald], user: [] });
const profile = loaded.registry.get("emerald-us-1.0");
if (profile?.dataFormat !== "gen3") throw new Error("Emerald profile missing");
const reference = referenceData("gen3", "en");
if (!reference) throw new Error("Gen 3 English reference data missing");

const ctx: DecodeContext<Profile<"gen3">> = {
  profile,
  ...reference,
  names: { ...reference.names, locations: reference.locations("emerald") },
};

const TACKLE = 33;
const EMBER = 52;
const POOCHYENA = 261;
const ZIGZAGOON = 263;
const DOUBLE = 1 << 0;
const TRAINER = 1 << 3;
const MULTI = 1 << 6;
const IN_GAME_PARTNER = 1 << 22;

/** Reads each region of a decoder part out of synthetic memory, as the read loop would. */
function slicesOf<R extends Regions>(
  memory: ReturnType<typeof emeraldMemory>,
  regions: R,
): Slices<R> {
  const slices: Record<string, Bytes> = {};
  for (const [name, region] of Object.entries(regions)) {
    if (region.kind !== "static") throw new Error("battle regions are static");
    slices[name] = new Bytes(
      serve(memory, [{ ...region.at, length: region.length }]),
    );
  }
  return slices as Slices<R>;
}

const frameOf = (memory: ReturnType<typeof emeraldMemory>) =>
  gen3Battle.frame.decode(
    slicesOf(memory, gen3Battle.frame.regions(profile)),
    ctx,
  );
const probeOf = (memory: ReturnType<typeof emeraldMemory>) =>
  gen3Battle.probe.decode(
    slicesOf(memory, gen3Battle.probe.regions(profile)),
    ctx,
  );

function setFrame(tick: ReturnType<typeof frameOf>) {
  if (!tick.ok) throw new Error(tick.reason);
  const value: BattleTick = tick.value;
  if (value.flag !== "set") throw new Error(`flag ${value.flag}`);
  if (!value.frame.ok) throw new Error(value.frame.reason);
  return value.frame.value;
}

const player: BattleMonSpec = {
  species: 277,
  level: 5,
  hp: 19,
  maxHp: 20,
  stats: { atk: 11, def: 12, spe: 13, spa: 14, spd: 15 },
  moves: [TACKLE, EMBER],
  pp: [30, 12],
  ppBonuses: 0b0100,
  stages: { atk: 8, spe: 3, acc: 12, eva: 0 },
  ability: 65,
  types: [12, 12],
  item: 13,
};
const wild: BattleMonSpec = {
  species: POOCHYENA,
  level: 3,
  hp: 12,
  maxHp: 12,
  moves: [TACKLE],
  pp: [35],
  types: [17, 17],
};

const wildMon = { ...TREECKO, species: POOCHYENA, level: 3, nickname: "" };
const scene = (overrides: Partial<BattleScene> = {}): BattleScene => ({
  typeFlags: 0,
  battlers: [player, wild],
  partyIndexes: [0, 0],
  enemyParty: [wildMon],
  ...overrides,
});

const inBattle = (overrides: Partial<BattleScene> = {}) => {
  const memory = emeraldMemory([TREECKO]);
  writeBattle(memory, scene(overrides));
  return memory;
};

describe("gen3Outcome", () => {
  test.each([
    [1, "won"],
    [2, "lost"],
    [3, "drew"],
    [4, "ran"],
    [5, "ran"],
    [7, "caught"],
    [9, "forfeited"],
  ] as const)("B_OUTCOME %i is %s", (raw, outcome) => {
    expect(gen3Outcome(raw)).toBe(outcome);
  });

  test.each([0, 6, 8, 10, 0x7f])("%i is unknown", (raw) => {
    expect(gen3Outcome(raw)).toBe("unknown");
  });

  test("every raw byte maps through the 0x7f mask", () => {
    const named: Record<number, BattleOutcome> = {
      1: "won",
      2: "lost",
      3: "drew",
      4: "ran",
      5: "ran",
      7: "caught",
      9: "forfeited",
    };
    for (let raw = 0; raw < 256; raw++) {
      expect(gen3Outcome(raw)).toBe(named[raw & 0x7f] ?? "unknown");
    }
  });

  test("the mask drops the high bit", () => {
    expect(gen3Outcome(0x80 | 7)).toBe("caught");
    expect(gen3Outcome(0x80)).toBe("unknown");
  });
});

describe("the in-battle flag", () => {
  test("clear outside a battle, with the outcome byte read beside it", () => {
    const memory = emeraldMemory([TREECKO]);
    expect(probeOf(memory)).toEqual({
      ok: true,
      value: { flag: "clear", outcome: "unknown" },
    });
    endBattle(memory, 1);
    expect(probeOf(memory)).toEqual({
      ok: true,
      value: { flag: "clear", outcome: "won" },
    });
  });

  test("set reads only the flag in the probe, and the frame in the frame read", () => {
    const memory = inBattle();
    expect(probeOf(memory)).toEqual({
      ok: true,
      value: { flag: "set" } satisfies BattleProbe,
    });
    expect(frameOf(memory)).toMatchObject({
      ok: true,
      value: { flag: "set" },
    });
  });

  test("only bit 1 of the byte counts", () => {
    const memory = emeraldMemory([TREECKO]);
    memory.iwram[0x22c0 + 0x439] = 0xfd;
    expect(probeOf(memory)).toMatchObject({ value: { flag: "clear" } });
  });

  test("the frame read with the flag clear gives the outcome and no frame", () => {
    const memory = inBattle();
    endBattle(memory, 2);
    expect(frameOf(memory)).toEqual({
      ok: true,
      value: { flag: "clear", outcome: "lost" },
    });
  });

  test("the profile reads the flag from gMain plus 0x439", () => {
    const { flag } = gen3Battle.probe.regions(profile);
    expect(flag).toMatchObject({
      kind: "static",
      at: { domain: "iwram", offset: 0x22c0 + 0x439 },
      length: 1,
    });
  });
});

describe("a single wild battle", () => {
  const frame = setFrame(frameOf(inBattle()));

  test("is a wild single with no tracked fields yet", () => {
    expect(frame.kind).toBe("wild");
    expect(frame.format).toBe("single");
    expect(frame.modes).toEqual([]);
    expect(frame.turn).toBeNull();
    expect(frame.player.partner).toBeNull();
    expect(frame.opponent.trainers).toEqual([]);
  });

  test("decodes the player's battler", () => {
    expect(frame.player.active).toHaveLength(1);
    const [mon] = frame.player.active;
    expect(mon).toMatchObject({
      position: 0,
      owner: "player",
      partySlot: 0,
      species: { id: 277 },
      level: 5,
      hp: 19,
      maxHp: 20,
      status: "none",
      stats: { hp: 20, atk: 11, def: 12, spe: 13, spa: 14, spd: 15 },
    });
    expect(mon?.types).toEqual(["grass"]);
    expect(mon?.ability?.id).toBe(65);
    expect(mon?.heldItem?.id).toBe(13);
  });

  test("normalises stat stages to -6 to +6", () => {
    expect(frame.player.active[0]?.statStages).toEqual({
      atk: 2,
      def: 0,
      spa: 0,
      spd: 0,
      spe: -3,
      acc: 6,
      eva: -6,
    });
  });

  test("moves carry PP, and max PP from the PP Up bonuses", () => {
    const moves = frame.player.active[0]?.moves;
    expect(moves?.map((m) => [m.id, m.pp, m.maxPp])).toEqual([
      [TACKLE, 30, 35],
      [EMBER, 12, 30],
    ]);
  });

  test("lists only the wild mon on the field as the opponent party", () => {
    expect(frame.opponent.active).toHaveLength(1);
    expect(frame.opponent.active[0]).toMatchObject({
      position: 1,
      owner: "opponent",
      partySlot: 0,
      species: { id: POOCHYENA },
    });
    expect(frame.opponent.party.map((m) => m.partySlot)).toEqual([0]);
    expect(frame.opponent.party[0]?.species.id).toBe(POOCHYENA);
  });

  test("a wild party of several lists only the active one", () => {
    const memory = inBattle({
      partyIndexes: [0, 1],
      enemyParty: [wildMon, { ...wildMon, species: ZIGZAGOON }],
    });
    const { opponent } = setFrame(frameOf(memory));
    expect(opponent.party.map((m) => m.partySlot)).toEqual([1]);
    expect(opponent.party[0]?.species.id).toBe(ZIGZAGOON);
  });

  test("an empty slot in gBattleMons is skipped", () => {
    const memory = inBattle({ battlers: [undefined, wild] });
    expect(setFrame(frameOf(memory)).player.active).toEqual([]);
  });
});

describe("a double trainer battle", () => {
  const second: BattleMonSpec = { ...wild, species: ZIGZAGOON };
  const ally: BattleMonSpec = { ...player, species: 280 };
  const doubleScene = (overrides: Partial<BattleScene> = {}) =>
    scene({
      typeFlags: TRAINER | DOUBLE,
      battlers: [player, wild, ally, second],
      partyIndexes: [0, 0, 1, 1],
      enemyParty: [wildMon, { ...wildMon, species: ZIGZAGOON }, wildMon],
      ...overrides,
    });
  const build = (overrides: Partial<BattleScene> = {}) => {
    const memory = emeraldMemory([TREECKO, TREECKO]);
    writeBattle(memory, doubleScene(overrides));
    return setFrame(frameOf(memory));
  };

  test("reads two battlers a side, and the whole opponent party", () => {
    const frame = build();
    expect(frame.kind).toBe("trainer");
    expect(frame.format).toBe("double");
    expect(
      frame.player.active.map((b) => [b.position, b.owner, b.partySlot]),
    ).toEqual([
      [0, "player", 0],
      [2, "player", 1],
    ]);
    expect(frame.opponent.active.map((b) => [b.position, b.partySlot])).toEqual(
      [
        [1, 0],
        [3, 1],
      ],
    );
    expect(frame.opponent.party.map((m) => m.partySlot)).toEqual([0, 1, 2]);
  });

  test("a partner's mon is owned by the partner with a null party slot", () => {
    for (const flag of [MULTI, IN_GAME_PARTNER]) {
      const frame = build({ typeFlags: TRAINER | DOUBLE | flag });
      expect(frame.player.active.map((b) => [b.owner, b.partySlot])).toEqual([
        ["player", 0],
        ["partner", null],
      ]);
    }
  });

  test("the two-opponents flag also makes a double", () => {
    const frame = build({ typeFlags: TRAINER | (1 << 15) });
    expect(frame.format).toBe("double");
  });
});

describe("the field", () => {
  const field = (overrides: Partial<BattleScene>) =>
    setFrame(frameOf(inBattle(overrides))).field;

  test.each([
    [0, "none"],
    [0x01, "rain"],
    [0x04, "rain"],
    [0x08, "sandstorm"],
    [0x10, "sandstorm"],
    [0x20, "sun"],
    [0x40, "sun"],
    [0x80, "hail"],
  ] as const)("gBattleWeather %i is %s", (weather, expected) => {
    expect(field({ weather }).weather).toBe(expected);
  });

  test("has no terrain", () => {
    expect(field({}).terrain).toBeNull();
  });

  test("reads each side's screens and spikes", () => {
    const sides = field({
      sideStatuses: [0x1 | 0x20, 0x2 | 0x10 | 0x100],
      spikes: [3, 2],
    }).sides;
    expect(sides.player).toEqual({
      reflect: true,
      lightScreen: false,
      safeguard: true,
      mist: false,
      spikes: 0,
    });
    expect(sides.opponent).toEqual({
      reflect: false,
      lightScreen: true,
      safeguard: false,
      mist: true,
      spikes: 2,
    });
  });

  test("a spikes count with no spikes status reads 0", () => {
    expect(field({ spikes: [0, 3] }).sides.opponent.spikes).toBe(0);
  });
});

describe("battler types", () => {
  test("a dual type reads both, and the struct's types win over the species table", () => {
    const memory = inBattle({
      battlers: [{ ...player, types: [3, 12] }, wild],
    });
    expect(setFrame(frameOf(memory)).player.active[0]?.types).toEqual([
      "poison",
      "grass",
    ]);
  });
});

describe("battler status", () => {
  test("decodes a status condition from status1", () => {
    const memory = inBattle({ battlers: [{ ...player, status1: 0x10 }, wild] });
    expect(setFrame(frameOf(memory)).player.active[0]?.status).toBe("burn");
  });
});

describe("validation", () => {
  const failure = (memory: ReturnType<typeof emeraldMemory>) => {
    const tick = frameOf(memory);
    if (!tick.ok || tick.value.flag !== "set") throw new Error("expected set");
    return tick.value.frame;
  };

  test("an opponent party count of 0 or over 6 fails the frame", () => {
    for (const count of [0, 7]) {
      const memory = inBattle();
      memory.ewram[0x244ea] = count;
      expect(failure(memory)).toMatchObject({ ok: false });
    }
  });

  test("an opponent active species of 0 fails the frame", () => {
    const memory = inBattle({ battlers: [player, { ...wild, species: 0 }] });
    expect(failure(memory)).toMatchObject({
      ok: false,
      reason: "opponent active species is 0",
    });
  });

  test("a corrupt opponent party mon fails the frame, naming the slot", () => {
    const memory = inBattle();
    memory.ewram[0x24744 + 0x1c] = ~(memory.ewram[0x24744 + 0x1c] ?? 0) & 0xff;
    const result = failure(memory);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("slot 0");
  });
});
