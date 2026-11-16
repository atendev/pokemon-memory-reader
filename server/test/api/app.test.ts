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

const idle: Resources = {
  status: () => status,
  get: () => Promise.reject(new Error("unused")),
};

test("a bridge is served by name as text", async () => {
  const app = createApp({ resources: idle, bridges: { mgba: "-- mgba" } });
  const response = await app.request("/bridges/mgba.lua");
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toContain("text/plain");
  expect(await response.text()).toBe("-- mgba");
});

test.each([
  "/bridges/bizhawk.lua",
  "/bridges/mgba",
  "/bridges/mgba.txt",
  "/bridges/..%2Fpackage.json",
  "/bridges/%2e%2e%2f%2e%2e%2fetc%2fpasswd.lua",
  "/bridges/constructor.lua",
])("%s is a 404", async (path) => {
  const app = createApp({ resources: idle, bridges: { mgba: "-- mgba" } });
  expect((await app.request(path)).status).toBe(404);
});

test("without bridges the route answers 404", async () => {
  expect(
    (await createApp({ resources: idle }).request("/bridges/mgba.lua")).status,
  ).toBe(404);
});
