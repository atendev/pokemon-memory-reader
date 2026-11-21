import { describe, expect, test } from "bun:test";
import { StatusResource } from "@pokemon-memory-reader/api/schemas";
import type { AdapterState, GameInfo } from "../../src/adapter/types";
import type { Identification } from "../../src/identify/identify";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import { buildStatus, isUsable } from "../../src/resource/status";

const { registry } = loadProfiles({ builtin: [emerald], user: [] });

const game: GameInfo = {
  platform: "gba",
  crc32: "1f1c08fb",
  sha1: null,
  romName: "Emerald",
  domains: { rom: 0x100000 },
};
const header = {
  platform: "gba",
  title: "POKEMON EMER",
  gameCode: "BPEE",
  revision: 0,
} as const;

const connected: AdapterState = {
  connection: "connected",
  bridge: {
    bridge: "mgba",
    protocol: 1,
    build: "b",
    emulator: { name: "mGBA", version: "0.10" },
  },
  problem: null,
  game,
  gameEpoch: 1,
};

const status = (
  adapter: AdapterState,
  identification = null as never,
  stalled = false,
) => buildStatus({ adapterId: "mgba", adapter, identification, stalled });

describe("buildStatus", () => {
  test("disconnected: no adapter detail, no ROM", () => {
    const result = status({
      ...connected,
      connection: "disconnected",
      bridge: null,
      game: null,
    });
    expect(StatusResource.parse(result)).toMatchObject({
      state: "disconnected",
      adapter: null,
      rom: null,
      game: null,
    });
  });

  test("a problem keeps the adapter detail and reads as disconnected", () => {
    const result = status({ ...connected, problem: "busy" });
    expect(result.state).toBe("disconnected");
    expect(result.adapter).toMatchObject({ id: "mgba", problem: "busy" });
    expect(result.rom).toBeNull();
  });

  test("no game while connected with no ROM", () => {
    const result = status({ ...connected, game: null });
    expect(result.state).toBe("no_game");
    expect(result.rom).toBeNull();
    expect(result.adapter).toMatchObject({ stalled: false });
  });

  test("adapter.stalled follows the flag it is given", () => {
    expect(status(connected, null as never, true).adapter).toMatchObject({
      stalled: true,
    });
    expect(status(connected).adapter).toMatchObject({ stalled: false });
  });

  test("no_game while identification is pending, with the ROM hashes known", () => {
    const result = status(connected);
    expect(result.state).toBe("no_game");
    expect(result.rom).toMatchObject({ crc32: "1f1c08fb", title: null });
  });

  test("unidentified keeps the header", () => {
    const identification: Identification = {
      kind: "unidentified",
      reason: "no_match",
      header: { ...header, gameCode: "ZZZZ" },
    };
    const result = status(connected, identification as never);
    expect(result.state).toBe("unidentified");
    expect(result.rom).toMatchObject({ gameCode: "ZZZZ" });
    expect(result.game).toBeNull();
  });

  const profile = registry.get("emerald-us-1.0");
  if (!profile) throw new Error("Emerald profile missing");

  test.each([
    ["exact", "match"],
    ["exact", "mismatch"],
    ["header", "match"],
    ["header", "unchecked"],
  ] as const)(
    "identified by %s with signature %s carries both",
    (match, signature) => {
      const identification: Identification = {
        kind: "identified",
        profile,
        match,
        signature,
        header,
      };
      const result = StatusResource.parse(
        status(connected, identification as never),
      );
      expect(result.state).toBe("game");
      expect(result.game).toMatchObject({
        profileId: "emerald-us-1.0",
        match,
        signature,
        generation: 3,
      });
      expect(result.game?.names.species).toBe("builtin");
    },
  );

  test("a profile with no signature reports null", () => {
    const identification: Identification = {
      kind: "identified",
      profile,
      match: "header",
      signature: null,
      header,
    };
    expect(
      StatusResource.parse(status(connected, identification as never)).game
        ?.signature,
    ).toBeNull();
  });

  test("rom carries RetroArch's content name and the hashes", () => {
    const retroarch: AdapterState = {
      ...connected,
      game: { ...game, crc32: null, sha1: null, contentName: "Emerald (USA)" },
    };
    expect(status(retroarch).rom).toMatchObject({
      contentName: "Emerald (USA)",
      crc32: null,
      sha1: null,
    });
    expect(status(connected).rom).toMatchObject({ contentName: null });
  });

  test("isUsable needs a connection and no problem", () => {
    expect(isUsable(connected)).toBe(true);
    expect(isUsable({ ...connected, problem: "busy" })).toBe(false);
    expect(isUsable({ ...connected, connection: "connecting" })).toBe(false);
  });
});
