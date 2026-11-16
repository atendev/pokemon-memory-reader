import { describe, expect, test } from "bun:test";
import { BRIDGE_CAPS } from "../adapter/bridge/constants";
import { type Region, region } from "../format/regions";
import { checkRequestCaps } from "./caps";

const part = (regions: Record<string, Region>) => [{ part: "p", regions }];
const ewram = (offset: number, length: number) =>
  region({ domain: "ewram", offset }, length);
const rom = (offset: number, length: number) =>
  region({ domain: "rom", offset }, length);

describe("checkRequestCaps", () => {
  test("a request inside both caps passes, and an empty one passes", () => {
    expect(
      checkRequestCaps("main batch", part({ a: ewram(0, 600) }), BRIDGE_CAPS),
    ).toBeNull();
    expect(checkRequestCaps("box request", [], BRIDGE_CAPS)).toBeNull();
  });

  test("bytes add the merge gap once per possible merge", () => {
    // Two ranges: 65536 - 32 bytes fits exactly, one more byte does not.
    const fits = part({
      a: ewram(0, 32000),
      b: ewram(100000, 65536 - 32000 - BRIDGE_CAPS.mergeGap),
    });
    expect(checkRequestCaps("main batch", fits, BRIDGE_CAPS)).toBeNull();
    const over = part({
      a: ewram(0, 32000),
      b: ewram(100000, 65536 - 32000 - BRIDGE_CAPS.mergeGap + 1),
    });
    expect(checkRequestCaps("main batch", over, BRIDGE_CAPS)).toContain(
      "main batch needs 2 ranges and up to 65537 bytes",
    );
  });

  test("512 ranges pass and 513 fail, naming the largest region and both caps", () => {
    const many = (count: number) =>
      part(
        Object.fromEntries(
          Array.from({ length: count }, (_, i) => [`r${i}`, ewram(i * 64, 1)]),
        ),
      );
    expect(checkRequestCaps("main batch", many(512), BRIDGE_CAPS)).toBeNull();
    const message = checkRequestCaps("main batch", many(513), BRIDGE_CAPS);
    expect(message).toContain("513 ranges");
    expect(message).toContain("512 ranges and 65536 bytes");
    expect(message).toContain("largest region p.r0");
  });

  test("a pointer region counts its pointer word and its target", () => {
    const pointer = region(
      {
        at: { domain: "iwram", offset: 0x10 },
        width: 4,
        bank: null,
        offset: 0,
      },
      65500,
    );
    // 65500 + 4 + one gap of 32 is exactly 65536; one more byte of target does not fit.
    expect(
      checkRequestCaps("main batch", part({ box: pointer }), BRIDGE_CAPS),
    ).toBeNull();
    const big = region(
      {
        at: { domain: "iwram", offset: 0x10 },
        width: 4,
        bank: null,
        offset: 0,
      },
      65501,
    );
    const message = checkRequestCaps(
      "box request",
      part({ box: big }),
      BRIDGE_CAPS,
    );
    expect(message).toContain(
      "box request needs 2 ranges and up to 65537 bytes",
    );
  });

  test("a rom range over the byte cap is left out, a smaller one counts", () => {
    expect(
      checkRequestCaps(
        "main batch",
        part({ whole: rom(0, 1_000_000), small: ewram(0, 10) }),
        BRIDGE_CAPS,
      ),
    ).toBeNull();
    expect(
      checkRequestCaps(
        "main batch",
        part({ table: rom(0, 65536), more: ewram(0, 1) }),
        BRIDGE_CAPS,
      ),
    ).toContain("65569 bytes");
  });
});
