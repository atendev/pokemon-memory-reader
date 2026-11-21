import { describe, expect, test } from "bun:test";
import {
  changesUpdateCheck,
  draftFrom,
  fieldLocked,
  isLanHost,
  patchFrom,
  portChanged,
  savesBanner,
  sourceLabel,
  validate,
} from "./settings-form";
import { settingsBody } from "./testing";

const body = settingsBody();
const { settings } = body;

describe("the settings draft", () => {
  test("starts from the running values as text", () => {
    const draft = draftFrom(settings);
    expect(draft.port).toBe("7425");
    expect(draft.pollHz).toBe("20");
    expect(draft.adapter).toBe("auto");
    expect(draft.endpoints.mgba).toEqual({ host: "127.0.0.1", port: "7426" });
  });

  test("a startup setting waiting for a restart shows its saved value", () => {
    const waiting = settingsBody({
      settings: {
        ...settings,
        port: { ...settings.port, pending: 8000 },
      },
    });
    expect(draftFrom(waiting.settings).port).toBe("8000");
    expect(patchFrom(waiting.settings, draftFrom(waiting.settings))).toEqual(
      {},
    );
  });
});

describe("the save patch", () => {
  test("is empty when nothing changed", () => {
    expect(patchFrom(settings, draftFrom(settings))).toEqual({});
  });

  test("carries only the fields that changed, as numbers and booleans", () => {
    const draft = { ...draftFrom(settings), pollHz: "30", updateCheck: false };
    expect(patchFrom(settings, draft)).toEqual({
      pollHz: 30,
      updateCheck: false,
    });
  });

  test("sends only the endpoint parts that changed, under adapters", () => {
    const draft = draftFrom(settings);
    draft.endpoints.retroarch.port = "55400";
    expect(patchFrom(settings, draft)).toEqual({
      adapters: { retroarch: { port: 55400 } },
    });
  });

  test("a pin is sent as the adapter id", () => {
    const draft = { ...draftFrom(settings), adapter: "mgba" as const };
    expect(patchFrom(settings, draft)).toEqual({ adapter: "mgba" });
  });

  test("leaves out a field a flag sets, even when the draft differs", () => {
    const flagged = settingsBody({
      settings: { ...settings, port: { ...settings.port, source: "flag" } },
    });
    const draft = { ...draftFrom(flagged.settings), port: "9000" };
    expect(fieldLocked(flagged.settings, "port")).toBe(true);
    expect(patchFrom(flagged.settings, draft)).toEqual({});
    expect(validate(flagged.settings, { ...draft, port: "x" })).toEqual({});
  });

  test("a flag on adapters locks every endpoint field", () => {
    const flagged = settingsBody({
      settings: {
        ...settings,
        adapters: { ...settings.adapters, source: "flag" },
      },
    });
    expect(fieldLocked(flagged.settings, "mgba.port")).toBe(true);
    expect(fieldLocked(flagged.settings, "bizhawk.host")).toBe(true);
    expect(fieldLocked(flagged.settings, "pollHz")).toBe(false);
  });

  test("knows when it touches the update check", () => {
    expect(changesUpdateCheck({ updateCheck: false })).toBe(true);
    expect(changesUpdateCheck({ pollHz: 30 })).toBe(false);
  });
});

describe("checking the draft", () => {
  test("passes the running values", () => {
    expect(validate(settings, draftFrom(settings))).toEqual({});
  });

  test("names each bad field", () => {
    const draft = draftFrom(settings);
    draft.port = "70000";
    draft.host = "  ";
    draft.pollHz = "4";
    draft.endpoints.mgba.port = "abc";
    draft.endpoints.bizhawk.host = "";
    const errors = validate(settings, draft);
    expect(Object.keys(errors).sort()).toEqual([
      "bizhawk.host",
      "host",
      "mgba.port",
      "pollHz",
      "port",
    ]);
    expect(errors.pollHz).toBe("Enter a whole number from 5 to 60.");
  });

  test("takes the poll rate range's two ends and refuses a decimal", () => {
    for (const ok of ["5", "60"]) {
      expect(
        validate(settings, { ...draftFrom(settings), pollHz: ok }),
      ).toEqual({});
    }
    for (const bad of ["61", "12.5", "-5", ""]) {
      expect(
        validate(settings, { ...draftFrom(settings), pollHz: bad }).pollHz,
      ).toBeDefined();
    }
  });
});

describe("the bind address and port warnings", () => {
  test("loopback hosts are quiet and anything else warns", () => {
    for (const quiet of [
      "127.0.0.1",
      "localhost",
      "::1",
      "[::1]",
      "127.1.2.3",
    ]) {
      expect(isLanHost(quiet)).toBe(false);
    }
    for (const loud of ["0.0.0.0", "192.168.1.5", "::", "my-pc"]) {
      expect(isLanHost(loud)).toBe(true);
    }
  });

  test("a port change is flagged, and an unchanged or locked port isn't", () => {
    const draft = draftFrom(settings);
    expect(portChanged(settings, draft)).toBe(false);
    expect(portChanged(settings, { ...draft, port: "8000" })).toBe(true);
  });
});

describe("the refused saves banner", () => {
  test("is absent when saves are allowed", () => {
    expect(savesBanner(body)).toBeNull();
  });

  test("names the file and why, by refusal", () => {
    for (const [refusal, why] of [
      ["malformed", "is not valid JSON"],
      ["unreadable", "could not be read"],
      ["newer-version", "has a newer configVersion"],
    ] as const) {
      const text = savesBanner(
        settingsBody({ saves: { writable: false, refusal } }),
      );
      expect(text).toContain("/home/me/.pmr/config.json");
      expect(text).toContain(why);
    }
  });

  test("falls back to the file name when paths are hidden", () => {
    const text = savesBanner(
      settingsBody({
        paths: null,
        saves: { writable: false, refusal: "malformed" },
      }),
    );
    expect(text).toContain("config.json");
    expect(text).not.toContain("/home/me");
  });
});

test("each source has a label", () => {
  expect(sourceLabel("flag")).toBe("Set by a command-line flag");
  expect(sourceLabel("file")).toBe("From config.json");
  expect(sourceLabel("default")).toBe("Default");
});
