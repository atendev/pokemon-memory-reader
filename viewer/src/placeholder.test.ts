import { expect, test } from "bun:test";
import { workspace } from "./placeholder";

test("the viewer workspace runs its tests", () => {
  expect(workspace).toBe("viewer");
});
