import { expect, test } from "bun:test";
import { workspace } from "./placeholder";

test("the bridges workspace runs its tests", () => {
  expect(workspace).toBe("bridges");
});
