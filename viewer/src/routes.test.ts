import { describe, expect, test } from "bun:test";
import { hrefFor, routeFromHash, SCREENS } from "./routes";

describe("hash routes", () => {
  test("an empty hash and #/ open Party", () => {
    expect(routeFromHash("")).toBe("party");
    expect(routeFromHash("#")).toBe("party");
    expect(routeFromHash("#/")).toBe("party");
  });

  test("every screen's own link parses back to it, so a reload lands on the same screen", () => {
    for (const screen of SCREENS) {
      expect(routeFromHash(hrefFor(screen.id))).toBe(screen.id);
    }
    expect(routeFromHash(hrefFor("about"))).toBe("about");
  });

  test("a hash query and a trailing slash don't change the route (amendment 021 item 2)", () => {
    expect(routeFromHash("#/battle?showUnrevealed=1")).toBe("battle");
    expect(routeFromHash("#/settings/")).toBe("settings");
  });

  test("a path that names no screen is not_found", () => {
    expect(routeFromHash("#/nope")).toBe("not_found");
    expect(routeFromHash("#/party/extra")).toBe("not_found");
  });
});
