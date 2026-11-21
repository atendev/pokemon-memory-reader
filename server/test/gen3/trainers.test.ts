import { describe, expect, test } from "bun:test";
import { Bytes } from "../../src/format/bytes";
import { gen3Trainers, prizeMoney } from "../../src/format/gen3/trainers";
import type { Regions } from "../../src/format/regions";
import type { BattleExtras, DecodeContext } from "../../src/format/types";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import type { Profile } from "../../src/profile/schema";
import { referenceData } from "../../src/reference";
import type { BattleFrame } from "../../src/resource/battle-tracker";
import {
  battler,
  opponentMon,
  trainer,
  trainerFrame,
} from "../support/battle-frames";
import { emeraldMemory, serve } from "../support/emerald-memory";
import { encodeText } from "./encode";

const loaded = loadProfiles({ builtin: [emerald], user: [] });
const stock = loaded.registry.get("emerald-us-1.0");
if (stock?.dataFormat !== "gen3") throw new Error("Emerald profile missing");
const reference = referenceData("gen3", "en");
if (!reference) throw new Error("Gen 3 English reference data missing");

const TRAINERS_AT = 0x400;
const CLASSES_AT = 0x600;
const MONEY_AT = 0x700;
const TRAINER_COUNT = 4;
const CLASS_COUNT = 3;
const MONEY_COUNT = 3;
const POTION = 13;

const rom = (offset: number) => ({ domain: "rom" as const, offset });
const tables: Profile<"gen3">["trainerTables"] = {
  trainers: { base: rom(TRAINERS_AT), count: TRAINER_COUNT },
  classNames: { base: rom(CLASSES_AT), count: CLASS_COUNT },
  money: { base: rom(MONEY_AT), count: MONEY_COUNT },
};

const profileWith = (
  trainerTables: Profile<"gen3">["trainerTables"],
): Profile<"gen3"> => ({ ...stock, trainerTables });
const ctxOf = (profile: Profile<"gen3">): DecodeContext<Profile<"gen3">> => ({
  profile,
  ...reference,
  names: {
    ...reference.names,
    items: reference.items("emerald"),
    locations: reference.locations("emerald"),
  },
});

/** One `struct Trainer`: class at +1, name at +4, items at +0x10. */
function trainerEntry(classId: number, name: string, items: number[]) {
  const entry = new Uint8Array(40);
  entry[1] = classId;
  entry.set(encodeText(name, 12), 4);
  items.forEach((item, slot) => {
    entry[0x10 + slot * 2] = item & 0xff;
    entry[0x11 + slot * 2] = item >> 8;
  });
  return entry;
}

/** Synthetic ROM: trainer 0 empty, 1 and 2 filled, 3 has class 2 (not in the money table). */
function syntheticRom(): Record<"rom", Uint8Array> {
  const { rom: bytes } = emeraldMemory([]);
  const big = new Uint8Array(0x1000);
  big.set(bytes);
  big.set(trainerEntry(1, "ROXANNE", [POTION, 0, 0x0e, 0]), TRAINERS_AT + 40);
  big.set(trainerEntry(0, "JOEY", []), TRAINERS_AT + 80);
  big.set(trainerEntry(2, "MISSY", [POTION]), TRAINERS_AT + 120);
  [
    ["YOUNGSTER", 0],
    ["LEADER", 1],
    ["BEAUTY", 2],
  ].forEach(([name, index]) => {
    big.set(encodeText(String(name), 13), CLASSES_AT + Number(index) * 13);
  });
  // Money table: class 0 pays 4, class 1 pays 25, then the 0xff terminator pays 5.
  big.set([0, 4, 1, 25, 0xff, 5], MONEY_AT);
  return { rom: big };
}

/** Reads the regions `rom()` asks for out of the synthetic ROM, as the loop does. */
function readRom(
  profile: Profile<"gen3">,
  frame: BattleFrame,
  memory = syntheticRom(),
): Record<string, Bytes> {
  const regions: Regions = gen3Trainers.rom(profile, frame);
  const out: Record<string, Bytes> = {};
  for (const [name, region] of Object.entries(regions)) {
    if (region.kind !== "static") throw new Error("ROM regions are static");
    out[name] = new Bytes(
      serve({ ...emeraldMemory([]), ...memory }, [
        { ...region.at, length: region.length },
      ]),
    );
  }
  return out;
}

const extras: BattleExtras = { moneyMultiplier: 1 };

function filled(
  frame: BattleFrame,
  options: {
    profile?: Profile<"gen3">;
    extras?: BattleExtras | null;
    rom?: Record<string, Bytes>;
  } = {},
): BattleFrame {
  const profile = options.profile ?? profileWith(tables);
  return gen3Trainers.fill(
    frame,
    ctxOf(profile),
    options.rom ?? readRom(profile, frame),
    options.extras === undefined ? extras : options.extras,
  );
}

const single = (id: number, level = 20): BattleFrame =>
  trainerFrame({
    opponent: {
      active: [battler("opponent", 0)],
      party: [
        opponentMon(0, { trainer: 0, level: level - 2 }),
        opponentMon(1, { trainer: 0, level }),
      ],
      trainers: [{ ...trainer, id }],
    },
  });

const onlyTrainer = (frame: BattleFrame) => {
  const [first] = frame.opponent.trainers;
  if (!first) throw new Error("no trainer");
  return first;
};

describe("prizeMoney", () => {
  test("is 4 × level × multiplier × value", () => {
    expect(
      prizeMoney({
        lastMonLevel: 20,
        moneyMultiplier: 1,
        value: 25,
        doubled: false,
      }),
    ).toBe(2000);
    expect(
      prizeMoney({
        lastMonLevel: 20,
        moneyMultiplier: 2,
        value: 25,
        doubled: false,
      }),
    ).toBe(4000);
  });

  test("doubles for a double battle", () => {
    expect(
      prizeMoney({
        lastMonLevel: 20,
        moneyMultiplier: 1,
        value: 25,
        doubled: true,
      }),
    ).toBe(4000);
  });
});

describe("Gen 3 trainer fill", () => {
  test("decodes class, name, items and prize money from the ROM tables", () => {
    const result = onlyTrainer(filled(single(1)));
    expect(result).toMatchObject({
      id: 1,
      classId: 1,
      className: "LEADER",
      name: "ROXANNE",
      // Last mon is level 20: 4 × 20 × 1 × 25.
      prizeMoney: 2000,
    });
    expect(result.items?.map((item) => item.id)).toEqual([POTION, 0x0e]);
    expect(result.items?.[0]?.name).not.toBeNull();
  });

  test("a trainer with no starting items has an empty list", () => {
    expect(onlyTrainer(filled(single(2))).items).toEqual([]);
  });

  test("the last mon is the highest party slot, whatever the list order", () => {
    const frame = trainerFrame({
      opponent: {
        active: [battler("opponent", 0)],
        party: [
          opponentMon(2, { trainer: 0, level: 30 }),
          opponentMon(0, { trainer: 0, level: 10 }),
        ],
        trainers: [{ ...trainer, id: 1 }],
      },
    });
    expect(onlyTrainer(filled(frame)).prizeMoney).toBe(4 * 30 * 25);
  });

  test("a class missing from the money table falls back to the terminator's value", () => {
    const result = onlyTrainer(filled(single(3)));
    expect(result.classId).toBe(2);
    expect(result.className).toBe("BEAUTY");
    expect(result.prizeMoney).toBe(4 * 20 * 5);
  });

  test("the multiplier scales the prize", () => {
    expect(
      onlyTrainer(filled(single(1), { extras: { moneyMultiplier: 2 } }))
        .prizeMoney,
    ).toBe(4 * 20 * 2 * 25);
  });

  test("a single trainer in a double battle is doubled", () => {
    const frame = { ...single(1), format: "double" as const };
    expect(onlyTrainer(filled(frame)).prizeMoney).toBe(2 * 4 * 20 * 25);
  });

  test("a two-opponent battle pays each trainer its own amount, undoubled", () => {
    const frame: BattleFrame = trainerFrame({
      format: "double",
      opponent: {
        active: [battler("opponent", 0), battler("opponent", 1)],
        party: [
          opponentMon(0, { trainer: 0, level: 10 }),
          opponentMon(1, { trainer: 0, level: 12 }),
          opponentMon(3, { trainer: 1, level: 20 }),
          opponentMon(4, { trainer: 1, level: 22 }),
          opponentMon(5, { trainer: 1, level: 25 }),
        ],
        trainers: [
          { ...trainer, id: 1 },
          { ...trainer, id: 2 },
        ],
      },
    });
    const [a, b] = filled(frame).opponent.trainers;
    expect(a).toMatchObject({ name: "ROXANNE", prizeMoney: 4 * 12 * 25 });
    // Trainer 2 is class 0, which pays 4.
    expect(b).toMatchObject({ name: "JOEY", prizeMoney: 4 * 25 * 4 });
  });

  test("a missing gBattleStruct read nulls only the money", () => {
    const result = onlyTrainer(filled(single(1), { extras: null }));
    expect(result).toMatchObject({ name: "ROXANNE", className: "LEADER" });
    expect(result.prizeMoney).toBeNull();
  });

  test("a trainer with no mon in the party has no money", () => {
    const frame = trainerFrame({
      opponent: {
        active: [],
        party: [],
        trainers: [{ ...trainer, id: 1 }],
      },
    });
    const result = onlyTrainer(filled(frame));
    expect(result.name).toBe("ROXANNE");
    expect(result.prizeMoney).toBeNull();
  });
});

describe("a missing table", () => {
  const without = (...omit: (keyof typeof tables)[]) => {
    const kept = { ...tables };
    for (const key of omit) delete kept[key];
    return profileWith(kept);
  };

  test("no trainers table nulls everything that comes from the entry", () => {
    const result = onlyTrainer(
      filled(single(1), { profile: without("trainers") }),
    );
    expect(result).toEqual({
      id: 1,
      classId: null,
      className: null,
      name: null,
      prizeMoney: null,
      items: null,
    });
  });

  test("no class names table nulls only the class name", () => {
    const result = onlyTrainer(
      filled(single(1), { profile: without("classNames") }),
    );
    expect(result).toMatchObject({
      classId: 1,
      className: null,
      name: "ROXANNE",
      prizeMoney: 2000,
    });
  });

  test("no money table nulls only the prize money", () => {
    const result = onlyTrainer(
      filled(single(1), { profile: without("money") }),
    );
    expect(result).toMatchObject({
      classId: 1,
      className: "LEADER",
      name: "ROXANNE",
      prizeMoney: null,
    });
    expect(result.items).not.toBeNull();
  });

  test("a trainer ID at or past the table's count is not read", () => {
    const profile = profileWith(tables);
    const frame = single(TRAINER_COUNT);
    expect(Object.keys(gen3Trainers.rom(profile, frame))).not.toContain(
      `trainer:${TRAINER_COUNT}`,
    );
    expect(onlyTrainer(filled(frame))).toEqual({
      ...onlyTrainer(frame),
      classId: null,
      className: null,
      name: null,
      prizeMoney: null,
      items: null,
    });
  });

  test("a region that failed to read nulls only its own fields", () => {
    const frame = single(1);
    const profile = profileWith(tables);
    const { money: _money, ...read } = readRom(profile, frame);
    const result = onlyTrainer(filled(frame, { rom: read }));
    expect(result).toMatchObject({ name: "ROXANNE", className: "LEADER" });
    expect(result.prizeMoney).toBeNull();
  });

  test("the stock profile's tables sit beyond the fixture ROM, so fixtures read them as missing", () => {
    const frame = single(1);
    // The fixture ROM is 0x400 bytes. A read past it returns nothing, and the loop passes no region.
    const result = onlyTrainer(filled(frame, { profile: stock, rom: {} }));
    expect(result).toEqual({
      id: 1,
      classId: null,
      className: null,
      name: null,
      prizeMoney: null,
      items: null,
    });
  });
});

describe("table-derived fields on a battle with no table", () => {
  test.each([
    ["link", 1],
    ["Battle Tower", 8],
    ["Frontier Dome", 16],
    ["Frontier Pike", 20],
    ["Frontier Pyramid", 21],
  ])("%s leaves the fields null and reads no ROM", (_name, _bit) => {
    const frame = { ...single(1), tableDerived: false as const };
    expect(gen3Trainers.rom(profileWith(tables), frame)).toEqual({});
    expect(filled(frame, { rom: {} })).toBe(frame);
  });

  test("a wild battle has no trainers and reads no ROM", () => {
    const frame = trainerFrame({
      kind: "wild",
      opponent: { active: [], party: [], trainers: [] },
    });
    expect(gen3Trainers.rom(profileWith(tables), frame)).toEqual({});
  });
});

describe("regions", () => {
  test("a trainer entry is 40 bytes at base plus id × 40", () => {
    const regions = gen3Trainers.rom(profileWith(tables), single(2));
    expect(regions["trainer:2"]).toMatchObject({
      kind: "static",
      at: { domain: "rom", offset: TRAINERS_AT + 80 },
      length: 40,
    });
    expect(regions.classNames).toMatchObject({ length: CLASS_COUNT * 13 });
    expect(regions.money).toMatchObject({ length: MONEY_COUNT * 2 });
  });

  test("maxRom bounds the biggest request the tables can make", () => {
    const max = gen3Trainers.maxRom(profileWith(tables));
    expect(max.trainerA).toMatchObject({
      at: { offset: TRAINERS_AT + (TRAINER_COUNT - 1) * 40 },
      length: 40,
    });
    expect(Object.keys(gen3Trainers.maxRom(profileWith({})))).toEqual([]);
    expect(
      Object.keys(
        gen3Trainers.maxRom(
          profileWith({ trainers: { base: rom(TRAINERS_AT), count: 0 } }),
        ),
      ),
    ).toEqual([]);
  });

  test("the money multiplier is one byte of gBattleStruct", () => {
    const { moneyMultiplier } = gen3Trainers.extras.regions(stock);
    expect(moneyMultiplier).toMatchObject({ kind: "pointer", length: 1 });
    expect(
      gen3Trainers.extras.decode(
        { moneyMultiplier: new Bytes(Uint8Array.of(3)) },
        ctxOf(stock),
      ),
    ).toEqual({ ok: true, value: { moneyMultiplier: 3 } });
  });
});
