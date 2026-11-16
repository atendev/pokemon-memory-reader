import { expect, test } from "bun:test";
import { ErrorBody } from "@pokemon-memory-reader/api/schemas";
import { createApp } from "../../src/app/app";
import type { Resources } from "../../src/loop/read-loop";

const status = {
  state: "disconnected",
  adapter: null,
  rom: null,
  game: null,
} as const;

test("a failing handler answers 500 with the error body and the status", async () => {
  const resources: Resources = {
    status: () => status,
    get: () => Promise.reject(new Error("boom")),
  };
  const response = await createApp({ resources }).request("/api/v2/party");
  expect(response.status).toBe(500);
  const body = ErrorBody.parse(await response.json());
  expect(body.error.code).toBe("internal");
  expect(body.status.state).toBe("disconnected");
});
