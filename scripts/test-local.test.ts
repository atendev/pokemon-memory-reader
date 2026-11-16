import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseLedger,
  rateSignatureEvidence,
} from "./generate-profiles/evidence";
import type { ShippedProfile } from "./generate-profiles/gate";
import {
  checkProfile,
  readBuiltinProfiles,
  romEnvName,
  run,
  signatureProblems,
  signedProfiles,
} from "./test-local";

const dir = mkdtempSync(join(tmpdir(), "test-local-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A ROM-shaped buffer of made-up bytes with the given words at ROM offsets. No real ROM is involved. */
function syntheticRom(seed: number, words: Record<number, string>): Buffer {
  const rom = Buffer.alloc(0x200, seed);
  for (const [offset, hex] of Object.entries(words))
    Buffer.from(hex, "hex").copy(rom, Number(offset));
  return rom;
}
const sha1Of = (rom: Buffer) => createHash("sha1").update(rom).digest("hex");

function profileFor(
  id: string,
  repo: string,
  rom: Buffer,
  signature = [
    { address: "0x080001bc", bytes: "cc033208" },
    { address: "0x080001cc", bytes: "98c83108" },
  ],
): ShippedProfile {
  return {
    id,
    name: id,
    kind: "official",
    identify: { sha1: [sha1Of(rom)], crc32: ["00000000"], signature },
    provenance: { kind: "pret", repo },
  } as ShippedProfile;
}

const GOOD = { 444: "cc033208", 460: "98c83108" };
const romA = syntheticRom(0x11, GOOD);
const romB = syntheticRom(0x22, GOOD);
const bad = syntheticRom(0x11, { 444: "cc033208", 460: "00000000" });

function writeRom(name: string, rom: Buffer): string {
  const path = join(dir, name);
  writeFileSync(path, rom);
  return path;
}

let ledgerPath = "";
let n = 0;
beforeEach(() => {
  ledgerPath = join(dir, `ledger-${n++}.json`);
  writeFileSync(ledgerPath, "[]\n");
});

const NOW = new Date("2026-11-16T12:00:00Z");
const lines = () => {
  const out: string[] = [];
  return { out, log: (line: string) => void out.push(line) };
};

describe("romEnvName", () => {
  test("turns a profile ID into an env var", () => {
    expect(romEnvName("emerald-us-1.0")).toBe("PMR_ROM_EMERALD_US_1_0");
  });
});

describe("signatureProblems", () => {
  const profile = signedProfiles([profileFor("a", "pret/x", romA)])[0];
  if (!profile) throw new Error("no signed profile");

  test("a matching ROM has none", () => {
    expect(signatureProblems(profile, romA)).toEqual([]);
  });

  test("names each word that differs", () => {
    expect(signatureProblems(profile, bad)).toEqual([
      "0x080001cc is 00000000, the profile says 98c83108",
    ]);
  });

  test("a ROM too short for a word fails", () => {
    expect(signatureProblems(profile, romA.subarray(0, 0x1c0))).toEqual([
      "0x080001cc is past the end of the ROM (448 bytes)",
    ]);
  });

  test("an address outside the GBA ROM fails", () => {
    const low = signedProfiles([
      profileFor("low", "pret/x", romA, [
        { address: "0x00000100", bytes: "00" },
      ]),
    ])[0];
    if (!low) throw new Error("no signed profile");
    expect(signatureProblems(low, romA)).toEqual([
      "0x00000100 is not a GBA ROM address",
    ]);
  });
});

describe("signedProfiles", () => {
  test("keeps official profiles with signature words only", () => {
    const signed = profileFor("a", "pret/x", romA);
    const none = profileFor("b", "pret/x", romA, []);
    const hack = { ...signed, id: "h", kind: "hack" } as ShippedProfile;
    expect(signedProfiles([signed, none, hack]).map((p) => p.id)).toEqual([
      "a",
    ]);
  });
});

describe("checkProfile", () => {
  const profile = signedProfiles([profileFor("a", "pret/x", romA)])[0];
  if (!profile) throw new Error("no signed profile");

  test("an unset env var is not run", async () => {
    expect(await checkProfile(profile, {})).toEqual({
      profileId: "a",
      repo: "pret/x",
      status: "not-run",
      env: "PMR_ROM_A",
    });
  });

  test("a set env var pointing at a missing file fails", async () => {
    const result = await checkProfile(profile, {
      PMR_ROM_A: join(dir, "missing.gba"),
    });
    expect(result.status).toBe("fail");
  });

  test("a ROM that isn't the profile's revision fails on its SHA-1", async () => {
    const other = writeRom("other.gba", syntheticRom(0x33, GOOD));
    const result = await checkProfile(profile, { PMR_ROM_A: other });
    expect(result.status).toBe("fail");
    expect(result.status === "fail" && result.problems[0]).toContain("SHA-1");
  });
});

describe("run", () => {
  test("a passing check prints pass and exits 0, leaving the ledger alone", async () => {
    const { out, log } = lines();
    const code = await run(
      [],
      {
        profiles: [profileFor("a", "pret/x", romA)],
        env: { PMR_ROM_A: writeRom("a.gba", romA) },
        ledgerPath,
      },
      log,
    );
    expect(code).toBe(0);
    expect(out).toEqual([
      `pass     a: signature matches the ROM (${sha1Of(romA)})`,
    ]);
    expect(readFileSync(ledgerPath, "utf8")).toBe("[]\n");
  });

  test("no ROM paths set prints not run lines and exits 0", async () => {
    const { out, log } = lines();
    const code = await run(
      ["--record"],
      { profiles: [profileFor("a", "pret/x", romA)], env: {}, ledgerPath },
      log,
    );
    expect(code).toBe(0);
    expect(out[0]).toBe("not run  a: PMR_ROM_A is not set");
    expect(readFileSync(ledgerPath, "utf8")).toBe("[]\n");
  });

  test("the committed built-in profiles are not run without ROM paths", async () => {
    const { out, log } = lines();
    const code = await run(
      [],
      { profiles: readBuiltinProfiles(), env: {}, ledgerPath },
      log,
    );
    expect(code).toBe(0);
    expect(out.join("\n")).toContain("not run  emerald-us-1.0");
  });

  test("a failing signature prints FAIL and exits 1", async () => {
    const { out, log } = lines();
    const profile = profileFor("a", "pret/x", bad);
    const code = await run(
      [],
      {
        profiles: [profile],
        env: { PMR_ROM_A: writeRom("bad.gba", bad) },
        ledgerPath,
      },
      log,
    );
    expect(code).toBe(1);
    expect(out[0]).toBe("FAIL     a:");
    expect(out[1]).toContain("0x080001cc");
  });

  test("an unknown argument exits 2", async () => {
    const { log } = lines();
    expect(
      await run(["--recrod"], { profiles: [], env: {}, ledgerPath }, log),
    ).toBe(2);
  });

  describe("--record", () => {
    const profiles = [profileFor("a", "pret/x", romA)];
    const env = () => ({ PMR_ROM_A: writeRom("a.gba", romA) });

    test("appends the passing check to the ledger and only the ledger", async () => {
      const { out, log } = lines();
      const code = await run(
        ["--record"],
        { profiles, env: env(), ledgerPath, now: NOW },
        log,
      );
      expect(code).toBe(0);
      expect(parseLedger(readFileSync(ledgerPath, "utf8"))).toEqual([
        { profileId: "a", sha1: sha1Of(romA), date: "2026-11-16" },
      ]);
      expect(out.at(-1)).toContain("ledger updated");
    });

    test("a second run with the same inputs gives no diff", async () => {
      const { out, log } = lines();
      const options = { profiles, env: env(), ledgerPath, now: NOW };
      await run(["--record"], options, log);
      const first = readFileSync(ledgerPath, "utf8");
      // A later day must not change the file either: the first entry for a profile and ROM stays.
      await run(
        ["--record"],
        { ...options, now: new Date("2026-12-01T00:00:00Z") },
        log,
      );
      expect(readFileSync(ledgerPath, "utf8")).toBe(first);
      expect(out.at(-1)).toBe("ledger unchanged");
    });

    test("a recorded check rates the profile owner", async () => {
      const { log } = lines();
      await run(
        ["--record"],
        { profiles, env: env(), ledgerPath, now: NOW },
        log,
      );
      const rated = rateSignatureEvidence(
        [{ id: "a", repo: "pret/x", sha1: [sha1Of(romA)] }],
        parseLedger(readFileSync(ledgerPath, "utf8")),
      );
      expect(rated.get("a")).toBe("owner");
    });

    test("a failed check records nothing for its repo, even a passing sibling", async () => {
      const { out, log } = lines();
      const sibling = profileFor("b", "pret/x", romB);
      const failing = profileFor("c", "pret/x", bad);
      const code = await run(
        ["--record"],
        {
          profiles: [profiles[0] as ShippedProfile, sibling, failing],
          env: {
            ...env(),
            PMR_ROM_B: writeRom("b.gba", romB),
            PMR_ROM_C: writeRom("c.gba", bad),
          },
          ledgerPath,
          now: NOW,
        },
        log,
      );
      expect(code).toBe(1);
      expect(readFileSync(ledgerPath, "utf8")).toBe("[]\n");
      expect(out.some((l) => l.startsWith("blocked  pret/x"))).toBe(true);
    });

    test("a later failing run never edits entries the ledger already holds", async () => {
      const { log } = lines();
      await run(
        ["--record"],
        { profiles, env: env(), ledgerPath, now: NOW },
        log,
      );
      const recorded = readFileSync(ledgerPath, "utf8");
      const code = await run(
        ["--record"],
        {
          profiles: [
            profileFor("c", "pret/x", bad),
            profileFor("b", "pret/x", romB),
            ...profiles,
          ],
          env: {
            ...env(),
            PMR_ROM_B: writeRom("b.gba", romB),
            PMR_ROM_C: writeRom("c.gba", bad),
          },
          ledgerPath,
          now: NOW,
        },
        log,
      );
      // "b" passes in the failing repo, so it would be appended if the block didn't hold.
      expect(code).toBe(1);
      expect(readFileSync(ledgerPath, "utf8")).toBe(recorded);
    });

    test("a failed check in one repo doesn't stop another repo recording", async () => {
      const { log } = lines();
      const other = profileFor("d", "pret/y", romB);
      const failing = profileFor("c", "pret/x", bad);
      const code = await run(
        ["--record"],
        {
          profiles: [failing, other],
          env: {
            PMR_ROM_C: writeRom("c.gba", bad),
            PMR_ROM_D: writeRom("d.gba", romB),
          },
          ledgerPath,
          now: NOW,
        },
        log,
      );
      expect(code).toBe(1);
      expect(parseLedger(readFileSync(ledgerPath, "utf8"))).toEqual([
        { profileId: "d", sha1: sha1Of(romB), date: "2026-11-16" },
      ]);
    });
  });
});
