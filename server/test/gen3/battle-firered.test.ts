import { describe, expect, test } from "bun:test";
import { Bytes } from "../../src/format/bytes";
import { gen3Battle } from "../../src/format/gen3/battle";
import type { Regions, Slices } from "../../src/format/regions";
import type { DecodeContext } from "../../src/format/types";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import firered from "../../src/profile/builtin/firered-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import type { Profile } from "../../src/profile/schema";
import { referenceData } from "../../src/reference";
import type { BattleTick } from "../../src/resource/battle-tracker";
import { emeraldMemory, serve, TREECKO } from "../support/emerald-memory";
import { type BattleMonSpec, writeBattle } from "./battle-encode";

const loaded = loadProfiles({ builtin: [emerald, firered], user: [] });
const stock = loaded.registry.get("emerald-us-1.0");
const frlg = loaded.registry.get("firered-us-1.0");
if (stock?.dataFormat !== "gen3" || frlg?.dataFormat !== "gen3")
  throw new Error("Gen 3 profiles missing");
const reference = referenceData("gen3", "en");
if (!reference) throw new Error("Gen 3 English reference data missing");

const DOUBLE = 1 << 0;
const TRAINER = 1 << 3;
/** `BATTLE_TYPE_TWO_OPPONENTS` in pokeemerald, and `BATTLE_TYPE_GHOST` in pokefirered. */
const BIT_15 = 1 << 15;

/** The Emerald profile with the second opposing trainer symbol dropped, as FireRed's is. */
const { gTrainerBattleOpponent_B: _dropped, ...withoutB } = stock.addresses;
const noSecond: Profile<"gen3"> = { ...stock, addresses: withoutB };

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

const player: BattleMonSpec = {
  species: 277,
  level: 5,
  hp: 19,
  maxHp: 20,
  moves: [33],
  types: [12, 12],
};
const foe: BattleMonSpec = {
  species: 261,
  level: 3,
  hp: 12,
  maxHp: 12,
  moves: [33],
  types: [17, 17],
};
const foeMon = { ...TREECKO, species: 261, level: 3, nickname: "" };

function frameWith(profile: Profile<"gen3">, typeFlags: number) {
  const memory = emeraldMemory([TREECKO, TREECKO]);
  writeBattle(memory, {
    typeFlags,
    battlers: [player, foe, player, foe],
    partyIndexes: [0, 0, 1, 1],
    enemyParty: [foeMon, foeMon, foeMon, foeMon],
  });
  const view = new DataView(memory.ewram.buffer);
  view.setUint16(0x38bca, 0x10, true);
  view.setUint16(0x38bcc, 0x20, true);
  const tick = gen3Battle.frame.decode(
    slicesOf(memory, gen3Battle.frame.regions(profile)),
    ctxOf(profile),
  );
  if (!tick.ok) throw new Error(tick.reason);
  const value: BattleTick = tick.value;
  if (value.flag !== "set" || !value.frame.ok) throw new Error("no frame");
  return value.frame.value;
}

describe("a profile with no second opposing trainer (FireRed and LeafGreen)", () => {
  test("the generated FireRed profile has no trainer B address, and its regions still build", () => {
    expect(frlg.addresses.gTrainerBattleOpponent_B).toBeUndefined();
    const regions = gen3Battle.frame.regions(frlg);
    expect(regions.opponentB).toEqual(regions.opponentA);
  });

  test("bit 15 (BATTLE_TYPE_GHOST) does not split the opponent party or add a second trainer", () => {
    const frame = frameWith(noSecond, DOUBLE | BIT_15 | TRAINER);
    expect(frame.opponent.trainers.map((t) => t.id)).toEqual([0x10]);
    expect(frame.opponent.party.every((mon) => mon.trainer === 0)).toBe(true);
  });

  test("the same flags on a profile with trainer B read two opponents", () => {
    const frame = frameWith(stock, DOUBLE | BIT_15 | TRAINER);
    expect(frame.opponent.trainers.map((t) => t.id)).toEqual([0x10, 0x20]);
  });

  test("a plain double trainer battle reads one trainer on a profile without B", () => {
    const frame = frameWith(noSecond, DOUBLE | TRAINER);
    expect(frame.opponent.trainers.map((t) => t.id)).toEqual([0x10]);
  });
});
