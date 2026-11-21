import { describe, expect, test } from "bun:test";
import {
  call,
  forgetPick,
  pickProfile,
  putSettings,
  refusalCopy,
  switchAdapter,
} from "./internal-api";

type Seen = { path: string; init: RequestInit | undefined };

function fake(response: Response | Error) {
  const seen: Seen[] = [];
  const fetchFn = async (path: string, init?: RequestInit) => {
    seen.push({ path, init });
    if (response instanceof Error) throw response;
    return response.clone();
  };
  return { seen, fetchFn };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("calling an internal route", () => {
  test("a read sends no body and returns the parsed answer", async () => {
    const { seen, fetchFn } = fake(json({ live: "mgba" }));
    const outcome = await call("GET", "/adapters", undefined, fetchFn);
    expect(outcome).toEqual({ ok: true, value: { live: "mgba" } });
    expect(seen[0]?.init).toEqual({ method: "GET" });
  });

  test("a write sends JSON with its Content-Type, and `{}` when it has nothing to say", async () => {
    const put = fake(json({}));
    await putSettings({ pollHz: 30 }, put.fetchFn);
    expect(put.seen[0]?.path).toBe("/settings");
    expect(put.seen[0]?.init?.method).toBe("PUT");
    expect(put.seen[0]?.init?.body).toBe('{"pollHz":30}');
    expect(put.seen[0]?.init?.headers).toEqual({
      "Content-Type": "application/json",
    });
    const forget = fake(json({}));
    await forgetPick(forget.fetchFn);
    expect(forget.seen[0]?.path).toBe("/manual-picks/forget");
    expect(forget.seen[0]?.init?.body).toBe("{}");
  });

  test("the switch and the pick send exactly the body the program expects", async () => {
    const sw = fake(json({ live: "retroarch" }));
    await switchAdapter("retroarch", sw.fetchFn);
    expect(sw.seen[0]?.init?.body).toBe('{"id":"retroarch"}');
    const pick = fake(json({}));
    await pickProfile(
      { profileId: "emerald-us-1.0", scope: "rom" },
      pick.fetchFn,
    );
    expect(pick.seen[0]?.init?.body).toBe(
      '{"profileId":"emerald-us-1.0","scope":"rom"}',
    );
  });

  test("a refusal keeps the program's code and message", async () => {
    const { fetchFn } = fake(
      json(
        { error: { code: "saves_refused", message: "Saving is turned off." } },
        409,
      ),
    );
    expect(await call("PUT", "/settings", {}, fetchFn)).toEqual({
      ok: false,
      code: "saves_refused",
      status: 409,
      message: "Saving is turned off.",
    });
  });

  test("an answer with no error body, like a route the program lacks, still says what happened", async () => {
    const { fetchFn } = fake(new Response("404 Not Found", { status: 404 }));
    expect(await call("GET", "/manual-picks", undefined, fetchFn)).toEqual({
      ok: false,
      code: null,
      status: 404,
      message: "The program answered 404.",
    });
  });

  test("an unreachable program is a refusal, not a throw", async () => {
    const { fetchFn } = fake(new TypeError("fetch failed"));
    expect(await call("GET", "/settings", undefined, fetchFn)).toEqual({
      ok: false,
      code: null,
      status: null,
      message: "Could not reach the program.",
    });
  });

  test("a 200 with an unreadable body is a refusal", async () => {
    const { fetchFn } = fake(new Response("not json", { status: 200 }));
    const outcome = await call("GET", "/update", undefined, fetchFn);
    expect(outcome.ok).toBe(false);
  });
});

describe("how a refusal reads", () => {
  test("a known code gets a title and the program's message stays", () => {
    expect(
      refusalCopy({ code: "adapter_pinned", message: "Pinned to mGBA." }),
    ).toEqual({
      title: "Unpin in Settings to switch",
      message: "Pinned to mGBA.",
    });
  });

  test("an unknown code or none shows the message alone", () => {
    expect(refusalCopy({ code: "something_new", message: "Hm." })).toEqual({
      title: null,
      message: "Hm.",
    });
    expect(refusalCopy({ code: null, message: "Offline." })).toEqual({
      title: null,
      message: "Offline.",
    });
  });
});
