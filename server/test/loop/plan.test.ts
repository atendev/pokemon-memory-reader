import { describe, expect, test } from "bun:test";
import type { Domain } from "@pokemon-memory-reader/internal/memory";
import type { Range, ReadOutcome } from "../../src/adapter/types";
import type { Regions } from "../../src/format/regions";
import { runJob } from "../../src/loop/job";
import {
  type PartSlices,
  PointerCache,
  planBatch,
  readBatch,
} from "../../src/loop/plan";

const at = (domain: "ewram" | "iwram", offset: number, length: number) =>
  ({ kind: "static", at: { domain, offset }, length }) as const;

const options = () => ({
  mergeGap: 32,
  platform: "gba" as const,
  pointers: new PointerCache(),
});

describe("planBatch", () => {
  test("regions closer than the merge gap share one range", () => {
    const part: Regions = { a: at("ewram", 100, 10), b: at("ewram", 120, 10) };
    const plan = planBatch([part], options());
    expect(plan.ranges).toEqual([{ domain: "ewram", offset: 100, length: 30 }]);
  });

  test("regions further apart, or in another domain, stay separate", () => {
    const part: Regions = {
      a: at("ewram", 0, 10),
      b: at("ewram", 1000, 10),
      c: at("iwram", 0, 4),
    };
    const plan = planBatch([part], options());
    expect(plan.ranges).toHaveLength(3);
  });

  test("parts merge into one batch and slices come back by name", () => {
    const one: Regions = { a: at("ewram", 0, 4) };
    const two: Regions = { b: at("ewram", 8, 4) };
    const plan = planBatch([one, two], options());
    expect(plan.ranges).toEqual([{ domain: "ewram", offset: 0, length: 12 }]);
    const data = [Uint8Array.from({ length: 12 }, (_, i) => i)];
    const sliced = plan.sample(data).slices(two);
    const slice = sliced.ok ? sliced.slices.b : undefined;
    expect([slice?.length, slice?.u8(0), slice?.u8(3)]).toEqual([4, 8, 11]);
  });

  test("a failed range gives null for the parts it covers", () => {
    const part: Regions = { a: at("ewram", 0, 4) };
    const sample = planBatch([part], options()).sample([null]);
    expect(sample.slices(part)).toEqual({ ok: false, reason: "range_failed" });
  });
});

/** A pointer word at IWRAM 0x10 and 0x14, and a 4-byte region 8 bytes into whatever each points at. */
const BLOCK_PTR = { domain: "iwram", offset: 0x10 } as const;
const BOX_PTR = { domain: "iwram", offset: 0x14 } as const;
const pointer = (word: typeof BLOCK_PTR | typeof BOX_PTR) =>
  ({
    kind: "pointer",
    at: { at: word, width: 4, bank: null, offset: 8 },
    length: 4,
  }) as const;

const block: Regions = { header: at("iwram", 0, 4), body: pointer(BLOCK_PTR) };
const boxes: Regions = { body: pointer(BOX_PTR) };

/** Synthetic memory whose pointer words can be moved between cycles. */
class World {
  iwram = new Uint8Array(0x100);
  ewram = new Uint8Array(0x40000);
  reads: Range[][] = [];

  setPointer(word: { offset: number }, value: number): void {
    new DataView(this.iwram.buffer).setUint32(word.offset, value, true);
  }

  async read(ranges: readonly Range[]): Promise<ReadOutcome> {
    this.reads.push([...ranges]);
    const memory = { iwram: this.iwram, ewram: this.ewram } as Partial<
      Record<Domain, Uint8Array>
    >;
    return {
      kind: "data",
      slices: ranges.map((r) => {
        const bytes = memory[r.domain];
        return bytes && r.offset + r.length <= bytes.length
          ? bytes.slice(r.offset, r.offset + r.length)
          : null;
      }),
    };
  }
}

const cycle = async (
  world: World,
  parts: Regions[],
  pointers: PointerCache,
) => {
  const result = await runJob(
    readBatch(parts, { mergeGap: 32, platform: "gba", pointers }),
    (ranges) => world.read(ranges),
  );
  if (result.kind !== "sample") throw new Error("no sample");
  return parts.map((part) => result.sample.slices(part));
};

const body = (sliced: PartSlices | undefined) => {
  if (sliced === undefined) throw new Error("no part");
  return {
    ...sliced,
    value: sliced.ok ? sliced.slices.body?.u32le(0) : undefined,
  };
};

describe("pointer-derived regions", () => {
  test("an unknown pointer sends the words alone, then the batch, and the second reply is the sample", async () => {
    const world = new World();
    world.setPointer(BLOCK_PTR, 0x02001000);
    world.ewram.set([1, 2, 3, 4], 0x1008);
    const [sliced] = await cycle(world, [block], new PointerCache());
    expect(world.reads).toEqual([
      [{ domain: "iwram", offset: 0x10, length: 4 }],
      [
        { domain: "iwram", offset: 0, length: 0x14 },
        { domain: "ewram", offset: 0x1008, length: 4 },
      ],
    ]);
    expect(body(sliced)).toMatchObject({ ok: true });
    expect(body(sliced).value).toBe(0x04030201);
  });

  test("a known pointer sends one request", async () => {
    const world = new World();
    world.setPointer(BLOCK_PTR, 0x02001000);
    const pointers = new PointerCache();
    await cycle(world, [block], pointers);
    world.reads.length = 0;
    const [sliced] = await cycle(world, [block], pointers);
    expect(world.reads).toHaveLength(1);
    expect(body(sliced).ok).toBe(true);
  });

  test("a pointer that moved drops its results that cycle and the next cycle reads the new address", async () => {
    const world = new World();
    world.setPointer(BLOCK_PTR, 0x02001000);
    world.ewram.set([1, 1, 1, 1], 0x1008);
    world.ewram.set([2, 2, 2, 2], 0x2008);
    const pointers = new PointerCache();
    await cycle(world, [block], pointers);

    world.setPointer(BLOCK_PTR, 0x02002000);
    const [stale] = await cycle(world, [block], pointers);
    expect(body(stale)).toMatchObject({ ok: false, reason: "pointer_moved" });

    world.reads.length = 0;
    const [fresh] = await cycle(world, [block], pointers);
    expect(world.reads).toHaveLength(1);
    expect(body(fresh).value).toBe(0x02020202);
  });

  test("a null pointer fails only the parts that use it, and the others still decode", async () => {
    const world = new World();
    world.setPointer(BLOCK_PTR, 0x02001000);
    world.setPointer(BOX_PTR, 0);
    world.ewram.set([9, 9, 9, 9], 0x1008);
    const pointers = new PointerCache();
    const [ok, nulled] = await cycle(world, [block, boxes], pointers);
    expect(body(ok).ok).toBe(true);
    expect(body(nulled)).toMatchObject({ ok: false, reason: "null_pointer" });

    const [again, still] = await cycle(world, [block, boxes], pointers);
    expect(world.reads.at(-1)?.some((r) => r.domain === "ewram")).toBe(true);
    expect(body(again).ok).toBe(true);
    expect(body(still)).toMatchObject({ ok: false, reason: "null_pointer" });
  });

  test("a null pointer that becomes valid is read from the next cycle", async () => {
    const world = new World();
    world.setPointer(BOX_PTR, 0);
    const pointers = new PointerCache();
    await cycle(world, [boxes], pointers);
    world.setPointer(BOX_PTR, 0x02003000);
    world.ewram.set([5, 0, 0, 0], 0x3008);
    const [moved] = await cycle(world, [boxes], pointers);
    expect(body(moved).ok).toBe(false);
    const [fresh] = await cycle(world, [boxes], pointers);
    expect(body(fresh).value).toBe(5);
  });

  test("an unmapped pointer value fails like a null one", async () => {
    const world = new World();
    world.setPointer(BLOCK_PTR, 0xdeadbeef);
    const [sliced] = await cycle(world, [block], new PointerCache());
    expect(body(sliced)).toMatchObject({ ok: false, reason: "null_pointer" });
  });

  test("a pointer target outside the domain fails only its part", async () => {
    const world = new World();
    world.setPointer(BLOCK_PTR, 0x0203fffc);
    const [sliced] = await cycle(world, [block], new PointerCache());
    expect(body(sliced)).toMatchObject({ ok: false, reason: "range_failed" });
  });

  test("a timeout on the pointer words ends the job with no sample", async () => {
    const result = await runJob(readBatch([block], options()), async () => ({
      kind: "timeout",
    }));
    expect(result).toEqual({ kind: "no_data", outcome: { kind: "timeout" } });
  });

  test("a pointer aimed outside its domain doesn't fail a static region next to it", async () => {
    const world = new World();
    // The target lands at EWRAM 0x40004 once the offset is added, past the end of the 0x40000-byte domain.
    world.setPointer(BOX_PTR, 0x0203fffc);
    world.ewram.set([4, 3, 2, 1], 0x3fff0);
    const tail: Regions = { tail: at("ewram", 0x3fff0, 8) };
    const pointers = new PointerCache();
    await cycle(world, [tail, boxes], pointers);
    const [fine, bad] = await cycle(world, [tail, boxes], pointers);
    expect(fine?.ok && fine.slices.tail?.u32le(0)).toBe(0x01020304);
    expect(bad).toEqual({ ok: false, reason: "range_failed" });
  });

  test("the box request keeps its own cache: its pointer is read first, and its moves don't touch the main one", async () => {
    const world = new World();
    world.setPointer(BLOCK_PTR, 0x02001000);
    world.setPointer(BOX_PTR, 0x02003000);
    world.ewram.set([7, 0, 0, 0], 0x3008);
    const main = new PointerCache();
    const box = new PointerCache();
    await cycle(world, [block], main);

    world.reads.length = 0;
    const [first] = await cycle(world, [boxes], box);
    expect(world.reads[0]).toEqual([
      { domain: "iwram", offset: 0x14, length: 4 },
    ]);
    expect(world.reads).toHaveLength(2);
    expect(body(first).value).toBe(7);

    world.setPointer(BOX_PTR, 0x02004000);
    world.reads.length = 0;
    const [stale] = await cycle(world, [boxes], box);
    expect(body(stale)).toMatchObject({ ok: false, reason: "pointer_moved" });
    const [main2] = await cycle(world, [block], main);
    expect(world.reads).toHaveLength(2);
    expect(body(main2).ok).toBe(true);
  });
});
