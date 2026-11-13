import { expect, test } from "bun:test";
import { workspace } from "./placeholder";

test("the internal workspace runs its tests", () => {
  expect(workspace).toBe("internal");
});
