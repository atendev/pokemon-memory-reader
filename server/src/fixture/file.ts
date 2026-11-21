import { createHash } from "node:crypto";
import { DOMAINS, type Domain } from "@pokemon-memory-reader/internal/memory";
import { z } from "zod";
import { DATA_FORMATS } from "../profile/schema";

/** A default-suite test caps a fixture file at this many bytes and a sequence file at the second (spec §12.1). */
export const FIXTURE_MAX_BYTES = 256 * 1024;
export const SEQUENCE_MAX_BYTES = 1024 * 1024;

const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const toBase64 = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString("base64");

const fromBase64 = (text: string): Uint8Array =>
  new Uint8Array(Buffer.from(text, "base64"));

const region = z
  .object({
    domain: z.enum(DOMAINS).refine((domain) => domain !== "rom", {
      error:
        "a fixture never holds ROM bytes, so no region may use the rom domain (spec §12.2)",
    }),
    offset: z.number().int().nonnegative(),
    length: z.number().int().positive(),
    sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/, "sha256 is 64 lowercase hex digits"),
    bytes: z.base64(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const bytes = fromBase64(value.bytes);
    if (bytes.length !== value.length) {
      ctx.addIssue({
        code: "custom",
        path: ["bytes"],
        message: `bytes decode to ${bytes.length} bytes but length says ${value.length}`,
      });
    } else if (sha256(bytes) !== value.sha256) {
      ctx.addIssue({
        code: "custom",
        path: ["sha256"],
        message: "sha256 does not match the bytes",
      });
    }
  });

/** The metadata of spec §12.1 and the recorded regions. Regions use logical domains (§3.2), never emulator addresses. */
export const FixtureFile = z
  .object({
    profileId: z.string().min(1),
    dataFormat: z.enum(DATA_FORMATS),
    emulator: z
      .object({
        name: z.string().min(1),
        version: z.string().min(1).nullable(),
      })
      .strict(),
    adapter: z.string().min(1),
    captureToolVersion: z.string().min(1),
    captureDate: z.iso.datetime(),
    anonymized: z.boolean(),
    description: z.string(),
    regions: z.array(region).min(1),
  })
  .strict()
  .superRefine((fixture, ctx) => {
    const byDomain = Map.groupBy(
      fixture.regions.map((r, index) => ({ ...r, index })),
      (r) => r.domain,
    );
    for (const regions of byDomain.values()) {
      const sorted = [...regions].sort((a, b) => a.offset - b.offset);
      for (let i = 1; i < sorted.length; i++) {
        const before = sorted[i - 1];
        const after = sorted[i];
        if (before && after && after.offset < before.offset + before.length) {
          ctx.addIssue({
            code: "custom",
            path: ["regions", after.index],
            message: `overlaps region ${before.index} in ${after.domain}`,
          });
        }
      }
    }
  });
export type FixtureFile = z.infer<typeof FixtureFile>;

/** A region as the SliceAdapter serves it: decoded bytes at a domain offset. */
export interface RecordedRegion {
  readonly domain: Domain;
  readonly offset: number;
  readonly bytes: Uint8Array;
}

/** Checks `text` against the fixture schema. The error names the source and every problem. */
export function parseFixture(text: string, source = "fixture"): FixtureFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`${source}: not JSON (${(error as Error).message})`);
  }
  const parsed = FixtureFile.safeParse(json);
  if (!parsed.success) {
    throw new Error(`${source}:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export async function loadFixture(path: string): Promise<FixtureFile> {
  return parseFixture(await Bun.file(path).text(), path);
}

/** The file text: two-space JSON and a trailing newline, so a recapture diffs by region. */
export function serializeFixture(fixture: FixtureFile): string {
  return `${JSON.stringify(FixtureFile.parse(fixture), null, 2)}\n`;
}

export type FixtureMeta = Omit<FixtureFile, "regions">;

/** Builds a fixture from recorded slices, filling each region's length and sha256. */
export function buildFixture(
  meta: FixtureMeta,
  slices: readonly RecordedRegion[],
): FixtureFile {
  return FixtureFile.parse({
    ...meta,
    regions: slices.map(({ domain, offset, bytes }) => ({
      domain,
      offset,
      length: bytes.length,
      sha256: sha256(bytes),
      bytes: toBase64(bytes),
    })),
  });
}

export function recordedRegions(fixture: FixtureFile): RecordedRegion[] {
  return fixture.regions.map(({ domain, offset, bytes }) => ({
    domain,
    offset,
    bytes: fromBase64(bytes),
  }));
}
