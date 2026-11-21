import { describe, expect, test } from "bun:test";
import type { AboutBody } from "@pokemon-memory-reader/internal/about";
import type { UpdateBody } from "@pokemon-memory-reader/internal/update";
import { renderToStaticMarkup } from "react-dom/server";
import { About } from "./About";
import { LGPL_COMPONENTS } from "./lgpl";
import type { Polled } from "./useInternal";

describe("the About page", () => {
  const html = renderToStaticMarkup(<About />);

  test("says the program includes JavaScriptCore and tinycc under the LGPL", () => {
    expect(html).toContain(
      "This program includes JavaScriptCore (WebKit) and tinycc, used under the GNU LGPL.",
    );
  });

  test("shows each library's copyright line", () => {
    expect(html).toContain(
      "JavaScriptCore (WebKit): Copyright the WebKit contributors",
    );
    expect(html).toContain(
      "tinycc: Copyright Fabrice Bellard and the tinycc contributors",
    );
    for (const c of LGPL_COMPONENTS) expect(html).toContain(c.copyright);
  });

  test("links the notices file, which carries the licenses, source and relinking steps", () => {
    expect(html).toContain('href="/about/third-party-notices.txt"');
    expect(html).toContain("licenses, source and relinking steps");
  });
});

describe("the About version and update cards", () => {
  const about = {
    kind: "ready",
    value: {
      version: "2.0.0",
      target: "linux-x64",
      commit: "abc1234",
      versionLine: "pokemon-memory-reader 2.0.0 (linux-x64, abc1234)",
      protocol: 1,
      lgpl: LGPL_COMPONENTS,
      notices: true,
    },
  } as const;
  const update = (patch: Partial<UpdateBody>): Polled<UpdateBody> => ({
    kind: "ready",
    value: {
      enabled: true,
      current: "2.0.0",
      latest: null,
      checkedAt: "2026-11-21T10:00:00Z",
      ...patch,
    },
  });
  const render = (a: Polled<AboutBody>, u: Polled<UpdateBody>) =>
    renderToStaticMarkup(<About about={a} update={u} />);

  test("shows the version line, the build and the commit", () => {
    const html = render(about, update({}));
    expect(html).toContain("pokemon-memory-reader 2.0.0 (linux-x64, abc1234)");
    expect(html).toContain("Build: linux-x64, commit abc1234");
    expect(html).not.toContain("Third-party notices ship with release builds.");
  });

  test("says notices ship with release builds when the file is missing", () => {
    const html = render(
      { kind: "ready", value: { ...about.value, notices: false } },
      update({}),
    );
    expect(html).toContain("Third-party notices ship with release builds.");
  });

  test("names a newer release with its link", () => {
    const html = render(
      about,
      update({
        latest: {
          version: "2.1.0",
          url: "https://github.com/atendev/pokemon-memory-reader/releases/tag/v2.1.0",
        },
      }),
    );
    expect(html).toContain("Version 2.1.0 is available. You have 2.0.0.");
    expect(html).toContain("See the release");
  });

  test("says you have the newest release, with no link", () => {
    const html = render(about, update({}));
    expect(html).toContain("You have 2.0.0, the newest release as of");
    expect(html).not.toContain("See the release");
  });

  test("says the check is off, or hasn't finished", () => {
    expect(render(about, update({ enabled: false }))).toContain(
      "Update checks are off.",
    );
    expect(render(about, update({ checkedAt: null }))).toContain(
      "No update check has finished yet.",
    );
  });

  test("says so while loading and when a read failed", () => {
    const loading = render({ kind: "loading" }, { kind: "loading" });
    expect(loading).toContain("Reading the version.");
    expect(loading).toContain("Reading the last update check.");
    const failed = render(
      { kind: "unavailable", code: null, status: 500, message: "Boom." },
      { kind: "unavailable", code: null, status: null, message: "Offline." },
    );
    expect(failed).toContain("The version can&#x27;t be read right now. Boom.");
    expect(failed).toContain(
      "The last update check can&#x27;t be read right now. Offline.",
    );
  });
});
