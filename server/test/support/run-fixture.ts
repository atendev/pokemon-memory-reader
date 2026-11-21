import { SliceAdapter } from "../../src/adapter/memory";
import { type FixtureFile, loadFixture } from "../../src/fixture/file";
import type { Regions, Slices } from "../../src/format/regions";
import type {
  DecodeContext,
  ResourceDecoder,
  Result,
} from "../../src/format/types";
import { runJob } from "../../src/loop/job";
import { PointerCache, readBatch } from "../../src/loop/plan";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import type { Profile } from "../../src/profile/schema";
import { referenceData } from "../../src/reference";

const loaded = loadProfiles({ builtin: [emerald], user: [] });

/** The Gen 3 profile a fixture names. Only the built-in Emerald profile is loaded so far. */
export function gen3Profile(id: string): Profile<"gen3"> {
  const profile = loaded.registry.get(id);
  if (profile?.dataFormat !== "gen3") throw new Error(`no Gen 3 profile ${id}`);
  return profile;
}

/** The decode context with the English reference data. The fixture has no ROM, so no ROM-table lookups are wired here yet (spec §12.2). */
export function gen3Context(
  profile: Profile<"gen3">,
): DecodeContext<Profile<"gen3">> {
  const reference = referenceData("gen3", "en");
  if (!reference) throw new Error("Gen 3 English reference data missing");
  return {
    profile,
    ...reference,
    names: { ...reference.names, locations: reference.locations("emerald") },
  };
}

/**
 * Runs one Gen 3 decoder part the way the read loop does: plan the batch, read it through a
 * SliceAdapter over the fixture, then decode the slices.
 */
export async function runFixturePart<R extends Regions, T>(
  fixture: FixtureFile,
  decoder: ResourceDecoder<Profile<"gen3">, R, T>,
): Promise<Result<T>> {
  const profile = gen3Profile(fixture.profileId);
  const adapter = new SliceAdapter(fixture);
  const regions = decoder.regions(profile);
  const cycle = await runJob(
    readBatch([regions], {
      mergeGap: adapter.limits.mergeGap,
      platform: "gba",
      pointers: new PointerCache(),
    }),
    (ranges) => adapter.read(ranges, 1000),
  );
  if (cycle.kind !== "sample")
    throw new Error(`no data: ${cycle.outcome.kind}`);
  const part = cycle.sample.slices(regions);
  if (!part.ok) throw new Error(`no slices: ${part.reason}`);
  return decoder.decode(part.slices as Slices<R>, gen3Context(profile));
}

export async function runFixtureFile<R extends Regions, T>(
  path: string,
  decoder: ResourceDecoder<Profile<"gen3">, R, T>,
): Promise<Result<T>> {
  return runFixturePart(await loadFixture(path), decoder);
}
