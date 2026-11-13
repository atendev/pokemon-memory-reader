import { expect, test } from "bun:test";
import { API_BASE_PATH, API_VERSION } from "./client";

test("the base path carries the API version", () => {
  expect(API_VERSION).toBe(2);
  expect(API_BASE_PATH).toBe("/api/v2");
});
