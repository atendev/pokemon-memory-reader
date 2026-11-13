import { expect, test } from "bun:test";
import { API_BASE_PATH } from "@pokemon-memory-reader/api/client";
import { APP_VERSION } from "./version";

test("the app version is a v2 semver version", () => {
  expect(APP_VERSION).toMatch(/^2\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
});

test("the API package resolves from source", () => {
  expect(API_BASE_PATH).toBe("/api/v2");
});
