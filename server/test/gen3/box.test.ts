import { describe, expect, test } from "bun:test";
import {
  Boxes,
  NATURES,
  type Pokemon,
} from "@pokemon-memory-reader/api/schemas";
import { Bytes } from "../../src/format/bytes";
import { gen3Decoder } from "../../src/format/gen3";
import { gen3Boxes, unreadableBoxes } from "../../src/format/gen3/box";
import { STORAGE } from "../../src/format/gen3/structs";
import type { DecodeContext } from "../../src/format/types";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import type { Profile } from "../../src/profile/schema";
import { referenceData } from "../../src/reference";
import { encodeMon, type MonSpec, storageBytes } from "./encode";

const loaded = loadProfiles({ builtin: [emerald], user: [] });
const profile = loaded.registry.get("emerald-us-1.0");
if (profile?.dataFormat !== "gen3") throw new Error("Emerald profile missing");
const reference = referenceData("gen3", "en");
if (!reference) throw new Error("Gen 3 English reference data missing");
const ctx: DecodeContext<Profile<"gen3">> = {
  profile,
  ...reference,
  names: {
    ...reference.names,
    items: reference.items("emerald"),
    locations: reference.locations("emerald"),
  },
};

const TREECKO = 277;
const SLOWPOKE_LINE = 129; // slow growth
const PIKACHU = 25; // medium fast

const treecko: MonSpec = {
  personality: 0x00000108,
  tid: 12345,
  sid: 6789,
  nickname: "LEAFY",
  otName: "BRENDAN",
  species: TREECKO,
  experience: 135,
  moves: [33, 52, 0, 0],
  pp: [35, 25, 0, 0],
  ivs: { hp: 31, atk: 30, def: 29, spe: 28, spa: 27, spd: 26 },
};

type Storage = Parameters<typeof storageBytes>[0];
const decode = (spec: Storage = {}) => {
  const result = gen3Boxes.decode(
    { storage: new Bytes(storageBytes(spec)) },
    ctx,
  );
  if (!result.ok) throw new Error(result.reason);
  return result.value;
};
const slotOf = (box: number, slot: number, spec: Storage): Pokemon | null =>
  decode(spec).boxes[box]?.slots[slot] ?? null;

describe("the storage layout", () => {
  test("PokemonStorage is 0x83D0 bytes, the size pokeemerald gives it", () => {
    expect(STORAGE.size).toBe(0x83d0);
    expect(STORAGE.names).toBe(0x8344);
    expect(STORAGE.wallpapers).toBe(0x83c2);
  });

  test("the decoder reads the whole block through gPokemonStorage", () => {
    const { storage } = gen3Boxes.regions(profile);
    expect(storage.length).toBe(STORAGE.size);
    expect(storage.kind).toBe("pointer");
  });

  test("the Gen 3 decoder carries the box decoder", () => {
    expect(gen3Decoder.boxes).toBe(gen3Boxes);
  });
});

describe("an empty block", () => {
  const boxes = decode();

  test("is 14 readable boxes of 30 null slots", () => {
    expect(boxes.boxes).toHaveLength(14);
    for (const [index, box] of boxes.boxes.entries()) {
      expect(box.index).toBe(index);
      expect(box.readable).toBe(true);
      expect(box.corruptSlots).toEqual([]);
      expect(box.slots).toHaveLength(30);
      expect(box.slots.every((slot) => slot === null)).toBe(true);
    }
  });

  test("validates against the API schema", () => {
    expect(Boxes.safeParse(boxes).success).toBe(true);
  });
});

describe("names, wallpapers and the current box", () => {
  test("names decode up to 8 characters", () => {
    const boxes = decode({ names: { 0: "BOX1", 13: "ABCDEFGH" } });
    expect(boxes.boxes[0]?.name).toBe("BOX1");
    expect(boxes.boxes[13]?.name).toBe("ABCDEFGH");
    expect(boxes.boxes[5]?.name).toBe("BOX6");
  });

  test("a name with no terminator stops at 8 characters", () => {
    const bytes = storageBytes();
    bytes.fill(0xbb, STORAGE.names, STORAGE.names + STORAGE.nameStride);
    const result = gen3Boxes.decode({ storage: new Bytes(bytes) }, ctx);
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.boxes[0]?.name).toHaveLength(8);
    expect(result.value.boxes[1]?.name).toBe("BOX2");
  });

  test("wallpapers are the game's index", () => {
    const boxes = decode({ wallpapers: { 0: 7, 1: 15, 2: 0 } });
    expect(boxes.boxes.slice(0, 3).map((box) => box.wallpaper)).toEqual([
      7, 15, 0,
    ]);
  });

  test("currentBox is the first byte", () => {
    expect(decode({ currentBox: 0 }).currentBox).toBe(0);
    expect(decode({ currentBox: 13 }).currentBox).toBe(13);
  });

  test("a currentBox past the last box makes every box unreadable", () => {
    const boxes = decode({ currentBox: 14 });
    expect(boxes).toEqual(unreadableBoxes());
    expect(decode({ currentBox: 0xff }).currentBox).toBeNull();
  });
});

describe("unreadable boxes", () => {
  test("are 14 with nothing known, and validate against the API schema", () => {
    const boxes = unreadableBoxes();
    expect(boxes.currentBox).toBeNull();
    expect(boxes.boxes).toHaveLength(14);
    for (const [index, box] of boxes.boxes.entries()) {
      expect(box).toEqual({
        index,
        name: null,
        wallpaper: null,
        readable: false,
        corruptSlots: [],
        slots: [],
      });
    }
    expect(Boxes.safeParse(boxes).success).toBe(true);
  });
});

describe("a boxed Pokémon", () => {
  const spec: Storage = { slots: { 2: { 7: encodeMon(treecko) } } };
  const mon = slotOf(2, 7, spec);

  test("sits at its box and slot, and no other slot holds one", () => {
    expect(mon?.species).toEqual({ id: TREECKO, dex: 252, name: "TREECKO" });
    const boxes = decode(spec);
    const filled = boxes.boxes.flatMap((box) =>
      box.slots.flatMap((slot, i) => (slot ? [[box.index, i]] : [])),
    );
    expect(filled).toEqual([[2, 7]]);
  });

  test("decodes the shared fields like a party Pokémon", () => {
    expect(mon?.nickname).toBe("LEAFY");
    expect(mon?.ot).toEqual({
      name: "BRENDAN",
      id: 12345,
      secretId: 6789,
      gender: "male",
    });
    expect(mon?.ivs).toEqual({
      hp: 31,
      atk: 30,
      def: 29,
      spe: 28,
      spa: 27,
      spd: 26,
    });
    expect(mon?.moves.map((m) => m.id)).toEqual([33, 52]);
    expect(mon?.nature).toBe(NATURES[0x108 % 25]);
  });

  test("hp, maxHp, stats and status are null", () => {
    expect(mon?.hp).toBeNull();
    expect(mon?.maxHp).toBeNull();
    expect(mon?.stats).toBeNull();
    expect(mon?.status).toBeNull();
  });

  test("level is computed from experience and the growth rate", () => {
    expect(mon?.experience).toBe(135);
    expect(mon?.level).toBe(5); // medium slow reaches level 5 at 135
    const level = (species: number, experience: number) =>
      slotOf(0, 0, {
        slots: { 0: { 0: encodeMon({ ...treecko, species, experience }) } },
      })?.level;
    expect(level(TREECKO, 134)).toBe(4);
    expect(level(PIKACHU, 125)).toBe(5); // medium fast: 5^3
    expect(level(PIKACHU, 124)).toBe(4);
    expect(level(SLOWPOKE_LINE, 1250000)).toBe(100); // slow: level 100
    expect(level(SLOWPOKE_LINE, 1249999)).toBe(99);
  });

  test("validates against the API schema", () => {
    expect(Boxes.safeParse(decode(spec)).success).toBe(true);
  });

  test("the stored level and HP past byte 80 are ignored", () => {
    const withParty = encodeMon({ ...treecko, level: 77, hp: 1, maxHp: 2 });
    expect(slotOf(0, 0, { slots: { 0: { 0: withParty } } })?.level).toBe(5);
  });
});

describe("eggs", () => {
  const egg: MonSpec = {
    ...treecko,
    isEgg: true,
    friendship: 20,
    experience: 125, // level 4 for medium slow, which reaches level 5 at 135
  };

  test("a boxed egg's level is computed like any other, and it keeps its egg fields", () => {
    const mon = slotOf(0, 3, { slots: { 0: { 3: encodeMon(egg) } } });
    expect(mon?.isEgg).toBe(true);
    expect(mon?.eggCycles).toBe(20);
    expect(mon?.nickname).toBeNull();
    expect(mon?.level).toBe(4);
  });
});

describe("empty and corrupt slots", () => {
  test("an all-zero slot is empty and not corrupt", () => {
    const boxes = decode({ slots: { 0: { 1: encodeMon(treecko) } } });
    expect(boxes.boxes[0]?.slots[0]).toBeNull();
    expect(boxes.boxes[0]?.corruptSlots).toEqual([]);
  });

  test("species 0 with a valid checksum is empty, as the game reads it", () => {
    const boxes = decode({
      slots: { 0: { 0: encodeMon({ ...treecko, species: 0 }) } },
    });
    expect(boxes.boxes[0]?.slots[0]).toBeNull();
    expect(boxes.boxes[0]?.corruptSlots).toEqual([]);
  });

  test("a bad checksum gives a null slot listed in corruptSlots", () => {
    const boxes = decode({
      slots: {
        4: {
          2: encodeMon({ ...treecko, checksumOffset: 1 }),
          5: encodeMon(treecko),
        },
      },
    });
    const box = boxes.boxes[4];
    expect(box?.slots[2]).toBeNull();
    expect(box?.corruptSlots).toEqual([2]);
    expect(box?.slots[5]?.species.id).toBe(TREECKO);
    expect(box?.readable).toBe(true);
    expect(boxes.boxes.filter((b) => b.corruptSlots.length > 0)).toHaveLength(
      1,
    );
  });

  test("a bad egg gives a null slot listed in corruptSlots", () => {
    const boxes = decode({
      slots: { 9: { 29: encodeMon({ ...treecko, flags: 0x03 }) } },
    });
    expect(boxes.boxes[9]?.slots[29]).toBeNull();
    expect(boxes.boxes[9]?.corruptSlots).toEqual([29]);
  });

  test("corruptSlots lists every bad slot in order, and validates against the schema", () => {
    const boxes = decode({
      slots: {
        0: {
          0: encodeMon({ ...treecko, checksumOffset: 1 }),
          10: encodeMon({ ...treecko, flags: 0x03 }),
          20: encodeMon({ ...treecko, checksumOffset: 9 }),
        },
      },
    });
    expect(boxes.boxes[0]?.corruptSlots).toEqual([0, 10, 20]);
    expect(Boxes.safeParse(boxes).success).toBe(true);
  });
});
