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
    box: () => Promise.reject(new Error("boom")),
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
  box: () => Promise.reject(new Error("unused")),
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

test("GET /api/v2/battle serves the resource, and a 503 carries the status", async () => {
  const ok: Resources = {
    status: () => status,
    get: () =>
      Promise.resolve({
        ok: true,
        value: { active: false, lastBattle: null },
      } as never),
    box: () => Promise.reject(new Error("unused")),
  };
  const served = await createApp({ resources: ok }).request("/api/v2/battle");
  expect(served.status).toBe(200);
  expect(await served.json()).toEqual({ active: false, lastBattle: null });

  const refused: Resources = {
    status: () => status,
    get: () => Promise.resolve({ ok: false, code: "no_game", status }),
    box: () => Promise.reject(new Error("unused")),
  };
  const response = await createApp({ resources: refused }).request(
    "/api/v2/battle",
  );
  expect(response.status).toBe(503);
  expect(ErrorBody.parse(await response.json()).error.code).toBe("no_game");
});
