import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ShippedProfile } from "./generate-profiles/gate";
import { recordSignatureCheck } from "./generate-profiles/record";

const BUILTIN = join(import.meta.dir, "../server/src/profile/builtin");
const LEDGER = join(import.meta.dir, "generate-profiles/signature-ledger.json");
const GBA_ROM_BASE = 0x08000000;
const GBA_ROM_END = 0x0e000000;

interface SignatureWord {
  readonly address: string;
  readonly bytes: string;
}

type SignedProfile = ShippedProfile & {
  readonly identify: {
    readonly signature: readonly SignatureWord[];
  } & NonNullable<ShippedProfile["identify"]>;
};

/** `emerald-us-1.0` reads its ROM path from `PMR_ROM_EMERALD_US_1_0`. */
export function romEnvName(profileId: string): string {
  return `PMR_ROM_${profileId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}

/** The official profiles that declare signature words, which are the ones `test:local` can check. */
export function signedProfiles(
  profiles: readonly ShippedProfile[],
): SignedProfile[] {
  return profiles.filter(
    (p): p is SignedProfile =>
      p.kind === "official" && (p.identify?.signature?.length ?? 0) > 0,
  );
}

/** Spec §5.4: each signature word is the little-endian bytes at its ROM address. Returns one message per word that doesn't match. */
export function signatureProblems(
  profile: SignedProfile,
  rom: Uint8Array,
): string[] {
  const problems: string[] = [];
  for (const word of profile.identify.signature) {
    const address = Number.parseInt(word.address, 16);
    const length = word.bytes.length / 2;
    if (
      !Number.isInteger(address) ||
      address < GBA_ROM_BASE ||
      address >= GBA_ROM_END
    ) {
      problems.push(`${word.address} is not a GBA ROM address`);
      continue;
    }
    const offset = address - GBA_ROM_BASE;
    if (offset + length > rom.length) {
      problems.push(
        `${word.address} is past the end of the ROM (${rom.length} bytes)`,
      );
      continue;
    }
    const found = Buffer.from(rom.subarray(offset, offset + length)).toString(
      "hex",
    );
    if (found !== word.bytes.toLowerCase())
      problems.push(
        `${word.address} is ${found}, the profile says ${word.bytes}`,
      );
  }
  return problems;
}

export type CheckResult =
  | {
      readonly profileId: string;
      readonly repo: string;
      readonly status: "not-run";
      readonly env: string;
    }
  | {
      readonly profileId: string;
      readonly repo: string;
      readonly status: "pass";
      readonly sha1: string;
    }
  | {
      readonly profileId: string;
      readonly repo: string;
      readonly status: "fail";
      readonly problems: string[];
    };

/**
 * Spec §12.9: an unset env var is "not run", and a set one pointing at a missing file fails. The ROM must also
 * hash to one of the profile's SHA-1s, so a check never passes on a hack or a different revision.
 */
export async function checkProfile(
  profile: SignedProfile,
  env: Readonly<Record<string, string | undefined>>,
  read: (path: string) => Promise<Uint8Array> = readFile,
): Promise<CheckResult> {
  const repo = profile.provenance?.repo ?? "";
  const name = romEnvName(profile.id);
  const path = env[name];
  if (path === undefined || path === "")
    return { profileId: profile.id, repo, status: "not-run", env: name };
  const fail = (...problems: string[]): CheckResult => ({
    profileId: profile.id,
    repo,
    status: "fail",
    problems,
  });
  let rom: Uint8Array;
  try {
    rom = await read(path);
  } catch (error) {
    return fail(
      `${name} is set but ${path} can't be read: ${(error as Error).message}`,
    );
  }
  const sha1 = createHash("sha1").update(rom).digest("hex");
  if (!profile.identify.sha1.includes(sha1))
    return fail(
      `the ROM's SHA-1 ${sha1} is not one of the profile's identify.sha1 values, so it is not this retail revision`,
    );
  const problems = signatureProblems(profile, rom);
  return problems.length > 0
    ? fail(...problems)
    : { profileId: profile.id, repo, status: "pass", sha1 };
}

export interface RunOptions {
  readonly profiles: readonly ShippedProfile[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly ledgerPath: string;
  readonly now?: Date;
  readonly read?: (path: string) => Promise<Uint8Array>;
}

/**
 * Runs the signature check for every signed official profile. Returns the exit code: 0 when nothing failed
 * (profiles with no ROM are "not run"), 1 when any check failed, 2 on a bad argument.
 *
 * `--record` writes passing checks to the ledger through `recordSignatureCheck` and touches nothing else.
 * One failed check blocks its whole pret repo (amendment 022 item 7), so no entry is recorded for that repo
 * on the run. Other repos still record.
 */
export async function run(
  args: readonly string[],
  options: RunOptions,
  log: (line: string) => void,
): Promise<number> {
  const unknown = args.filter((a) => a !== "--record");
  if (unknown.length > 0) {
    log(
      `Unknown argument ${unknown.join(" ")}. Usage: bun run test:local [--record]`,
    );
    return 2;
  }
  const record = args.includes("--record");
  const results: CheckResult[] = [];
  for (const profile of signedProfiles(options.profiles))
    results.push(await checkProfile(profile, options.env, options.read));

  for (const r of results) {
    if (r.status === "not-run")
      log(`not run  ${r.profileId}: ${r.env} is not set`);
    else if (r.status === "pass")
      log(`pass     ${r.profileId}: signature matches the ROM (${r.sha1})`);
    else {
      log(`FAIL     ${r.profileId}:`);
      for (const problem of r.problems) log(`           ${problem}`);
    }
  }

  const failedRepos = new Set(
    results.filter((r) => r.status === "fail").map((r) => r.repo),
  );
  for (const repo of failedRepos)
    log(
      `blocked  ${repo || "(no repo)"}: a failed owner check blocks every profile from this repo until the generator's mapping is fixed`,
    );

  if (record) {
    const before = existsSync(options.ledgerPath)
      ? readFileSync(options.ledgerPath, "utf8")
      : "";
    for (const r of results)
      if (r.status === "pass" && !failedRepos.has(r.repo))
        await recordSignatureCheck(
          options.ledgerPath,
          { profileId: r.profileId, sha1: r.sha1 },
          options.now,
        );
    const after = existsSync(options.ledgerPath)
      ? readFileSync(options.ledgerPath, "utf8")
      : "";
    log(
      after === before
        ? "ledger unchanged"
        : "ledger updated. Run `bun run generate:profiles` and commit the result.",
    );
  }
  return failedRepos.size > 0 || results.some((r) => r.status === "fail")
    ? 1
    : 0;
}

/** The profile files the server ships, read the way the release gate reads them. */
export function readBuiltinProfiles(dir: string = BUILTIN): ShippedProfile[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")));
}

if (import.meta.main) {
  process.exit(
    await run(
      process.argv.slice(2),
      { profiles: readBuiltinProfiles(), env: process.env, ledgerPath: LEDGER },
      console.log,
    ),
  );
}
