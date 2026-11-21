import { describe, expect, test } from "bun:test";
import { Bytes } from "../../src/format/bytes";
import { gen3Battle } from "../../src/format/gen3/battle";
import { gen3Trainers } from "../../src/format/gen3/trainers";
import type { Regions, Slices } from "../../src/format/regions";
import type { DecodeContext } from "../../src/format/types";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import ruby from "../../src/profile/builtin/ruby-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import type { Profile } from "../../src/profile/schema";
import { referenceData } from "../../src/reference";
import type { BattleTick } from "../../src/resource/battle-tracker";
import {
  battler,
  opponentMon,
  trainer,
  trainerFrame,
} from "../support/battle-frames";
import { emeraldMemory, serve, TREECKO } from "../support/emerald-memory";
import { encodeBattleMon } from "./battle-encode";
import { encodeMon, partyBytes } from "./encode";

const loaded = loadProfiles({ builtin: [emerald, ruby], user: [] });
const rs = loaded.registry.get("ruby-us-1.0");
if (rs?.dataFormat !== "gen3") throw new Error("Ruby profile missing");
const reference = referenceData("gen3", "en");
if (!reference) throw new Error("Gen 3 English reference data missing");

/**
 * pokeruby addresses from `pokeruby.sym`, written out so the test checks the generated profile. EWRAM
 * offsets are the address minus 0x02000000 and IWRAM offsets the address minus 0x03000000.
 */
const AT = {
  typeFlags: 0x239f8,
  mons: 0x24a80,
  partyIndexes: 0x24a6a,
  weather: 0x24db8,
  sideStatuses: 0x24c7a,
  sideTimers: 0x24c80,
  opponent: 0x2ff5e,
  enemyCount: 0x45b8,
  enemyParty: 0x45c0,
  main: 0x1770,
  sharedMem: 0,
} as const;
const IN_BATTLE_AT = AT.main + 0x43d;
const MONEY_MULTIPLIER_AT = AT.sharedMem + 0x16056;
const SPIKES = 0x10;

const ctxOf = (profile: Profile<"gen3">): DecodeContext<Profile<"gen3">> => ({
  profile,
  ...reference,
  names: { ...reference.names, locations: reference.locations("emerald") },
});

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

const player = {
  species: 277,
  level: 5,
  hp: 19,
  maxHp: 20,
  moves: [33],
  types: [12, 12] as const,
};
const foe = {
  species: 261,
  level: 3,
  hp: 12,
  maxHp: 12,
  moves: [33],
  types: [17, 17] as const,
};

function rubyBattle(inBattleByte = IN_BATTLE_AT) {
  const memory = emeraldMemory([]);
  const view = new DataView(memory.ewram.buffer);
  memory.ewram.fill(0);
  memory.iwram[inBattleByte] = 0x02;
  view.setUint32(AT.typeFlags, 1 << 3, true);
  [player, foe].forEach((mon, position) => {
    memory.ewram.set(encodeBattleMon(mon), AT.mons + position * 0x58);
  });
  memory.iwram[AT.enemyCount] = 1;
  const foeMon = { ...TREECKO, species: 261, level: 3, nickname: "" };
  memory.iwram.set(partyBytes([encodeMon(foeMon)]), AT.enemyParty);
  view.setUint16(AT.opponent, 0x10, true);
  return { memory, view };
}

describe("Ruby battle layout constants", () => {
  test("the in-battle flag is the byte at gMain + 0x43D, not Emerald's 0x439", () => {
    const set = rubyBattle();
    expect(
      gen3Battle.probe.decode(
        slicesOf(set.memory, gen3Battle.probe.regions(rs)),
        ctxOf(rs),
      ),
    ).toMatchObject({ ok: true, value: { flag: "set" } });
    const emeraldByte = rubyBattle(AT.main + 0x439);
    expect(
      gen3Battle.probe.decode(
        slicesOf(emeraldByte.memory, gen3Battle.probe.regions(rs)),
        ctxOf(rs),
      ),
    ).toMatchObject({ ok: true, value: { flag: "clear" } });
  });

  test("spikes read from +6 of the 12-byte side timer, not +10", () => {
    const { memory, view } = rubyBattle();
    view.setUint16(AT.sideStatuses + 2, SPIKES, true);
    memory.ewram[AT.sideTimers + 12 + 6] = 3;
    memory.ewram[AT.sideTimers + 12 + 10] = 9;
    const tick = gen3Battle.frame.decode(
      slicesOf(memory, gen3Battle.frame.regions(rs)),
      ctxOf(rs),
    );
    if (!tick.ok) throw new Error(tick.reason);
    const value: BattleTick = tick.value;
    if (value.flag !== "set" || !value.frame.ok) throw new Error("no frame");
    expect(value.frame.value.field.sides.opponent.spikes).toBe(3);
    expect(value.frame.value.field.sides.player.spikes).toBe(0);
  });
});

describe("Ruby trainer prize money", () => {
  const frame = trainerFrame({
    opponent: {
      active: [battler("opponent", 0)],
      party: [opponentMon(0, { trainer: 0, level: 20 })],
      trainers: [{ ...trainer, id: 2 }],
    },
  });

  test("the money multiplier is read from gSharedMem + 0x16056", () => {
    const regions = gen3Trainers.extras.regions(rs);
    expect(regions.moneyMultiplier).toMatchObject({
      kind: "static",
      at: { domain: "ewram", offset: MONEY_MULTIPLIER_AT },
    });
  });

  test("the money table is read in 4-byte entries and its region covers all 55", () => {
    const regions = gen3Trainers.rom(rs, frame);
    expect(regions.money).toMatchObject({ length: 55 * 4 });
  });

  test("a 4-byte entry gives the value for its class, and prize money follows", () => {
    // Trainer 2 is class 3. Class 1 pays 4, class 3 pays 25, then the 0xff terminator pays 5.
    const trainerEntry = new Uint8Array(40);
    trainerEntry[1] = 3;
    const money = Uint8Array.of(1, 4, 0, 0, 3, 25, 0, 0, 0xff, 5, 0, 0);
    const profile: Profile<"gen3"> = {
      ...rs,
      trainerTables: {
        trainers: { base: { domain: "rom", offset: 0x100 }, count: 4 },
        classNames: { base: { domain: "rom", offset: 0x300 }, count: 4 },
        money: { base: { domain: "rom", offset: 0x400 }, count: 3 },
      },
    };
    const rom = new Uint8Array(0x500);
    rom.set(trainerEntry, 0x100 + 2 * 40);
    rom.set(money, 0x400);
    const memory = { ...emeraldMemory([]), rom };
    const read = Object.fromEntries(
      Object.entries(gen3Trainers.rom(profile, frame)).map(([name, region]) => {
        if (region.kind !== "static") throw new Error("ROM regions are static");
        return [
          name,
          new Bytes(serve(memory, [{ ...region.at, length: region.length }])),
        ];
      }),
    );
    const filled = gen3Trainers.fill(frame, ctxOf(profile), read, {
      moneyMultiplier: 1,
    });
    // 4 × level 20 × multiplier 1 × value 25.
    expect(filled.opponent.trainers[0]?.prizeMoney).toBe(2000);
  });
});
