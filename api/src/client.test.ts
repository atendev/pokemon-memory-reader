import { describe, expect, test } from "bun:test";
import { API_BASE_PATH, API_VERSION } from "./client";

test("the base path carries the API version", () => {
  expect(API_VERSION).toBe(2);
  expect(API_BASE_PATH).toBe("/api/v2");
});

import { get, getParty, getStatus, PmrApiError } from "./client";
import type { StatusResource } from "./schemas";

const STATUS: StatusResource = {
  state: "no_game",
  adapter: null,
  rom: null,
  game: null,
};

function respond(
  status: number,
  body: unknown,
  seen: string[] = [],
): typeof fetch {
  return (async (input: string | URL | Request) => {
    seen.push(String(input));
    return new Response(
      typeof body === "string" ? body : JSON.stringify(body),
      {
        status,
      },
    );
  }) as typeof fetch;
}

describe("get helpers", () => {
  test("fetch the resource under the base URL and return the parsed body", async () => {
    const seen: string[] = [];
    const status = await getStatus({
      baseUrl: "http://pmr.test",
      fetch: respond(200, STATUS, seen),
    });
    expect(status).toEqual(STATUS);
    expect(seen).toEqual(["http://pmr.test/api/v2/status"]);
  });

  test("an empty base URL gives a path relative to the page", async () => {
    const seen: string[] = [];
    await getParty({
      baseUrl: "",
      fetch: respond(200, { pokemon: [] }, seen),
    });
    expect(seen).toEqual(["/api/v2/party"]);
  });

  test("a 503 body becomes an unavailable error with its code and status", async () => {
    const error = await get("party", {
      fetch: respond(503, {
        error: { code: "no_game", message: "No game." },
        status: STATUS,
      }),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PmrApiError);
    const api = error as PmrApiError;
    expect(api.kind).toBe("unavailable");
    expect(api.code).toBe("no_game");
    expect(api.httpStatus).toBe(503);
    expect(api.status).toEqual(STATUS);
  });

  test.each([
    [
      "a 404",
      404,
      { error: { code: "not_found", message: "x" }, status: STATUS },
    ],
    ["a 503 without the error body", 503, "upstream down"],
    ["a 500", 500, ""],
  ])("%s becomes an http error", async (_name, status, body) => {
    const error = (await get("party", { fetch: respond(status, body) }).catch(
      (e: unknown) => e,
    )) as PmrApiError;
    expect(error.kind).toBe("http");
    expect(error.httpStatus).toBe(status);
    expect(error.code).toBeNull();
  });

  test("a failed fetch becomes a network error that keeps the cause", async () => {
    const cause = new TypeError("connection refused");
    const error = (await getStatus({
      fetch: (() => Promise.reject(cause)) as unknown as typeof fetch,
    }).catch((e: unknown) => e)) as PmrApiError;
    expect(error.kind).toBe("network");
    expect(error.httpStatus).toBeNull();
    expect(error.cause).toBe(cause);
  });
});

describe("get with validate", () => {
  test("passes a good answer through", async () => {
    const status = await getStatus({
      validate: true,
      fetch: respond(200, STATUS),
    });
    expect(status).toEqual(STATUS);
  });

  test("reports a bad answer as an invalid error that keeps the Zod error", async () => {
    const error = (await getParty({
      validate: true,
      fetch: respond(200, { pokemon: "none" }),
    }).catch((e: unknown) => e)) as PmrApiError;
    expect(error).toBeInstanceOf(PmrApiError);
    expect(error.kind).toBe("invalid");
    expect(error.httpStatus).toBe(200);
    expect(error.code).toBeNull();
    expect(error.message).toContain("party");
    expect(error.message).toContain("pokemon");
    expect((error.cause as Error).name).toBe("ZodError");
  });

  test("does not check an answer unless asked", async () => {
    const party = await getParty({ fetch: respond(200, { pokemon: "none" }) });
    expect(party).toEqual({ pokemon: "none" } as never);
  });

  test("still reports a 503 body as unavailable", async () => {
    const error = (await get("party", {
      validate: true,
      fetch: respond(503, {
        error: { code: "no_game", message: "No game." },
        status: STATUS,
      }),
    }).catch((e: unknown) => e)) as PmrApiError;
    expect(error.kind).toBe("unavailable");
  });
});
