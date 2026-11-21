import { join } from "node:path";
import { SUPPORTED } from "../../src/format/support";
import { builtinProfiles } from "../../src/profile/builtin";
import { REQUIRED_STATES } from "../fixtures/coverage";
import {
  type CoverageInputs,
  checkCoverage,
  type ProfileInfo,
  renderCoverage,
  scanFixtures,
} from "./coverage-guard";

export const FIXTURES_ROOT = join(import.meta.dir, "../fixtures");
export const COVERAGE_DOC = join(import.meta.dir, "../../../docs/coverage.md");

/** The built-in profiles, as the guard reads them. */
export function builtinProfileInfo(): ProfileInfo[] {
  return (
    builtinProfiles as readonly {
      id: string;
      dataFormat: string;
      fixture: ProfileInfo["fixture"];
    }[]
  ).map(({ id, dataFormat, fixture }) => ({ id, dataFormat, fixture }));
}

/** The committed flags, the built-in profiles and the fixture folders under `server/test/fixtures`. */
export async function repoCoverageInputs(): Promise<CoverageInputs> {
  return {
    index: await scanFixtures(FIXTURES_ROOT),
    profiles: builtinProfileInfo(),
    support: SUPPORTED,
  };
}

export async function repoCoverage() {
  const inputs = await repoCoverageInputs();
  return {
    report: checkCoverage(inputs),
    doc: renderCoverage({ ...inputs, states: REQUIRED_STATES }),
  };
}
