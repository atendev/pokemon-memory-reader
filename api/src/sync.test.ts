import { expect, test } from "bun:test";
import { z } from "zod";
import * as schemas from "./schemas.js";
import type {
  ActiveBattle,
  Badge,
  AdapterInfo,
  Battle,
  BattleMove,
  Battler,
  Box,
  Boxes,
  ErrorBody,
  Game,
  InactiveBattle,
  LastBattle,
  MapLocation,
  Move,
  Nature,
  OpponentMon,
  Party,
  PlayTime,
  Player,
  Pokemon,
  Ref,
  ResourceMap,
  Rom,
  SideConditions,
  StatStages,
  Stats,
  Status,
  StatusResource,
  Topic,
  Trainer,
  Type,
} from "./types.js";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
/** Fails to compile unless `T` is `true`. */
type Expect<T extends true> = T;

type Infer<S extends z.ZodType> = z.infer<S>;

/**
 * Every schema paired with its hand-written type (amendment 054 §3). Adding a public schema
 * without a line here fails the runtime test below, and a drifting pair fails `bun run typecheck`.
 */
// biome-ignore lint/correctness/noUnusedVariables: checked by the compiler, never read.
type Pairs = [
  Expect<Equal<Infer<typeof schemas.Type>, Type>>,
  Expect<Equal<Infer<typeof schemas.Nature>, Nature>>,
  Expect<Equal<Infer<typeof schemas.Status>, Status>>,
  Expect<Equal<Infer<typeof schemas.Ref>, Ref>>,
  Expect<Equal<Infer<typeof schemas.Stats>, Stats>>,
  Expect<Equal<Infer<typeof schemas.Move>, Move>>,
  Expect<Equal<Infer<typeof schemas.Pokemon>, Pokemon>>,
  Expect<Equal<Infer<typeof schemas.Party>, Party>>,
  Expect<Equal<Infer<typeof schemas.Box>, Box>>,
  Expect<Equal<Infer<typeof schemas.Boxes>, Boxes>>,
  Expect<Equal<Infer<typeof schemas.Badge>, Badge>>,
  Expect<Equal<Infer<typeof schemas.MapLocation>, MapLocation>>,
  Expect<Equal<Infer<typeof schemas.PlayTime>, PlayTime>>,
  Expect<Equal<Infer<typeof schemas.Player>, Player>>,
  Expect<Equal<Infer<typeof schemas.Rom>, Rom>>,
  Expect<Equal<Infer<typeof schemas.Game>, Game>>,
  Expect<Equal<Infer<typeof schemas.AdapterInfo>, AdapterInfo>>,
  Expect<Equal<Infer<typeof schemas.StatusResource>, StatusResource>>,
  Expect<Equal<Infer<typeof schemas.ErrorBody>, ErrorBody>>,
  Expect<Equal<Infer<typeof schemas.StatStages>, StatStages>>,
  Expect<Equal<Infer<typeof schemas.BattleMove>, BattleMove>>,
  Expect<Equal<Infer<typeof schemas.Battler>, Battler>>,
  Expect<Equal<Infer<typeof schemas.Trainer>, Trainer>>,
  Expect<Equal<Infer<typeof schemas.OpponentMon>, OpponentMon>>,
  Expect<Equal<Infer<typeof schemas.SideConditions>, SideConditions>>,
  Expect<Equal<Infer<typeof schemas.LastBattle>, LastBattle>>,
  Expect<Equal<Infer<typeof schemas.InactiveBattle>, InactiveBattle>>,
  Expect<Equal<Infer<typeof schemas.ActiveBattle>, ActiveBattle>>,
  Expect<Equal<Infer<typeof schemas.Battle>, Battle>>,
];

/** The names in `Pairs`. Keep the two lists in step. */
const PAIRED = [
  "Type",
  "Nature",
  "Status",
  "Ref",
  "Stats",
  "Move",
  "Pokemon",
  "Party",
  "Box",
  "Boxes",
  "Badge",
  "MapLocation",
  "PlayTime",
  "Player",
  "Rom",
  "Game",
  "AdapterInfo",
  "StatusResource",
  "ErrorBody",
  "StatStages",
  "BattleMove",
  "Battler",
  "Trainer",
  "OpponentMon",
  "SideConditions",
  "LastBattle",
  "InactiveBattle",
  "ActiveBattle",
  "Battle",
];

// biome-ignore lint/correctness/noUnusedVariables: checked by the compiler, never read.
type Mapped = [
  Expect<
    Equal<
      { [T in Topic]: Infer<(typeof schemas.resourceSchemas)[T]> },
      ResourceMap
    >
  >,
  Expect<Equal<keyof typeof schemas.resourceSchemas, Topic>>,
  Expect<Equal<(typeof schemas.TOPICS)[number], Topic>>,
  Expect<Equal<(typeof schemas.TYPES)[number], Type>>,
  Expect<Equal<(typeof schemas.NATURES)[number], Nature>>,
  Expect<Equal<(typeof schemas.STATUSES)[number], Status>>,
  Expect<
    Equal<(typeof schemas.BATTLE_OUTCOMES)[number], LastBattle["outcome"]>
  >,
  Expect<Equal<(typeof schemas.BATTLE_KINDS)[number], ActiveBattle["kind"]>>,
  Expect<
    Equal<(typeof schemas.BATTLE_FORMATS)[number], ActiveBattle["format"]>
  >,
];

test("every exported schema has a type pair", () => {
  const exported = Object.entries(schemas)
    .filter(([, value]) => value instanceof z.ZodType)
    .map(([name]) => name)
    .sort();
  expect(exported).toEqual([...PAIRED].sort());
});

test("types.ts and client.ts import nothing from zod or schemas", async () => {
  for (const file of ["types.ts", "client.ts"]) {
    const source = await Bun.file(new URL(file, import.meta.url)).text();
    expect(source, file).not.toMatch(/from\s+["'](?:zod|\.\/schemas)/);
    expect(source, file).not.toMatch(/import\s*\(\s*["'](?:zod|\.\/schemas)/);
  }
});
