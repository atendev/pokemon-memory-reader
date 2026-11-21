import { describe, expect, test } from "bun:test";
import { Bytes } from "../../src/format/bytes";
import { gen3Player } from "../../src/format/gen3/player";
import { PLAYER } from "../../src/format/gen3/structs";
import type { DecodeContext } from "../../src/format/types";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import type { Profile } from "../../src/profile/schema";
import { referenceData } from "../../src/reference";
import { BADGE_NAMES } from "../../src/reference/badges";
import { encodeText } from "./encode";

const loaded = loadProfiles({ builtin: [emerald], user: [] });
const found = loaded.registry.get("emerald-us-1.0");
if (found?.dataFormat !== "gen3") throw new Error("Emerald profile missing");
const profile: Profile<"gen3"> = found;
const reference = referenceData("gen3", "en");
if (!reference) throw new Error("Gen 3 English reference data missing");
const ctxFor = (p: Profile<"gen3">): DecodeContext<Profile<"gen3">> => ({
  profile: p,
  ...reference,
  names: { ...reference.names, locations: reference.locations("emerald") },
});

interface Fields {
  minutes?: number;
  seconds?: number;
  frames?: number;
  money?: number;
  key?: number;
  flags?: readonly number[];
  x?: number;
  y?: number;
  section?: number;
}

/** The slices the decoder asks for, built from the fields the real memory would hold. */
function slices(fields: Fields = {}) {
  const identity = new Uint8Array(PLAYER.identitySize);
  const view = new DataView(identity.buffer);
  identity.set(encodeText("BRENDAN", PLAYER.nameLength), PLAYER.name);
  view.setUint16(PLAYER.trainerId, 12345, true);
  view.setUint16(PLAYER.secretId, 6789, true);
  view.setUint16(PLAYER.hours, 123, true);
  identity[PLAYER.minutes] = fields.minutes ?? 4;
  identity[PLAYER.seconds] = fields.seconds ?? 5;
  identity[PLAYER.frames] = fields.frames ?? 6;
  const position = new Uint8Array(PLAYER.positionSize);
  new DataView(position.buffer).setInt16(PLAYER.x, fields.x ?? 7, true);
  new DataView(position.buffer).setInt16(PLAYER.y, fields.y ?? 8, true);
  position[PLAYER.mapGroup] = 1;
  position[PLAYER.mapNumber] = 2;
  const key = new Uint8Array(4);
  new DataView(key.buffer).setUint32(0, fields.key ?? 0, true);
  const money = new Uint8Array(4);
  new DataView(money.buffer).setUint32(
    0,
    ((fields.money ?? 0) ^ (fields.key ?? 0)) >>> 0,
    true,
  );
  const first = Math.min(...profile.player.badgeFlags) >> 3;
  const flags = new Uint8Array(2);
  for (const id of fields.flags ?? []) {
    const flag = profile.player.badgeFlags[id] ?? 0;
    const at = (flag >> 3) - first;
    flags[at] = (flags[at] ?? 0) | (1 << (flag & 7));
  }
  return {
    identity: new Bytes(identity),
    position: new Bytes(position),
    money: new Bytes(money),
    flags: new Bytes(flags),
    section: new Bytes(Uint8Array.of(fields.section ?? 0)),
    key: new Bytes(key),
  };
}

const decode = (fields?: Fields, p: Profile<"gen3"> = profile) =>
  gen3Player.decode(slices(fields), ctxFor(p));

describe("the player decoder", () => {
  test("decodes the identity, play time and position", () => {
    const result = decode({ x: -3, y: 9, section: 0x1c });
    expect(result).toMatchObject({
      ok: true,
      value: {
        name: "BRENDAN",
        trainerId: 12345,
        secretId: 6789,
        playTime: { hours: 123, minutes: 4, seconds: 5, frames: 6 },
        location: { mapGroup: 1, mapNumber: 2, x: -3, y: 9 },
      },
    });
  });

  test("decrypts the money with the save's key", () => {
    const result = decode({ money: 54321, key: 0xdeadbeef });
    expect(result.ok && result.value.money).toBe(54321);
  });

  test("money above 2^31 stays unsigned", () => {
    const result = decode({ money: 0xfffffff0, key: 0x80000001 });
    expect(result.ok && result.value.money).toBe(0xfffffff0);
  });

  test("a profile with no key reads the money as stored", () => {
    const { encryptionKeyOffset: _, ...player } = profile.player;
    const keyless = { ...profile, player } as Profile<"gen3">;
    const result = gen3Player.decode(
      { ...slices({ money: 1234 }), key: new Bytes(Uint8Array.of(9, 9, 9, 9)) },
      ctxFor(keyless),
    );
    expect(result.ok && result.value.money).toBe(1234);
    expect(Object.keys(gen3Player.regions(keyless)).sort()).toEqual([
      "flags",
      "identity",
      "key",
      "money",
      "position",
      "section",
    ]);
  });

  test("lists eight badges in game order, with the obtained flags and Hoenn names", () => {
    const result = decode({ flags: [0, 2, 7] });
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.badges.map((b) => b.id)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(result.value.badges.map((b) => b.obtained)).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(result.value.badges[0]?.name).toBe("Stone");
    expect(result.value.badges[7]?.name).toBe("Rain");
  });

  test("a hack profile gives every badge a null name", () => {
    const hack = { ...profile, kind: "hack" } as Profile<"gen3">;
    const result = decode({}, hack);
    expect(result.ok && result.value.badges.every((b) => b.name === null)).toBe(
      true,
    );
  });

  test("the section is the raw ID with its name, null when the table has none", () => {
    const named = decode({ section: 0x00 });
    expect(named.ok && named.value.location.section?.id).toBe(0);
    expect(named.ok && typeof named.value.location.section?.name).toBe(
      "string",
    );
    const unnamed = decode({ section: 0xfe });
    expect(unnamed.ok && unnamed.value.location.section).toEqual({
      id: 0xfe,
      name: null,
    });
  });

  test.each([
    ["minutes", { minutes: 60 }],
    ["seconds", { seconds: 60 }],
    ["frames", { frames: 60 }],
  ])("%s above 59 fails the resource", (_name, fields) => {
    expect(decode(fields).ok).toBe(false);
  });
});

describe("the badge names", () => {
  test("each art version's list matches its badge count", () => {
    for (const [artVersion, names] of Object.entries(BADGE_NAMES)) {
      const gen2 = ["gold", "silver", "crystal"].includes(artVersion);
      expect(names).toHaveLength(gen2 ? 16 : 8);
    }
  });
});

describe("the player regions", () => {
  test("Emerald declares small pointer regions and the map header", () => {
    const regions = gen3Player.regions(profile);
    expect(regions.identity).toMatchObject({ kind: "pointer", length: 0x13 });
    expect(regions.money).toMatchObject({ kind: "pointer", length: 4 });
    expect(regions.flags).toMatchObject({ kind: "pointer", length: 2 });
    expect(regions.key).toMatchObject({ kind: "pointer", length: 4 });
    expect(regions.section).toMatchObject({ kind: "static", length: 1 });
  });
});
