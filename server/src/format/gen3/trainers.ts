import type { Trainer } from "@pokemon-memory-reader/api/schemas";
import type { Profile } from "../../profile/schema";
import type { BattleFrame } from "../../resource/battle-tracker";
import type { Bytes } from "../bytes";
import { type Region, region } from "../regions";
import type {
  BattleExtras,
  DecodeContext,
  ResourceDecoder,
  TrainerFill,
} from "../types";
import { ref } from "./mon";
import { at } from "./save";

/** `struct Trainer` in pokeemerald (`include/data.h`): 40 bytes with the class at +1, a 12-byte name at +4 and four u16 starting items at +0x10. */
const TRAINER = {
  size: 40,
  classId: 0x01,
  name: 0x04,
  nameLength: 12,
  items: 0x10,
  itemCount: 4,
} as const;

/** Each `gTrainerClassNames` entry is a 13-byte name. */
const CLASS_NAME_SIZE = 13;
/** Each `gTrainerMoneyTable` entry is a class ID and a value byte. The table ends at a class ID of 0xFF. */
const MONEY_ENTRY = { size: 2, terminator: 0xff } as const;

/** `gBattleStruct->moneyMultiplier` (pokeemerald `struct BattleStruct`), a u8. */
const MONEY_MULTIPLIER_OFFSET = 0x4a;

type Gen3Profile = Profile<"gen3">;
type Tables = Gen3Profile["trainerTables"];

const trainerRegion = (id: number): string => `trainer:${id}`;

/** One 40-byte entry per trainer, when the profile has the table and the ID is inside its count. */
function trainerRegions(
  tables: Tables,
  ids: readonly number[],
): Record<string, Region> {
  const { trainers } = tables;
  if (!trainers) return {};
  return Object.fromEntries(
    ids
      .filter((id) => id < trainers.count)
      .map((id) => [
        trainerRegion(id),
        region(
          {
            ...trainers.base,
            offset: trainers.base.offset + id * TRAINER.size,
          },
          TRAINER.size,
        ),
      ]),
  );
}

/** Both tables are read whole, so a class ID read from a trainer entry needs no second request. */
function classTables(tables: Tables): Record<string, Region> {
  const { classNames, money } = tables;
  return {
    ...(classNames && {
      classNames: region(classNames.base, classNames.count * CLASS_NAME_SIZE),
    }),
    ...(money && {
      money: region(money.base, money.count * MONEY_ENTRY.size),
    }),
  };
}

/**
 * Gen 3 and CFRU `GetTrainerMoneyToGive` (spec §7.8): `4 × lastMonLevel × moneyMultiplier × value`.
 * The game doubles it for a double battle with one opponent. A two-opponent battle is a double
 * battle too, but there each trainer pays only its own amount.
 */
export function prizeMoney(input: {
  readonly lastMonLevel: number;
  readonly moneyMultiplier: number;
  readonly value: number;
  readonly doubled: boolean;
}): number {
  const base = 4 * input.lastMonLevel * input.moneyMultiplier * input.value;
  return input.doubled ? base * 2 : base;
}

/** The value for a class ID, or the terminator's value when no class matches, as the game's loop does. */
function moneyValue(
  table: Bytes,
  count: number,
  classId: number,
): number | null {
  let terminator: number | null = null;
  for (let index = 0; index < count; index++) {
    const entryClass = table.u8(index * MONEY_ENTRY.size);
    const value = table.u8(index * MONEY_ENTRY.size + 1);
    if (entryClass === classId) return value;
    if (entryClass === MONEY_ENTRY.terminator && terminator === null)
      terminator = value;
  }
  return terminator;
}

function fillTrainer(
  trainer: Trainer,
  index: number,
  frame: BattleFrame,
  ctx: DecodeContext<Gen3Profile>,
  rom: Readonly<Record<string, Bytes>>,
  extras: BattleExtras | null,
): Trainer {
  const tables = ctx.profile.trainerTables;
  const entry = rom[trainerRegion(trainer.id)];
  const classId = entry ? entry.u8(TRAINER.classId) : null;

  const name = entry
    ? ctx.charmap.decode(
        entry.sub(TRAINER.name, TRAINER.nameLength),
        TRAINER.nameLength,
      )
    : null;
  const items = entry
    ? Array.from({ length: TRAINER.itemCount }, (_, slot) =>
        entry.u16le(TRAINER.items + slot * 2),
      )
        .filter((id) => id !== 0)
        .map((id) => ref(id, ctx.names.items(id)))
    : null;

  const classNameBytes = rom.classNames;
  const className =
    classId !== null &&
    classNameBytes &&
    tables.classNames &&
    classId < tables.classNames.count
      ? ctx.charmap.decode(
          classNameBytes.sub(classId * CLASS_NAME_SIZE, CLASS_NAME_SIZE),
          CLASS_NAME_SIZE,
        )
      : null;

  const moneyBytes = rom.money;
  const value =
    classId !== null && moneyBytes && tables.money
      ? moneyValue(moneyBytes, tables.money.count, classId)
      : null;
  const mons = frame.opponent.party.filter((mon) => mon.trainer === index);
  const lastMon = mons.reduce<(typeof mons)[number] | null>(
    (last, mon) =>
      last === null || mon.partySlot > last.partySlot ? mon : last,
    null,
  );
  const lastMonLevel = lastMon?.level ?? null;
  const money =
    value !== null && lastMonLevel !== null && extras !== null
      ? prizeMoney({
          lastMonLevel,
          moneyMultiplier: extras.moneyMultiplier,
          value,
          doubled:
            frame.format === "double" && frame.opponent.trainers.length === 1,
        })
      : null;

  return { ...trainer, classId, className, name, prizeMoney: money, items };
}

const extras: ResourceDecoder<
  Gen3Profile,
  { moneyMultiplier: Region },
  BattleExtras
> = {
  regions: (profile) => ({
    moneyMultiplier: region(
      at(profile.addresses.gBattleStruct, MONEY_MULTIPLIER_OFFSET),
      1,
    ),
  }),
  decode: ({ moneyMultiplier }) => ({
    ok: true,
    value: { moneyMultiplier: moneyMultiplier.u8(0) },
  }),
};

/**
 * Fills a Gen 3 frame's trainers from `gTrainers`, `gTrainerClassNames` and `gTrainerMoneyTable`
 * (spec §7.8). Each table is optional in the profile and nulls only its own fields.
 */
export const gen3Trainers: TrainerFill<Gen3Profile> = {
  extras,

  rom(profile, frame) {
    if (frame.tableDerived === false || frame.opponent.trainers.length === 0)
      return {};
    return {
      ...trainerRegions(
        profile.trainerTables,
        frame.opponent.trainers.map((trainer) => trainer.id),
      ),
      ...classTables(profile.trainerTables),
    };
  },

  maxRom(profile) {
    const last = (profile.trainerTables.trainers?.count ?? 1) - 1;
    const entry = trainerRegions(profile.trainerTables, [last])[
      trainerRegion(last)
    ];
    return {
      ...(entry && { trainerA: entry, trainerB: entry }),
      ...classTables(profile.trainerTables),
    };
  },

  fill(frame, ctx, rom, battleExtras) {
    if (frame.tableDerived === false) return frame;
    return {
      ...frame,
      opponent: {
        ...frame.opponent,
        trainers: frame.opponent.trainers.map((trainer, index) =>
          fillTrainer(trainer, index, frame, ctx, rom, battleExtras),
        ),
      },
    };
  },
};
