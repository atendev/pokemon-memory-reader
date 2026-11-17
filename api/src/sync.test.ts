import { expect, test } from "bun:test";
import { z } from "zod";
import * as schemas from "./schemas.js";
import type {
  AdapterInfo,
  ErrorBody,
  Game,
  Move,
  Nature,
  Party,
  Pokemon,
  Ref,
  ResourceMap,
  Rom,
  Stats,
  Status,
  StatusResource,
  Topic,
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
  Expect<Equal<Infer<typeof schemas.Rom>, Rom>>,
  Expect<Equal<Infer<typeof schemas.Game>, Game>>,
  Expect<Equal<Infer<typeof schemas.AdapterInfo>, AdapterInfo>>,
  Expect<Equal<Infer<typeof schemas.StatusResource>, StatusResource>>,
  Expect<Equal<Infer<typeof schemas.ErrorBody>, ErrorBody>>,
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
  "Rom",
  "Game",
  "AdapterInfo",
  "StatusResource",
  "ErrorBody",
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
