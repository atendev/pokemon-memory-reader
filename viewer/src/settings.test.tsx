import { describe, expect, test } from "bun:test";
import type { AdaptersBody } from "@pokemon-memory-reader/internal/adapters-route";
import type { SettingsBody } from "@pokemon-memory-reader/internal/settings-route";
import { renderToStaticMarkup } from "react-dom/server";
import type { ManualPicksBody } from "./internal-api";
import { ManualPickSection } from "./ManualPick";
import {
  AdapterList,
  type Notice,
  NoticeView,
  SettingsView,
} from "./SettingsScreen";
import { draftFrom, validate } from "./settings-form";
import { settingsBody, status } from "./testing";
import type { Polled } from "./useInternal";

const noop = () => {};

const probe = (
  result: AdaptersBody["adapters"][number]["probe"]["result"],
) => ({
  result,
  bridge: null,
  problem: null,
  checkedAt: null,
});
const adaptersBody = (
  mode: "auto" | "pinned" = "auto",
): Polled<AdaptersBody> => ({
  kind: "ready",
  value: {
    mode,
    live: "mgba",
    adapters: [
      {
        id: "mgba",
        endpoint: { host: "127.0.0.1", port: 7426 },
        live: true,
        probe: probe("live"),
      },
      {
        id: "retroarch",
        endpoint: { host: "127.0.0.1", port: 55355 },
        live: false,
        probe: probe("usable"),
      },
      {
        id: "bizhawk",
        endpoint: { host: "127.0.0.1", port: 7427 },
        live: false,
        probe: probe("refused"),
      },
    ],
  },
});

const view = (
  overrides: {
    body?: SettingsBody;
    notice?: Notice | null;
    adapters?: Polled<AdaptersBody>;
    picks?: Polled<ManualPicksBody> | null;
    status?: ReturnType<typeof status> | null;
    draft?: ReturnType<typeof draftFrom>;
  } = {},
) => {
  const body = overrides.body ?? settingsBody();
  const draft = overrides.draft ?? draftFrom(body.settings);
  return renderToStaticMarkup(
    <SettingsView
      body={body}
      draft={draft}
      errors={validate(body.settings, draft)}
      dirty={false}
      saving={false}
      notice={overrides.notice ?? null}
      adapters={overrides.adapters ?? adaptersBody()}
      adapterBusy={false}
      picks={overrides.picks ?? null}
      status={overrides.status ?? null}
      pickBusy={false}
      onChange={noop}
      onSave={noop}
      onDiscard={noop}
      onProbe={noop}
      onSwitch={noop}
      onPick={noop}
      onForget={noop}
    />,
  );
};

describe("the Settings screen", () => {
  test("shows the endpoints, the poll rate, the update check and the adapter picker", () => {
    const html = view();
    expect(html).toContain("Settings");
    expect(html).toContain('value="127.0.0.1"');
    expect(html).toContain('value="7425"');
    expect(html).toContain('value="7426"');
    expect(html).toContain('value="55355"');
    expect(html).toContain('value="7427"');
    expect(html).toContain('id="set-poll"');
    expect(html).toContain('value="20"');
    expect(html).toContain("Look for a newer release once a day");
    expect(html).toContain("Auto, try each in turn");
    expect(html).toContain("Pin to RetroArch");
  });

  test("says which fields need a restart", () => {
    expect(view()).toContain("Restart to apply.");
  });

  test("shows a setting saved for the next start as pending", () => {
    const base = settingsBody();
    const body = settingsBody({
      settings: {
        ...base.settings,
        port: { ...base.settings.port, pending: 8000 },
      },
    });
    expect(view({ body })).toContain(
      "Saved as 8000, which applies after a restart.",
    );
  });

  test("disables a field a flag set and says why", () => {
    const base = settingsBody();
    const body = settingsBody({
      settings: {
        ...base.settings,
        pollHz: { ...base.settings.pollHz, source: "flag" },
      },
    });
    const html = view({ body });
    expect(html).toMatch(/id="set-poll"[^>]*disabled/);
    expect(html).toContain("It can&#x27;t change here while the flag is set.");
    expect(view()).not.toMatch(/id="set-poll"[^>]*disabled/);
  });

  test("warns when the bind address opens the API to the network", () => {
    const base = settingsBody();
    const lan = settingsBody({
      settings: {
        ...base.settings,
        host: { ...base.settings.host, value: "0.0.0.0" },
      },
    });
    expect(view({ body: lan })).toContain(
      "Other devices on your network can read your game data",
    );
    expect(view()).not.toContain("Other devices on your network");
  });

  test("shows a field's error under it", () => {
    const body = settingsBody();
    const draft = { ...draftFrom(body.settings), pollHz: "500" };
    const html = view({ body, draft });
    expect(html).toContain("Enter a whole number from 5 to 60.");
    expect(html).toContain('aria-invalid="true"');
  });

  test("shows the folders when paths is set and a pointer when it is null", () => {
    const shown = view();
    expect(shown).toContain("/home/me/.pmr/config.json");
    expect(shown).toContain("Data folder");
    expect(shown).toContain("Bridges folder");
    const hidden = view({ body: settingsBody({ paths: null }) });
    expect(hidden).not.toContain("/home/me/.pmr");
    expect(hidden).not.toContain("Data folder");
    expect(hidden).toContain(
      "Open the viewer on this machine to see the path.",
    );
  });

  test("refused saves show a banner naming the file and the reason", () => {
    const body = settingsBody({
      saves: { writable: false, refusal: "malformed" },
    });
    const html = view({ body });
    expect(html).toContain(
      "Saving is turned off because /home/me/.pmr/config.json is not valid JSON.",
    );
    expect(html).toContain('role="alert"');
    expect(view()).not.toContain("Saving is turned off");
  });

  test("a refusal from the program shows its title and message, an ok shows a status", () => {
    const refused = view({
      notice: {
        kind: "error",
        title: "The program refused the change",
        message: "Host header not allowed.",
      },
    });
    expect(refused).toContain("The program refused the change. ");
    expect(refused).toContain("Host header not allowed.");
    expect(refused).toContain('role="alert"');
    const ok = view({ notice: { kind: "ok", message: "Saved." } });
    expect(ok).toContain('role="status"');
    expect(ok).toContain("Saved.");
  });
});

describe("the notice", () => {
  test("renders nothing without one, and leaves out a missing title", () => {
    expect(renderToStaticMarkup(<NoticeView notice={null} />)).toBe("");
    const html = renderToStaticMarkup(
      <NoticeView
        notice={{ kind: "error", title: null, message: "Could not reach it." }}
      />,
    );
    expect(html).toContain("Could not reach it.");
    expect(html).not.toContain("<strong>");
  });
});

describe("the adapter list", () => {
  const list = (adapters: Polled<AdaptersBody>) =>
    renderToStaticMarkup(
      <AdapterList
        adapters={adapters}
        busy={false}
        onProbe={noop}
        onSwitch={noop}
      />,
    );

  test("in auto mode lists each adapter, offers a switch to a ready one and a recheck", () => {
    const html = list(adaptersBody("auto"));
    expect(html).toContain("Connected");
    expect(html).toContain("Ready");
    expect(html).toContain("Refused the connection");
    expect(html).toContain("Switch to RetroArch");
    expect(html).not.toContain("Switch to mGBA");
    expect(html).not.toContain("Switch to BizHawk");
    expect(html).toContain("Check again");
    expect(html).not.toMatch(/disabled=""[^>]*>Switch to RetroArch/);
  });

  test("when pinned disables the switch and says to set the pin to Auto", () => {
    const html = list(adaptersBody("pinned"));
    expect(html).toMatch(/disabled=""[^>]*>Switch to RetroArch/);
    expect(html).toContain("Pinned to one adapter.");
    expect(html).not.toContain("Check again");
  });

  test("says so while loading and when the list can't be read", () => {
    expect(list({ kind: "loading" })).toContain("Looking for emulators.");
    const html = list({
      kind: "unavailable",
      code: null,
      status: 500,
      message: "Boom.",
    });
    expect(html).toContain("The adapter list can&#x27;t be read right now.");
    expect(html).toContain("Boom.");
  });
});

describe("the manual pick control", () => {
  const rom = (expansion: unknown = null) =>
    ({
      platform: "gba",
      title: "POKEMON EMER",
      gameCode: "BPEE",
      revision: 0,
      globalChecksum: null,
      crc32: "00000000",
      sha1: null,
      contentName: null,
      expansion,
    }) as never;
  const unidentified = status("unidentified", { rom: rom() });
  const candidates: ManualPicksBody = {
    romKey: "abc",
    current: null,
    candidates: [
      {
        id: "emerald-us-1.0",
        name: "Emerald (US)",
        kind: "vanilla",
        dataFormat: "gen3",
        headerMatch: true,
        signature: "match",
        baseEligible: true,
      },
      {
        id: "firered-us-1.0",
        name: "FireRed (US)",
        kind: "vanilla",
        dataFormat: "gen3",
        headerMatch: false,
        signature: null,
        baseEligible: false,
      },
    ],
  };
  const section = (
    st: ReturnType<typeof status> | null,
    picks: Polled<ManualPicksBody> | null,
  ) =>
    renderToStaticMarkup(
      <ManualPickSection
        status={st}
        picks={picks}
        busy={false}
        onPick={noop}
        onForget={noop}
      />,
    );

  test("says to load a game when there is no ROM", () => {
    expect(section(status("disconnected"), null)).toContain(
      "Load a game in the emulator to pick a profile for it.",
    );
    expect(section(null, null)).toContain("Load a game in the emulator");
  });

  test("refuses an expansion hack", () => {
    const html = section(
      status("unidentified", { rom: rom({ version: "2.1", tagged: true }) }),
      { kind: "ready", value: candidates },
    );
    expect(html).toContain(
      "This ROM is an expansion hack, which can&#x27;t be picked a profile.",
    );
    expect(html).not.toContain("Use this profile");
  });

  test("says an automatic match can't be overridden", () => {
    const st = status("game", {
      rom: rom(),
      game: { name: "Emerald", match: "auto" } as never,
    });
    expect(section(st, null)).toContain(
      "an automatic match can&#x27;t be overridden",
    );
  });

  test("lists each candidate with how it matched, for an unidentified ROM", () => {
    const html = section(unidentified, { kind: "ready", value: candidates });
    expect(html).toContain("Emerald (US) (header matches, signature matches)");
    expect(html).toContain("FireRed (US)</option>");
    expect(html).toContain("Use this profile");
  });

  test("says when no profile is a candidate", () => {
    const html = section(unidentified, {
      kind: "ready",
      value: { ...candidates, candidates: [] },
    });
    expect(html).toContain("No profile is a candidate for this ROM.");
  });

  test("a manual match names the profile and offers to forget it", () => {
    const st = status("game", {
      rom: rom(),
      game: { name: "Emerald", match: "manual" } as never,
    });
    const html = section(st, { kind: "ready", value: candidates });
    expect(html).toContain("Using Emerald because you picked it.");
    expect(html).toContain("Forget this pick");
  });

  test("a 404 says the program can't list candidates yet, other failures show their message", () => {
    expect(
      section(unidentified, {
        kind: "unavailable",
        code: null,
        status: 404,
        message: "Not found.",
      }),
    ).toContain("This program can&#x27;t list candidate profiles yet.");
    const other = section(unidentified, {
      kind: "unavailable",
      code: null,
      status: 500,
      message: "Boom.",
    });
    expect(other).toContain(
      "The candidate profiles can&#x27;t be read right now.",
    );
    expect(other).toContain("Boom.");
    expect(section(unidentified, { kind: "loading" })).toContain(
      "Reading the candidate profiles.",
    );
  });
});
