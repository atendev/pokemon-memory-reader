import { describe, expect, test } from "bun:test";
import {
  adoptDraft,
  forgetNow,
  pickNow,
  probeNow,
  saveSettings,
  switchNow,
} from "./settings-actions";
import { draftFrom } from "./settings-form";
import { settingsBody } from "./testing";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const refused = (code: string, message: string, status = 403) =>
  json({ error: { code, message } }, status);

function fake(response: Response | Error) {
  const seen: { path: string; init: RequestInit | undefined }[] = [];
  const fetchFn = async (path: string, init?: RequestInit) => {
    seen.push({ path, init });
    if (response instanceof Error) throw response;
    return response.clone();
  };
  return { seen, fetchFn };
}

describe("the draft across polls", () => {
  const first = settingsBody();
  const second = settingsBody({
    settings: {
      ...first.settings,
      pollHz: { ...first.settings.pollHz, value: 40 },
    },
  });

  test("the first read becomes the draft", () => {
    expect(adoptDraft(null, first).pollHz).toBe("20");
  });

  test("a later poll never replaces what is being typed", () => {
    const typing = { ...draftFrom(first.settings), pollHz: "33" };
    expect(adoptDraft(typing, second)).toBe(typing);
  });
});

describe("saving", () => {
  test("sends the patch to PUT /settings and returns the saved body", async () => {
    const saved = settingsBody();
    const { seen, fetchFn } = fake(json(saved));
    const result = await saveSettings({ pollHz: 30 }, fetchFn);
    expect(seen[0]?.path).toBe("/settings");
    expect(seen[0]?.init?.method).toBe("PUT");
    expect(seen[0]?.init?.body).toBe(JSON.stringify({ pollHz: 30 }));
    expect(result.notice).toEqual({ kind: "ok", message: "Saved." });
    expect(result.value).toEqual(saved);
    expect(result.refreshUpdate).toBe(false);
  });

  test("asks the update banner to re-read only when updateCheck changed", async () => {
    const { fetchFn } = fake(json(settingsBody()));
    const result = await saveSettings({ updateCheck: false }, fetchFn);
    expect(result.refreshUpdate).toBe(true);
  });

  test("a refusal shows its title and the program's message, and returns no body", async () => {
    const { fetchFn } = fake(
      refused("saves_refused", "config.json is not valid JSON."),
    );
    const result = await saveSettings({ pollHz: 30 }, fetchFn);
    expect(result.value).toBeNull();
    expect(result.refreshUpdate).toBe(false);
    expect(result.notice).toEqual({
      kind: "error",
      title: "Saving is turned off",
      message: "config.json is not valid JSON.",
    });
  });

  test("an unreachable program shows a message with no title", async () => {
    const { fetchFn } = fake(new Error("down"));
    const result = await saveSettings({ pollHz: 30 }, fetchFn);
    expect(result.notice).toEqual({
      kind: "error",
      title: null,
      message: "Could not reach the program.",
    });
  });
});

describe("the adapter writes", () => {
  test("a probe returns the new list", async () => {
    const body = { mode: "auto", live: null, adapters: [] };
    const { seen, fetchFn } = fake(json(body));
    const result = await probeNow(fetchFn);
    expect(seen[0]?.path).toBe("/adapters/probe");
    expect(result.value).toEqual(body as never);
  });

  test("a switch names the adapter and says it lasts until restart", async () => {
    const { seen, fetchFn } = fake(json({ live: "retroarch" }));
    const result = await switchNow("retroarch", fetchFn);
    expect(seen[0]?.path).toBe("/adapters/switch");
    expect(seen[0]?.init?.body).toBe(JSON.stringify({ id: "retroarch" }));
    expect(result.notice).toEqual({
      kind: "ok",
      message: "Now reading from RetroArch, until the program restarts.",
    });
  });

  test("a pinned refusal reads clearly", async () => {
    const { fetchFn } = fake(
      refused("adapter_pinned", "The adapter is pinned.", 409),
    );
    const result = await switchNow("retroarch", fetchFn);
    expect(result.value).toBeNull();
    expect(result.notice).toEqual({
      kind: "error",
      title: "Unpin in Settings to switch",
      message: "The adapter is pinned.",
    });
  });
});

describe("the manual pick writes", () => {
  test("a pick sends the profile and scope, never a key, and says it was remembered", async () => {
    const { seen, fetchFn } = fake(json({ saved: true, reason: null }));
    const result = await pickNow("emerald-us-1.0", "rom", fetchFn);
    expect(seen[0]?.path).toBe("/manual-picks");
    expect(seen[0]?.init?.body).toBe(
      JSON.stringify({ profileId: "emerald-us-1.0", scope: "rom" }),
    );
    expect(result.notice).toEqual({
      kind: "ok",
      message: "Profile picked and remembered for this ROM.",
    });
  });

  test("a pick that can't be remembered says why", async () => {
    const noKey = await pickNow(
      "p",
      "rom",
      fake(json({ saved: false, reason: "no_key" })).fetchFn,
    );
    expect(noKey.notice.kind === "ok" && noKey.notice.message).toContain(
      "nothing to remember it by",
    );
    const failed = await pickNow(
      "p",
      "rom",
      fake(json({ saved: false, reason: "write_failed" })).fetchFn,
    );
    expect(failed.notice.kind === "ok" && failed.notice.message).toContain(
      "couldn't be saved to disk",
    );
  });

  test("a refused pick shows the refusal and reloads nothing", async () => {
    const result = await pickNow(
      "p",
      "base",
      fake(refused("base_pick_not_allowed", "No base.", 409)).fetchFn,
    );
    expect(result.value).toBeNull();
    expect(result.notice).toEqual({
      kind: "error",
      title: "That profile can't be picked for a base game",
      message: "No base.",
    });
  });

  test("forgetting posts to the forget route, and a refusal shows", async () => {
    const ok = fake(json({}));
    const result = await forgetNow(ok.fetchFn);
    expect(ok.seen[0]?.path).toBe("/manual-picks/forget");
    expect(result.notice.kind).toBe("ok");
    const no = await forgetNow(
      fake(refused("forget_not_allowed", "Nothing to forget.", 409)).fetchFn,
    );
    expect(no.value).toBeNull();
    expect(no.notice).toMatchObject({
      kind: "error",
      title: "There is no manual pick to forget",
    });
  });
});
