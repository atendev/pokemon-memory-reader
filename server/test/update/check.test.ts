import { expect, test } from "bun:test";
import type { Log } from "../../src/log";
import {
  CHECK_INTERVAL_MS,
  createUpdateChecker,
  ENABLE_DELAY_MS,
} from "../../src/update/check";
import { ManualClock } from "../bridge/manual-clock";

const page = (tag: string) =>
  `https://github.com/atendev/pokemon-memory-reader/releases/tag/${tag}`;
const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  html_url: page(tag),
  draft: false,
  prerelease: tag.includes("-"),
  ...extra,
});

/** A fake feed that counts requests and never touches the network. */
function fakeFeed(answer: () => Response | Promise<Response>) {
  const requests: { url: string; init: RequestInit }[] = [];
  return {
    requests,
    fetch: (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return Promise.resolve().then(answer);
    },
  };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function make(
  current: string,
  feed: ReturnType<typeof fakeFeed>,
  options: { enabled?: boolean; log?: Log } = {},
) {
  const clock = new ManualClock();
  const found: string[] = [];
  const checker = createUpdateChecker({
    current,
    enabled: options.enabled ?? true,
    feedUrl: "https://feed.test/releases",
    fetch: feed.fetch,
    clock,
    log: options.log ?? { debug() {}, info() {}, warn() {}, error() {} },
    onNewer: (latest) => found.push(latest.version),
  });
  return { checker, clock, found };
}

test("with updateCheck off no request is made and /update says so", async () => {
  const feed = fakeFeed(() => json([release("v9.0.0")]));
  const { checker, clock } = make("2.0.0", feed, { enabled: false });
  checker.start();
  await checker.checkNow();
  clock.advance(CHECK_INTERVAL_MS * 3);
  expect(feed.requests).toHaveLength(0);
  expect(checker.state()).toEqual({
    enabled: false,
    current: "2.0.0",
    latest: null,
    checkedAt: null,
  });
});

test("an up-to-date build reports no latest, and the check is dated", async () => {
  const feed = fakeFeed(() => json([release("v2.0.0"), release("v1.0.0")]));
  const { checker, found } = make("2.0.0", feed);
  await checker.checkNow();
  const state = checker.state();
  expect(state.enabled).toBe(true);
  expect(state.latest).toBeNull();
  expect(state.checkedAt).toBe("1970-01-01T00:00:00.000Z");
  expect(found).toEqual([]);
});

test("a newer release is reported with its release page and printed once", async () => {
  const feed = fakeFeed(() =>
    json([release("v2.1.0"), release("v2.0.1"), release("v2.0.0")]),
  );
  const { checker, found } = make("2.0.0", feed);
  await checker.checkNow();
  await checker.checkNow();
  expect(checker.state().latest).toEqual({
    version: "2.1.0",
    url: page("v2.1.0"),
  });
  expect(found).toEqual(["2.1.0"]);
});

test("the request is a plain GET of the feed that sends only the app version", async () => {
  const feed = fakeFeed(() => json([]));
  const { checker } = make("2.0.0-rc.1", feed);
  await checker.checkNow();
  const { url, init } = feed.requests[0] ?? { url: "", init: {} };
  expect(url).toBe("https://feed.test/releases");
  expect(init.method).toBeUndefined();
  expect(init.headers).toEqual({
    Accept: "application/vnd.github+json",
    "User-Agent": "pokemon-memory-reader/2.0.0-rc.1",
  });
});

test("a stable build ignores prereleases, drafts, API releases and v1-lua", async () => {
  const feed = fakeFeed(() =>
    json([
      release("v3.0.0-rc.1"),
      release("v2.5.0", { draft: true }),
      release("api-v2.9.0"),
      release("v1-lua"),
      release("v2.0.1", { prerelease: true }),
      release("v2.0.0"),
    ]),
  );
  const { checker } = make("2.0.0", feed);
  await checker.checkNow();
  expect(checker.state().latest).toBeNull();
});

test("a prerelease build compares against every release, by semver order", async () => {
  const feed = fakeFeed(() =>
    json([
      release("v2.0.0-rc.2"),
      release("v2.0.0-rc.10"),
      release("v2.0.0-beta.1"),
      release("v1.0.0"),
    ]),
  );
  const { checker } = make("2.0.0-rc.2", feed);
  await checker.checkNow();
  expect(checker.state().latest?.version).toBe("2.0.0-rc.10");
});

test("a prerelease build moves to the stable release of its own version", async () => {
  const feed = fakeFeed(() =>
    json([release("v2.0.0"), release("v2.0.0-rc.3")]),
  );
  const { checker } = make("2.0.0-rc.3", feed);
  await checker.checkNow();
  expect(checker.state().latest?.version).toBe("2.0.0");
});

test("a network error leaves the state alone, never throws, and logs only at debug", async () => {
  let fail = false;
  const feed = fakeFeed(() => {
    if (fail) throw new Error("offline");
    return json([release("v2.1.0")]);
  });
  const levels: string[] = [];
  const log: Log = {
    debug: () => levels.push("debug"),
    info: () => levels.push("info"),
    warn: () => levels.push("warn"),
    error: () => levels.push("error"),
  };
  const { checker } = make("2.0.0", feed, { log });
  await checker.checkNow();
  const before = checker.state();
  fail = true;
  await checker.checkNow();
  expect(checker.state()).toEqual(before);
  expect(levels).toEqual(["debug"]);
});

test("a rate-limit or server error is a failed check", async () => {
  const feed = fakeFeed(() => json({ message: "rate limited" }, 403));
  const { checker, found } = make("2.0.0", feed);
  await checker.checkNow();
  expect(checker.state()).toEqual({
    enabled: true,
    current: "2.0.0",
    latest: null,
    checkedAt: null,
  });
  expect(found).toEqual([]);
});

test.each([
  ["not JSON", () => new Response("<html>", { status: 200 })],
  ["an object", () => json({ releases: [] })],
  ["null", () => json(null)],
])("a malformed feed (%s) is a failed check", async (_name, answer) => {
  const feed = fakeFeed(answer);
  const { checker } = make("2.0.0", feed);
  await checker.checkNow();
  expect(checker.state().latest).toBeNull();
  expect(checker.state().checkedAt).toBeNull();
});

test("bad entries in a good list are skipped and the rest still count", async () => {
  const feed = fakeFeed(() =>
    json([
      null,
      "v9.9.9",
      { tag_name: 5, html_url: "x" },
      { tag_name: "v8.0.0" },
      release("vnext"),
      release("v2.1.0"),
    ]),
  );
  const { checker } = make("2.0.0", feed);
  await checker.checkNow();
  expect(checker.state().latest?.version).toBe("2.1.0");
});

test("start checks at once without being awaited, then every 24 hours", async () => {
  const feed = fakeFeed(() => json([release("v2.1.0")]));
  const { checker, clock } = make("2.0.0", feed);
  checker.start();
  expect(feed.requests).toHaveLength(1);
  await Bun.sleep(0);
  clock.advance(CHECK_INTERVAL_MS - 1);
  expect(feed.requests).toHaveLength(1);
  clock.advance(1);
  expect(feed.requests).toHaveLength(2);
  await Bun.sleep(0);
  clock.advance(CHECK_INTERVAL_MS);
  expect(feed.requests).toHaveLength(3);
});

test("a hanging feed does not block start", () => {
  const feed = fakeFeed(() => new Promise<Response>(() => {}));
  const { checker } = make("2.0.0", feed);
  expect(checker.start()).toBeUndefined();
  expect(checker.state().checkedAt).toBeNull();
});

test("turning it off cancels the next check, and turning it on schedules one shortly after", async () => {
  const feed = fakeFeed(() => json([release("v2.1.0")]));
  const { checker, clock } = make("2.0.0", feed);
  checker.start();
  await Bun.sleep(0);
  expect(feed.requests).toHaveLength(1);

  checker.setEnabled(false);
  expect(checker.state()).toMatchObject({ enabled: false, latest: null });
  clock.advance(CHECK_INTERVAL_MS * 2);
  expect(feed.requests).toHaveLength(1);

  checker.setEnabled(true);
  clock.advance(ENABLE_DELAY_MS - 1);
  expect(feed.requests).toHaveLength(1);
  clock.advance(1);
  expect(feed.requests).toHaveLength(2);
  await Bun.sleep(0);
  expect(checker.state().latest?.version).toBe("2.1.0");
});

test("a check that finishes after the setting went off is dropped", async () => {
  let release_!: (response: Response) => void;
  const feed = fakeFeed(
    () => new Promise<Response>((resolve) => (release_ = resolve)),
  );
  const { checker, found } = make("2.0.0", feed);
  const running = checker.checkNow();
  await Bun.sleep(0);
  checker.setEnabled(false);
  release_(json([release("v2.1.0")]));
  await running;
  checker.setEnabled(true);
  expect(checker.state().latest).toBeNull();
  expect(found).toEqual([]);
});

test("close stops the schedule", async () => {
  const feed = fakeFeed(() => json([]));
  const { checker, clock } = make("2.0.0", feed);
  checker.start();
  await Bun.sleep(0);
  checker.close();
  clock.advance(CHECK_INTERVAL_MS * 2);
  expect(feed.requests).toHaveLength(1);
});
