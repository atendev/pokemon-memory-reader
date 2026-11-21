import { describe, expect, test } from "bun:test";
import { BRIDGE_CAPS } from "../adapter/bridge/constants";
import { declaredRegions } from "../format/registry";
import emerald from "./builtin/emerald-us-1.0.json";
import { checkRequestCaps } from "./caps";
import { loadProfiles } from "./registry";
import type { Profile } from "./schema";

const base = emerald as unknown as Record<string, unknown>;
const hackParts = {
  nameTables: {
    species: "vanilla",
    moves: "vanilla",
    items: "vanilla",
    abilities: "vanilla",
    locations: "vanilla",
  },
  speciesData: { info: "vanilla", dex: "vanilla", exp: "vanilla" },
  moveData: "vanilla",
};
const child = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind: "official",
  name: id,
  extends: "emerald-us-1.0",
  fixture: "none",
  ...extra,
});
const user = (path: string, json: unknown) => ({ path, json });
const load = (users: ReturnType<typeof user>[], builtin: unknown[] = [base]) =>
  loadProfiles({ builtin, user: users });

describe("extends", () => {
  test("inherits layout data but never identity, identify, fixture, provenance or features", () => {
    const { registry, problems } = load([
      user("a.json", child("emerald-copy", { fixture: "smoke" })),
    ]);
    expect(problems).toEqual([]);
    const copy = registry.get("emerald-copy");
    expect(copy?.addresses.gPlayerParty).toEqual({
      domain: "ewram",
      offset: 0x244ec,
    });
    expect(copy?.artVersion).toBe("emerald");
    expect(copy?.trainerTables.trainers?.count).toBe(855);
    expect(copy?.identify).toBeNull();
    expect(copy?.provenance).toBeNull();
    expect(copy?.fixture).toBe("smoke");
    expect(copy?.name).toBe("emerald-copy");
  });

  test("merges one level deep, and null removes an inherited key", () => {
    const { registry, problems } = load([
      user(
        "a.json",
        child("c", {
          addresses: { gPlayerParty: "0x02000000" },
          trainerTables: { money: null },
        }),
      ),
    ]);
    expect(problems).toEqual([]);
    const c = registry.get("c");
    expect(c?.addresses.gPlayerParty).toEqual({ domain: "ewram", offset: 0 });
    expect(c?.addresses.gEnemyParty).toEqual({
      domain: "ewram",
      offset: 0x24744,
    });
    expect(c?.trainerTables.money).toBeUndefined();
    expect(c?.trainerTables.trainers).toBeDefined();
  });

  test("nulling a required address fails the child alone", () => {
    const { registry, problems } = load([
      user("a.json", child("c", { addresses: { gPlayerParty: null } })),
    ]);
    expect(registry.get("c")).toBeUndefined();
    expect(registry.get("emerald-us-1.0")).toBeDefined();
    expect(problems[0]?.message).toContain("addresses.gPlayerParty");
  });

  test("a child inherits the player block, overrides one key and drops the key with null", () => {
    const { registry, problems } = load([
      user(
        "a.json",
        child("moved", {
          kind: "hack",
          ...hackParts,
          player: { moneyOffset: 0x500 },
        }),
      ),
      user(
        "b.json",
        child("keyless", {
          kind: "hack",
          ...hackParts,
          player: { encryptionKeyOffset: null },
        }),
      ),
    ]);
    expect(problems).toEqual([]);
    const moved = registry.get("moved");
    const keyless = registry.get("keyless");
    if (moved?.dataFormat !== "gen3" || keyless?.dataFormat !== "gen3")
      throw new Error("expected Gen 3 profiles");
    expect(moved.player).toMatchObject({
      moneyOffset: 0x500,
      flagsOffset: 0x1270,
    });
    expect(moved.player.badgeFlags).toHaveLength(8);
    expect(keyless.player.encryptionKeyOffset).toBeUndefined();
  });

  test("a child inherits the bag block and restates one array to change a capacity", () => {
    const { registry, problems } = load([
      user(
        "a.json",
        child("bigger", {
          kind: "hack",
          ...hackParts,
          bag: { pocketCapacities: [40, 30, 16, 64, 46] },
        }),
      ),
    ]);
    expect(problems).toEqual([]);
    const bigger = registry.get("bigger");
    if (bigger?.dataFormat !== "gen3") throw new Error("expected Gen 3");
    expect(bigger.bag.pocketCapacities[0]).toBe(40);
    expect(bigger.bag.pocketOffsets).toEqual([
      0x560, 0x5d8, 0x650, 0x690, 0x790,
    ]);
  });

  test("a missing parent names the parent", () => {
    const { problems } = load([
      user("a.json", child("c", { extends: "nope" })),
    ]);
    expect(problems[0]?.message).toContain('"nope"');
  });

  test("a cycle lists the whole chain", () => {
    const { registry, problems } = load([
      user("a.json", child("a", { extends: "b" })),
      user("b.json", child("b", { extends: "a" })),
    ]);
    expect(registry.get("a")).toBeUndefined();
    expect(registry.get("b")).toBeUndefined();
    expect(problems.some((p) => p.message.includes("a → b → a"))).toBe(true);
  });

  test("an official profile can't extend a hack, but a hack can extend an official one", () => {
    const hack = child("h", { kind: "hack", ...hackParts });
    const { registry, problems } = load([
      user("h.json", hack),
      user("o.json", child("o", { extends: "h" })),
    ]);
    expect(registry.get("h")?.kind).toBe("hack");
    expect(registry.get("h")?.features.boxes).toBe(false);
    expect(registry.get("o")).toBeUndefined();
    expect(problems.find((p) => p.path === "o.json")?.message).toContain(
      "can't extend a hack",
    );
  });

  test("chains resolve through intermediate parents", () => {
    const { registry } = load([
      user("a.json", child("a", { addresses: { gEnemyParty: "0x02000010" } })),
      user("b.json", child("b", { extends: "a" })),
    ]);
    expect(registry.get("b")?.addresses.gEnemyParty).toEqual({
      domain: "ewram",
      offset: 0x10,
    });
  });
});

describe("user files", () => {
  test("a valid replacement wins and becomes the parent of its children", () => {
    const replacement = {
      ...structuredClone(base),
      name: "My Emerald",
      fixture: "none",
    };
    const { registry, problems } = load([
      user("r.json", replacement),
      user("c.json", child("c")),
    ]);
    expect(problems).toEqual([]);
    expect(registry.get("emerald-us-1.0")?.name).toBe("My Emerald");
    expect(registry.all().length).toBe(2);
  });

  test("a broken replacement is skipped, the built-in stays and its children resolve against it", () => {
    const broken = {
      ...structuredClone(base),
      addresses: { gPlayerParty: "oops" },
    };
    const { registry, problems } = load([
      user("r.json", broken),
      user("c.json", child("c")),
    ]);
    expect(registry.get("emerald-us-1.0")?.name).toBe(
      "Pokémon Emerald (US 1.0)",
    );
    expect(registry.get("c")).toBeDefined();
    const problem = problems.find((p) => p.path === "r.json");
    expect(problem?.source).toBe("user");
    expect(problem?.message).toContain("built-in kept");
  });

  test("a replacement that extends a profile extending it is skipped (amendment 018 order example)", () => {
    const { registry, problems } = load([
      user("r.json", child("emerald-us-1.0", { extends: "x" })),
      user("x.json", child("x")),
    ]);
    expect(registry.get("emerald-us-1.0")?.name).toBe(
      "Pokémon Emerald (US 1.0)",
    );
    expect(registry.get("x")).toBeDefined();
    expect(problems.some((p) => p.path === "r.json")).toBe(true);
  });

  test("omitting fixture on a user profile means none", () => {
    const { fixture: _drop, ...file } = child("c");
    const { registry } = load([user("c.json", file)]);
    expect(registry.get("c")?.fixture).toBe("none");
  });

  test("a bad file lands in problems and never throws", () => {
    const { registry, problems } = load([
      user("bad.json", "not an object"),
      user("bad2.json", { id: 3 }),
    ]);
    expect(problems.map((p) => p.path)).toEqual(["bad.json", "bad2.json"]);
    expect(registry.all().length).toBe(1);
  });
});

describe("built-in files", () => {
  test("must state fixture", () => {
    const { fixture: _drop, ...file } = base;
    const { registry, problems } = load([], [file]);
    expect(registry.all()).toEqual([]);
    expect(problems[0]?.message).toContain("fixture");
  });
});

describe("duplicate IDs", () => {
  test("reports two user files with one ID, and the later file wins", () => {
    const { registry, problems } = load([
      user("a.json", child("dup", { name: "first" })),
      user("b.json", child("dup", { name: "second" })),
    ]);
    expect(problems.map((p) => p.path)).toEqual(["b.json"]);
    expect(problems[0]?.message).toContain("duplicate");
    expect(registry.get("dup")?.name).toBe("second");
  });
});

describe("bridge caps", () => {
  const caps = { maxRanges: 512, maxBytes: 100, mergeGap: 32 };

  test("a profile whose batch exceeds a cap fails to load, naming the region and the cap", () => {
    const { registry, problems } = loadProfiles({
      builtin: [base],
      user: [],
      caps,
    });
    expect(registry.get("emerald-us-1.0")).toBeUndefined();
    expect(problems).toHaveLength(1);
    expect(problems[0]?.source).toBe("builtin");
    expect(problems[0]?.message).toContain("main batch needs 39 ranges");
    expect(problems[0]?.message).toContain("largest region party.party");
    expect(problems[0]?.message).toContain("512 ranges and 100 bytes");
  });

  test("the Emerald profile fits the real bridge caps", () => {
    const { registry, problems } = load([]);
    expect(problems).toEqual([]);
    const profile = registry.get("emerald-us-1.0");
    expect(profile).toBeDefined();
    // Guards against a vacuous pass: the check really measured the party regions.
    const declared = declaredRegions(profile as Profile);
    expect(declared.main.map((p) => p.part)).toEqual([
      "party",
      "player",
      "bag",
      "battle",
      "battleExtras",
    ]);
    expect(
      checkRequestCaps("main batch", declared.main, BRIDGE_CAPS),
    ).toBeNull();
  });

  test("the Emerald box request is measured and fits the 64 KiB bridge cap", () => {
    const { registry } = load([]);
    const declared = declaredRegions(registry.get("emerald-us-1.0") as Profile);
    // The box request is no longer empty: it holds the whole PokemonStorage block (0x83D0 bytes).
    expect(declared.boxes.map((p) => p.part)).toEqual(["boxes"]);
    expect(declared.boxes[0]?.regions.storage?.length).toBe(0x83d0);
    expect(
      checkRequestCaps("box request", declared.boxes, BRIDGE_CAPS),
    ).toBeNull();
  });

  test("a box request over the byte cap fails the profile load and names the box request", () => {
    const caps = { ...BRIDGE_CAPS, maxBytes: 0x8000 };
    const { registry, problems } = loadProfiles({
      builtin: [base],
      user: [],
      caps,
    });
    expect(registry.get("emerald-us-1.0")).toBeUndefined();
    expect(problems[0]?.message).toContain("box request needs");
    expect(problems[0]?.message).toContain("largest region boxes.storage");
  });
});
