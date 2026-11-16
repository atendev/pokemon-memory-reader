import { describe, expect, test } from "bun:test";
import type { Regions } from "../../src/format/regions";
import { planBatch } from "../../src/loop/plan";

const at = (domain: "ewram" | "iwram", offset: number, length: number) =>
  ({ kind: "static", at: { domain, offset }, length }) as const;

describe("planBatch", () => {
  test("regions closer than the merge gap share one range", () => {
    const part: Regions = { a: at("ewram", 100, 10), b: at("ewram", 120, 10) };
    const plan = planBatch([part], 32);
    expect(plan.ranges).toEqual([{ domain: "ewram", offset: 100, length: 30 }]);
  });

  test("regions further apart, or in another domain, stay separate", () => {
    const part: Regions = {
      a: at("ewram", 0, 10),
      b: at("ewram", 1000, 10),
      c: at("iwram", 0, 4),
    };
    const plan = planBatch([part], 32);
    expect(plan.ranges).toHaveLength(3);
  });

  test("parts merge into one batch and slices come back by name", () => {
    const one: Regions = { a: at("ewram", 0, 4) };
    const two: Regions = { b: at("ewram", 8, 4) };
    const plan = planBatch([one, two], 32);
    expect(plan.ranges).toEqual([{ domain: "ewram", offset: 0, length: 12 }]);
    const data = [Uint8Array.from({ length: 12 }, (_, i) => i)];
    const slice = plan.slices(two, data)?.b;
    expect([slice?.length, slice?.u8(0), slice?.u8(3)]).toEqual([4, 8, 11]);
  });

  test("a failed range gives null for the parts it covers", () => {
    const part: Regions = { a: at("ewram", 0, 4) };
    expect(planBatch([part], 32).slices(part, [null])).toBeNull();
  });
});
