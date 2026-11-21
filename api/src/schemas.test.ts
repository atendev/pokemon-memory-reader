import { expect, test } from "bun:test";
import type { z } from "zod";
import { Battle, Box, Boxes, resourceSchemas, StreamEvent } from "./schemas.js";

/** Every `z.enum` a published schema holds, by path. A `z.enum` is closed by construction. */
function closedEnums(
  schema: z.ZodType,
  path: string,
  found: Record<string, string[]>,
): void {
  const def = schema._zod.def as {
    type: string;
    shape?: Record<string, z.ZodType>;
    element?: z.ZodType;
    innerType?: z.ZodType;
    entries?: Record<string, string>;
    options?: z.ZodType[];
  };
  switch (def.type) {
    case "enum":
      found[path] = Object.values(def.entries ?? {});
      return;
    case "object":
      for (const [key, child] of Object.entries(def.shape ?? {})) {
        closedEnums(child, path === "" ? key : `${path}.${key}`, found);
      }
      return;
    case "array":
      closedEnums(def.element as z.ZodType, `${path}[]`, found);
      return;
    case "union":
      for (const option of def.options ?? []) closedEnums(option, path, found);
      return;
    case "nullable":
    case "optional":
      closedEnums(def.innerType as z.ZodType, path, found);
      return;
    case "string":
    case "custom": // an open enum: validated as a string, so it has no closed list to snapshot
    case "number":
    case "int":
    case "boolean":
    case "literal":
      return;
    default:
      throw new Error(
        `closedEnums cannot walk a ${def.type} at ${path}. Teach it, so no enum hides there.`,
      );
  }
}

// Spec §10 and §7.11: every enum that is not open is closed and never gains a value within
// `/api/v2`. The open enums (error `code`, `dataFormat`, adapter `id`, `problem`, `bridge.bridge`
// and topic names) are validated as plain strings, so they never appear in the snapshot. Do not refresh it with
// `--update-snapshots` to make this test pass: a changed closed enum is a breaking API change.
test("the closed enums of every resource are unchanged", () => {
  const found: Record<string, string[]> = {};
  // `boxes` joins `resourceSchemas` with its route, so its closed enums are pinned here already.
  for (const [topic, schema] of Object.entries({
    ...resourceSchemas,
    boxes: Boxes,
  })) {
    closedEnums(schema, topic, found);
  }
  expect(found).toMatchSnapshot();
});

const emptySide = {
  reflect: false,
  lightScreen: false,
  safeguard: false,
  mist: false,
  spikes: 0,
};

test("battle is a union on `active`, and an unknown mode name still parses", () => {
  const inactive = { active: false, lastBattle: null };
  expect(Battle.safeParse(inactive).success).toBe(true);
  expect(Battle.safeParse({ active: true }).success).toBe(false);
  const active = {
    active: true,
    battleId: 1,
    kind: "wild",
    format: "single",
    modes: ["a_mode_a_newer_server_adds"],
    turn: null,
    player: { active: [], partner: null },
    opponent: { active: [], party: [], trainers: [] },
    field: {
      weather: null,
      terrain: null,
      sides: { player: emptySide, opponent: emptySide },
    },
  };
  expect(Battle.safeParse(active).success).toBe(true);
  expect(Battle.safeParse({ ...active, kind: "link" }).success).toBe(false);
  expect(Battle.safeParse({ ...active, modes: [1] }).success).toBe(false);
});

test("boxes keeps empty slots as null and an unreadable box empty", () => {
  const unreadable = {
    index: 0,
    name: null,
    wallpaper: null,
    readable: false,
    corruptSlots: [],
    slots: [],
  };
  expect(
    Boxes.safeParse({ currentBox: null, boxes: [unreadable] }).success,
  ).toBe(true);
  const readable = { ...unreadable, readable: true, slots: [null, null] };
  expect(Boxes.safeParse({ currentBox: 0, boxes: [readable] }).success).toBe(
    true,
  );
  expect(Boxes.safeParse({ currentBox: 0 }).success).toBe(false);
  const { corruptSlots: _omitted, ...withoutCorrupt } = readable;
  expect(Box.safeParse(withoutCorrupt).success).toBe(false);
  expect(Box.safeParse({ ...readable, future: 1 }).success).toBe(true);
});

test("the slots description lists the fields a box doesn't store", () => {
  const description = Box.shape.slots.description ?? "";
  expect(description).toContain(
    "hp, maxHp, stats and status in Gen 2 and Gen 3",
  );
  expect(description).toContain("stats and maxHp in Gen 1");
  expect(description).toContain("level is computed");
});

test("a stream event pairs its topic with that topic's resource", () => {
  const status = { state: "no_game", adapter: null, rom: null, game: null };
  expect(StreamEvent.safeParse({ topic: "status", data: status }).success).toBe(
    true,
  );
  expect(StreamEvent.safeParse({ topic: "party", data: status }).success).toBe(
    false,
  );
  expect(StreamEvent.safeParse({ topic: "unheard", data: {} }).success).toBe(
    false,
  );
});
