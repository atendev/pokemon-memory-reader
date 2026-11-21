import { describe, expect, test } from "bun:test";
import { bindGame } from "../../src/format/registry";
import {
  assumeSupported,
  isSupported,
  SUPPORTED,
} from "../../src/format/support";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import { ALL_SUPPORTED } from "../support/supported";

const profile = loadProfiles({ builtin: [emerald], user: [] }).registry.get(
  "emerald-us-1.0",
);
if (profile === undefined) throw new Error("emerald-us-1.0 isn't built in");

describe("the supported flag on the game binding", () => {
  test("a supported format binds its decoders", () => {
    const bound = bindGame(profile, ALL_SUPPORTED);
    expect(bound.supported).toBe(true);
    expect(bound.party).toBeDefined();
    expect(bound.battle).toBeDefined();
  });

  test("an unsupported format binds nothing and says so", () => {
    expect(bindGame(profile, { ...ALL_SUPPORTED, gen3: false })).toEqual({
      supported: false,
    });
    expect(bindGame(profile)).toEqual({ supported: false });
  });

  test("a data format this build doesn't know is unsupported", () => {
    expect(isSupported(ALL_SUPPORTED, "gen9")).toBe(false);
    expect(isSupported(SUPPORTED, "gen3")).toBe(false);
  });
});

describe("PMR_ASSUME_SUPPORTED", () => {
  test("turns the named formats on and reports names it doesn't know", () => {
    const { flags, assumed, unknown } = assumeSupported(" gen3, gen9 ,");
    expect(flags).toEqual({ ...SUPPORTED, gen3: true });
    expect(assumed).toEqual(["gen3"]);
    expect(unknown).toEqual(["gen9"]);
  });

  test("leaves the committed flags alone when unset", () => {
    expect(assumeSupported(undefined).flags).toEqual(SUPPORTED);
    expect(assumeSupported("").assumed).toEqual([]);
  });
});
