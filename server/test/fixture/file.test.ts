import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  buildFixture,
  FIXTURE_MAX_BYTES,
  type FixtureMeta,
  loadFixture,
  parseFixture,
  SEQUENCE_MAX_BYTES,
  serializeFixture,
} from "../../src/fixture/file";

const SYNTHETIC = join(import.meta.dir, "synthetic", "emerald-us-1.0");

const meta: FixtureMeta = {
  profileId: "emerald-us-1.0",
  dataFormat: "gen3",
  emulator: { name: "mgba", version: "0.10.5" },
  adapter: "mgba",
  captureToolVersion: "2.0.0",
  captureDate: "2026-11-21T10:00:00.000Z",
  anonymized: false,
  description: "Two bytes of test memory.",
};
const ewram = {
  domain: "ewram",
  offset: 0x100,
  bytes: Uint8Array.of(1, 2),
} as const;

type Json = {
  regions: [Record<string, unknown>, ...Record<string, unknown>[]];
  [key: string]: unknown;
};

/** The fixture as JSON, edited by `change`, for the schema to judge. */
const edited = (change: (json: Json) => void): string => {
  const json = JSON.parse(serializeFixture(buildFixture(meta, [ewram])));
  change(json);
  return JSON.stringify(json);
};

describe("fixture file format", () => {
  test("a fixture round-trips through its text", () => {
    const fixture = buildFixture(meta, [
      ewram,
      { domain: "iwram", offset: 0, bytes: Uint8Array.of(255) },
    ]);
    const text = serializeFixture(fixture);
    expect(parseFixture(text)).toEqual(fixture);
    expect(serializeFixture(parseFixture(text))).toBe(text);
    expect(text.endsWith("}\n")).toBe(true);
  });

  test("the committed fixture is byte for byte what serializeFixture writes", async () => {
    const path = join(SYNTHETIC, "two-mon-party.fixture.json");
    expect(serializeFixture(await loadFixture(path))).toBe(
      await Bun.file(path).text(),
    );
  });

  test("build fills each region's length and sha256", () => {
    const [region] = buildFixture(meta, [ewram]).regions;
    expect(region?.length).toBe(2);
    expect(region?.sha256).toBe(
      "a12871fee210fb8619291eaea194581cbd2531e4b23759d225f6806923f63222",
    );
  });

  test("loads the committed synthetic fixture from disk", async () => {
    const fixture = await loadFixture(
      join(SYNTHETIC, "two-mon-party.fixture.json"),
    );
    expect(fixture.profileId).toBe("emerald-us-1.0");
    expect(fixture.regions.map((r) => r.domain)).toEqual(["ewram", "ewram"]);
  });

  test("a fixture with a region in the rom domain is rejected (the rule is the domain label)", () => {
    const text = edited((json) => {
      json.regions[0].domain = "rom";
    });
    expect(() => parseFixture(text, "trainers.fixture.json")).toThrow(
      /trainers\.fixture\.json[\s\S]*never holds ROM bytes/,
    );
    expect(() =>
      buildFixture(meta, [
        { domain: "rom", offset: 0x31c, bytes: Uint8Array.of(1, 2) },
      ]),
    ).toThrow(/never holds ROM bytes/);
  });

  test("a region whose bytes changed under its sha256 is rejected", () => {
    const text = edited((json) => {
      json.regions[0].bytes = Buffer.from([9, 9]).toString("base64");
    });
    expect(() => parseFixture(text)).toThrow(/sha256 does not match/);
  });

  test("a region whose length disagrees with its bytes is rejected", () => {
    const text = edited((json) => {
      json.regions[0].length = 3;
    });
    expect(() => parseFixture(text)).toThrow(
      /decode to 2 bytes but length says 3/,
    );
  });

  test("overlapping regions, unknown keys and bad JSON are rejected", () => {
    const overlap = edited((json) => {
      json.regions.push({ ...json.regions[0], offset: 0x101 });
    });
    expect(() => parseFixture(overlap)).toThrow(/overlaps region 0 in ewram/);
    expect(() =>
      parseFixture(
        edited((json) => {
          json.extra = 1;
        }),
      ),
    ).toThrow();
    expect(() => parseFixture("{", "x.json")).toThrow(/x\.json: not JSON/);
  });
});

describe("committed fixture sizes", () => {
  const caps: [string, number][] = [
    [".fixture.json", FIXTURE_MAX_BYTES],
    [".sequence.json", SEQUENCE_MAX_BYTES],
  ];
  test("every committed fixture and sequence file is within its cap", () => {
    const dirs = [
      join(import.meta.dir, "..", "fixtures"),
      join(import.meta.dir, "synthetic"),
    ];
    const walk = (dir: string): string[] => {
      let names: string[];
      try {
        names = readdirSync(dir);
      } catch {
        return [];
      }
      return names.flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    };
    for (const path of dirs.flatMap(walk)) {
      for (const [suffix, cap] of caps) {
        if (path.endsWith(suffix))
          expect(statSync(path).size).toBeLessThanOrEqual(cap);
      }
    }
  });
});
