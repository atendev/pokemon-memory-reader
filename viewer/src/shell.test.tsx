import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Screen } from "./App";
import { ConnectionScreen } from "./ConnectionScreen";
import { Sidebar } from "./Sidebar";
import { status } from "./testing";

const idle = { kind: "loading" } as const;

function sidebar(
  overrides: Partial<Parameters<typeof Sidebar>[0]> = {},
): string {
  return renderToStaticMarkup(
    <Sidebar
      route="party"
      collapsed={false}
      onToggle={() => {}}
      status={status("game")}
      {...overrides}
    />,
  );
}

describe("the sidebar", () => {
  test("links the five screens by hash route and marks the open one", () => {
    const html = sidebar({ route: "boxes" });
    for (const route of ["party", "battle", "boxes", "trainer", "settings"]) {
      expect(html).toContain(`href="#/${route}"`);
    }
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    const boxes = html.match(/<a [^>]*href="#\/boxes"[^>]*>/)?.[0] ?? "";
    expect(boxes).toContain('aria-current="page"');
    expect(html).toContain("Trainer &amp; bag");
  });

  test("its toggle says what it will do and whether the sidebar is expanded", () => {
    const open = sidebar({ collapsed: false });
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain('aria-label="Collapse sidebar"');
    const rail = sidebar({ collapsed: true });
    expect(rail).toContain('aria-expanded="false"');
    expect(rail).toContain('aria-label="Expand sidebar"');
  });

  test("a collapsed rail keeps every link named for screen readers", () => {
    const html = sidebar({ collapsed: true });
    for (const label of [
      "Party",
      "Battle",
      "Boxes",
      "Trainer & bag",
      "Settings",
    ]) {
      expect(html).toContain(`aria-label="${label.replace("&", "&amp;")}"`);
    }
  });

  test("shows the red battle dot only while a battle is live", () => {
    expect(sidebar()).not.toContain("live-dot");
    expect(sidebar({ battleLive: true })).toContain("live-dot");
  });

  test("the status block names the connection and the adapter", () => {
    const html = sidebar({
      status: status("game", {
        adapter: {
          id: "mgba",
          stalled: false,
          bridge: null,
          problem: null,
        },
      }),
    });
    expect(html).toContain("Connected");
    expect(html).toContain("mgba");
  });
});

describe("the connection screen", () => {
  const render = (value: Parameters<typeof ConnectionScreen>[0]) =>
    renderToStaticMarkup(<ConnectionScreen {...value} />);

  test("reflects disconnected with the bridge install steps", () => {
    const html = render({ status: status("disconnected") });
    expect(html).toContain("Waiting for an emulator");
    expect(html).toContain('href="/bridges/mgba.lua"');
  });

  test("reflects no_game without install steps", () => {
    const html = render({ status: status("no_game") });
    expect(html).toContain("No game loaded");
    expect(html).not.toContain("/bridges/mgba.lua");
  });

  test("reflects unidentified, and names an expansion ROM's version", () => {
    expect(render({ status: status("unidentified") })).toContain(
      "This game isn&#x27;t recognised",
    );
    const html = render({
      status: status("unidentified", {
        rom: {
          platform: "gba",
          title: null,
          gameCode: null,
          revision: null,
          globalChecksum: null,
          crc32: null,
          sha1: null,
          contentName: null,
          expansion: { version: "2.1", tagged: true },
        } as never,
      }),
    });
    expect(html).toContain("expansion hack (version 2.1)");
  });

  test("reflects unsupported while the state is still game", () => {
    const html = render({ status: status("game"), unsupported: true });
    expect(html).toContain("This game isn&#x27;t supported yet");
    expect(html).not.toContain("/bridges/mgba.lua");
  });

  test("tells the user to reload the bridge for an unknown bridge or a protocol mismatch", () => {
    const adapter = (problem: string, bridge: unknown = null) =>
      status("disconnected", {
        adapter: { id: "mgba", stalled: false, bridge, problem } as never,
      });
    const unknown = render({ status: adapter("unknown_bridge") });
    expect(unknown).toContain("unknown bridge");
    expect(unknown).toContain("Reload the bridge");
    const mismatch = render({
      status: adapter("protocol_mismatch", {
        bridge: "mgba",
        protocol: 2,
        build: null,
        emulator: null,
      }),
    });
    expect(mismatch).toContain("protocol 2");
    expect(mismatch).toContain('href="/bridges/mgba.lua"');
  });

  test("an unreachable program says so", () => {
    expect(render({ status: null })).toContain("Cannot reach the program");
  });
});

describe("the screens by route", () => {
  const game = status("game");
  const screen = (route: Parameters<typeof Screen>[0]["route"], s = game) =>
    renderToStaticMarkup(<Screen route={route} status={s} party={idle} />);

  test("Battle, Boxes, and Trainer & bag render once a game is up", () => {
    expect(screen("battle")).toContain("Battle");
    expect(screen("boxes")).toContain("Boxes");
    expect(screen("trainer")).toContain("Reading the trainer");
    expect(screen("trainer")).toContain("Trainer &amp; bag");
  });

  test("Settings opens its screen, not a placeholder", () => {
    const html = screen("settings");
    expect(html).toContain("Settings");
    expect(html).not.toContain("This screen isn&#x27;t built yet.");
  });

  test("the game screens give way to the connection screen without a game", () => {
    for (const route of ["party", "battle", "boxes", "trainer"] as const) {
      expect(screen(route, status("no_game"))).toContain("No game loaded");
    }
  });

  test("Settings and About stay reachable without a game", () => {
    expect(screen("settings", status("disconnected"))).toContain("Settings");
    expect(screen("about", status("disconnected"))).toContain("About");
  });

  test("Party shows the connection screen's unsupported state on a 503 unsupported", () => {
    const html = renderToStaticMarkup(
      <Screen
        route="party"
        status={game}
        party={{ kind: "unavailable", code: "unsupported" }}
      />,
    );
    expect(html).toContain("This game isn&#x27;t supported yet");
  });

  test("an unknown route says the page is not found", () => {
    expect(screen("not_found")).toContain("Page not found");
  });
});
