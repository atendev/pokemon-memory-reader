import { describe, expect, test } from "bun:test";
import type { AboutBody } from "@pokemon-memory-reader/internal/about";
import type { AdaptersBody } from "@pokemon-memory-reader/internal/adapters-route";
import { renderToStaticMarkup } from "react-dom/server";
import { Screen } from "./App";
import { ConnectionScreen, protocolRelation } from "./ConnectionScreen";
import { copyText } from "./copy";
import { settingsBody, status } from "./testing";
import type { Polled } from "./useInternal";

const idle = { kind: "loading" } as const;

const about = (protocol: number): Polled<AboutBody> => ({
  kind: "ready",
  value: {
    version: "2.0.0",
    target: "linux-x64",
    commit: "dev",
    versionLine: "pokemon-memory-reader 2.0.0",
    protocol,
    lgpl: [],
    notices: true,
  },
});

type Entry = AdaptersBody["adapters"][number];
const entry = (
  id: Entry["id"],
  probe: Partial<Entry["probe"]> = {},
  port = 7426,
): Entry => ({
  id,
  endpoint: { host: "127.0.0.1", port },
  live: false,
  probe: {
    result: "no_reply",
    bridge: null,
    problem: null,
    checkedAt: null,
    ...probe,
  },
});
const adapters = (list: Entry[]): Polled<AdaptersBody> => ({
  kind: "ready",
  value: { mode: "auto", live: null, adapters: list },
});

const settings = (paths = settingsBody().paths): Polled<never> =>
  ({ kind: "ready", value: settingsBody({ paths }) }) as never;

const render = (props: Parameters<typeof ConnectionScreen>[0]) =>
  renderToStaticMarkup(<ConnectionScreen {...props} />);

describe("the data folder", () => {
  test("shows the path with a copy button", () => {
    const html = render({
      status: status("disconnected"),
      settings: settings(),
    });
    expect(html).toContain("/home/me/.pmr");
    expect(html).toContain('aria-label="Copy the data folder path"');
    expect(html).toContain(">Copy<");
  });

  test("tells a reader on another machine to open the viewer on the host", () => {
    const html = render({
      status: status("disconnected"),
      settings: settings(null),
    });
    expect(html).toContain("Open the viewer on this machine to see the path.");
    expect(html).not.toContain("Copy the data folder path");
  });

  test("shows nothing while settings are unread, and for an unreachable program", () => {
    expect(render({ status: status("no_game") })).not.toContain("Data folder");
    expect(render({ status: null, settings: settings() })).not.toContain(
      "Data folder",
    );
  });

  test("shows under every connection state", () => {
    for (const s of ["no_game", "unidentified", "disconnected"] as const) {
      expect(render({ status: status(s), settings: settings() })).toContain(
        "Copy the data folder path",
      );
    }
    expect(
      render({
        status: status("game"),
        unsupported: true,
        settings: settings(),
      }),
    ).toContain("Copy the data folder path");
  });
});

describe("copyText", () => {
  test("writes the text and reports success", async () => {
    const written: string[] = [];
    const outcome = await copyText("/home/me/.pmr", {
      writeText: async (text) => {
        written.push(text);
      },
    });
    expect(outcome).toBe("copied");
    expect(written).toEqual(["/home/me/.pmr"]);
  });

  test("reports a refused write and a missing clipboard as a failure", async () => {
    const refusing = {
      writeText: async () => {
        throw new Error("denied");
      },
    };
    expect(await copyText("x", refusing)).toBe("failed");
    expect(await copyText("x", undefined)).toBe("failed");
  });
});

describe("the adapter list", () => {
  test("names each adapter with its endpoint and what the probe found", () => {
    const html = render({
      status: status("disconnected"),
      adapters: adapters([
        entry("mgba", { result: "live" }),
        entry("retroarch", { result: "refused" }, 55355),
        entry("bizhawk", { result: "not_probed" }, 7427),
      ]),
    });
    expect(html).toContain("mGBA");
    expect(html).toContain("RetroArch");
    expect(html).toContain("BizHawk");
    expect(html).toContain("127.0.0.1:55355");
    expect(html).toContain("Connected");
    expect(html).toContain("Refused the connection");
    expect(html).toContain("Not checked");
  });

  test("says while it is loading and when the list can't be read", () => {
    expect(render({ status: status("disconnected") })).toContain(
      "Looking for emulators.",
    );
    const html = render({
      status: status("disconnected"),
      adapters: {
        kind: "unavailable",
        code: null,
        status: 500,
        message: "boom",
      },
    });
    expect(html).toContain("The adapter list can&#x27;t be read right now.");
  });

  test("a row with a protocol problem says whether its bridge is older or newer", () => {
    const row = (protocol: number) =>
      render({
        status: status("disconnected"),
        about: about(2),
        adapters: adapters([
          entry("mgba", {
            result: "problem",
            problem: "protocol_mismatch",
            bridge: { bridge: "mgba", protocol, build: null, emulator: null },
          }),
        ]),
      });
    expect(row(1)).toContain("the bridge is older than this program");
    expect(row(3)).toContain("the bridge is newer than this program");
    expect(row(3)).toContain("protocol 3, this program 2");
  });
});

describe("an older or newer protocol", () => {
  const mismatch = (bridge: number, program: number | null) =>
    render({
      status: status("disconnected", {
        adapter: {
          id: "mgba",
          stalled: false,
          problem: "protocol_mismatch",
          bridge: {
            bridge: "mgba",
            protocol: bridge,
            build: null,
            emulator: null,
          },
        } as never,
      }),
      about: program === null ? idle : about(program),
    });

  test("an older bridge says to reload it from the program", () => {
    const html = mismatch(1, 2);
    expect(html).toContain("The loaded bridge is older than this program");
    expect(html).toContain("protocol 1");
    expect(html).toContain("Reload the bridge from this program.");
  });

  test("a newer bridge says to update the program", () => {
    const html = mismatch(3, 2);
    expect(html).toContain("The loaded bridge is newer than this program");
    expect(html).toContain("Update this program");
  });

  test("without the program's number it falls back to the plain wrong-version text", () => {
    const html = mismatch(2, null);
    expect(html).toContain("The loaded bridge is the wrong version");
    expect(html).toContain("protocol 2");
  });

  test("protocolRelation compares the two numbers", () => {
    expect(protocolRelation(1, 2)).toBe("older");
    expect(protocolRelation(3, 2)).toBe("newer");
    expect(protocolRelation(2, 2)).toBeNull();
    expect(protocolRelation(undefined, 2)).toBeNull();
    expect(protocolRelation(1, null)).toBeNull();
  });
});

describe("the screen router", () => {
  test("hands the loaded details to the connection screen", () => {
    const html = renderToStaticMarkup(
      <Screen
        route="party"
        status={status("disconnected")}
        party={idle}
        settings={settings()}
        adapters={adapters([entry("mgba")])}
        about={about(1)}
      />,
    );
    expect(html).toContain("Copy the data folder path");
    expect(html).toContain("mGBA");
  });
});
