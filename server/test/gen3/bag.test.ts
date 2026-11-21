import { describe, expect, test } from "bun:test";
import { Bag } from "@pokemon-memory-reader/api/schemas";
import { Bytes } from "../../src/format/bytes";
import { gen3Bag } from "../../src/format/gen3/bag";
import type { DecodeContext } from "../../src/format/types";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import type { Profile } from "../../src/profile/schema";
import { referenceData } from "../../src/reference";

const loaded = loadProfiles({ builtin: [emerald], user: [] });
const found = loaded.registry.get("emerald-us-1.0");
if (found?.dataFormat !== "gen3") throw new Error("Emerald profile missing");
const profile: Profile<"gen3"> = found;
const reference = referenceData("gen3", "en");
if (!reference) throw new Error("Gen 3 English reference data missing");
const ctxFor = (p: Profile<"gen3">): DecodeContext<Profile<"gen3">> => ({
  profile: p,
  ...reference,
  names: {
    ...reference.names,
    items: reference.items("emerald"),
    locations: reference.locations("emerald"),
  },
});

const POTION = 13;
const POKE_BALL = 4;
const UNKNOWN = 0x7fff;
const IDS = ["items", "keyItems", "balls", "tmhm", "berries"] as const;

type Stack = readonly [id: number, quantity: number];
type Pockets = Partial<Record<(typeof IDS)[number], readonly Stack[]>>;

/** The slices the decoder asks for, with each quantity stored XORed with the low half of `key`. */
function slices(
  pockets: Pockets = {},
  key = 0,
  p: Profile<"gen3"> = profile,
): Record<string, Bytes> {
  const out: Record<string, Bytes> = {};
  IDS.forEach((id, index) => {
    const bytes = new Uint8Array((p.bag.pocketCapacities[index] ?? 0) * 4);
    const view = new DataView(bytes.buffer);
    (pockets[id] ?? []).forEach(([item, quantity], slot) => {
      view.setUint16(slot * 4, item, true);
      view.setUint16(slot * 4 + 2, (quantity ^ key) & 0xffff, true);
    });
    out[id] = new Bytes(bytes);
  });
  out.key = new Bytes(Uint8Array.of(key & 0xff, (key >> 8) & 0xff, 0xaa, 0xbb));
  return out;
}

const decode = (
  pockets?: Pockets,
  key?: number,
  p: Profile<"gen3"> = profile,
) => {
  const result = gen3Bag.decode(slices(pockets, key, p) as never, ctxFor(p));
  if (!result.ok) throw new Error(result.reason);
  return Bag.parse(result.value);
};

describe("the bag decoder", () => {
  test("lists the five pockets in game order with the Emerald capacities", () => {
    const bag = decode();
    expect(bag.pockets.map((pocket) => pocket.id)).toEqual([...IDS]);
    expect(bag.pockets.map((pocket) => pocket.capacity)).toEqual([
      30, 30, 16, 64, 46,
    ]);
  });

  test("an empty pocket is present with no items", () => {
    const bag = decode({ items: [[POTION, 3]] });
    expect(bag.pockets[1]).toEqual({ id: "keyItems", capacity: 30, items: [] });
    expect(bag.pockets[4]?.items).toEqual([]);
  });

  test("a full pocket keeps every slot in order", () => {
    const full: Stack[] = Array.from({ length: 16 }, (_, i) => [
      POKE_BALL,
      i + 1,
    ]);
    const bag = decode({ balls: full }, 0x1234);
    const balls = bag.pockets[2];
    expect(balls?.items).toHaveLength(16);
    expect(balls?.items.map((entry) => entry.quantity)).toEqual(
      full.map(([, quantity]) => quantity),
    );
    expect(balls?.items[0]?.item).toEqual({
      id: POKE_BALL,
      name: reference.items("emerald")(POKE_BALL),
    });
    expect(reference.items("emerald")(POKE_BALL)).toBeString();
  });

  test("an unknown item ID keeps its number with a null name", () => {
    const bag = decode({ items: [[UNKNOWN, 5]] });
    expect(bag.pockets[0]?.items).toEqual([
      { item: { id: UNKNOWN, name: null }, quantity: 5 },
    ]);
  });

  test("decrypts quantities with the low 16 bits of the key", () => {
    const bag = decode({ items: [[POTION, 99]], tmhm: [[289, 1]] }, 0xdeadbeef);
    expect(bag.pockets[0]?.items[0]).toMatchObject({
      item: { id: POTION },
      quantity: 99,
    });
    expect(bag.pockets[3]?.items[0]?.quantity).toBe(1);
  });

  test("a quantity of 0 and one above 99 are kept as stored", () => {
    const bag = decode({
      items: [
        [POTION, 0],
        [POKE_BALL, 999],
      ],
    });
    expect(bag.pockets[0]?.items.map((entry) => entry.quantity)).toEqual([
      0, 999,
    ]);
  });

  test("an empty slot between two stacks is skipped and the order is kept", () => {
    const bag = decode({
      items: [
        [POTION, 1],
        [0, 0],
        [POKE_BALL, 2],
      ],
    });
    expect(bag.pockets[0]?.items.map((entry) => entry.item.id)).toEqual([
      POTION,
      POKE_BALL,
    ]);
  });

  test("a profile with no key reads quantities as stored and still declares the key region", () => {
    const { encryptionKeyOffset: _, ...player } = profile.player;
    const keyless = { ...profile, player } as Profile<"gen3">;
    const stored = slices({ items: [[POTION, 7]] }, 0, keyless);
    stored.key = new Bytes(Uint8Array.of(9, 9, 9, 9));
    const result = gen3Bag.decode(stored as never, ctxFor(keyless));
    expect(result.ok && result.value.pockets[0]?.items[0]?.quantity).toBe(7);
    expect(Object.keys(gen3Bag.regions(keyless)).sort()).toEqual([
      "balls",
      "berries",
      "items",
      "key",
      "keyItems",
      "tmhm",
    ]);
  });
});

describe("the bag regions", () => {
  test("Emerald declares each pocket at its slot count times four, and the key", () => {
    const regions = gen3Bag.regions(profile);
    expect(regions.items).toMatchObject({ kind: "pointer", length: 120 });
    expect(regions.keyItems).toMatchObject({ kind: "pointer", length: 120 });
    expect(regions.balls).toMatchObject({ kind: "pointer", length: 64 });
    expect(regions.tmhm).toMatchObject({ kind: "pointer", length: 256 });
    expect(regions.berries).toMatchObject({ kind: "pointer", length: 184 });
    expect(regions.key).toMatchObject({ kind: "pointer", length: 4 });
  });
});
