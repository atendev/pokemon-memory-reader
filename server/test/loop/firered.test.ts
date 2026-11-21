import { afterEach, describe, expect, test } from "bun:test";
import {
  Bag,
  Boxes,
  Party,
  Player,
  StatusResource,
} from "@pokemon-memory-reader/api/schemas";
import type {
  Adapter,
  AdapterState,
  Range,
  ReadOutcome,
} from "../../src/adapter/types";
import { createApp } from "../../src/app/app";
import type { Log } from "../../src/log";
import { createReadLoop } from "../../src/loop/read-loop";
import firered10 from "../../src/profile/builtin/firered-us-1.0.json";
import firered11 from "../../src/profile/builtin/firered-us-1.1.json";
import leafgreen10 from "../../src/profile/builtin/leafgreen-us-1.0.json";
import leafgreen11 from "../../src/profile/builtin/leafgreen-us-1.1.json";
import { loadProfiles } from "../../src/profile/registry";
import { ManualClock } from "../bridge/manual-clock";
import {
  encodeMon,
  encodeText,
  partyBytes,
  storageBytes,
} from "../gen3/encode";
import { emeraldMemory, serve, TREECKO } from "../support/emerald-memory";

const builds = [firered10, firered11, leafgreen10, leafgreen11];
const { registry, problems } = loadProfiles({ builtin: builds, user: [] });

/**
 * pokefirered addresses, written out here from the `.sym` files so the test checks the generated profile instead of
 * reading it. They are the same in all four builds. Each is an EWRAM or IWRAM offset (the address minus its base).
 */
const FR = {
  party: 0x24284,
  partyCount: 0x24029,
  saveBlock1Ptr: 0x5008,
  saveBlock2Ptr: 0x500c,
  storagePtr: 0x5010,
  mapHeader: 0x36dfc,
  one: 0x25000,
  two: 0x29000,
  storage: 0x10000,
} as const;
/** `struct SaveBlock1` and `SaveBlock2` offsets from pokefirered `include/global.h`. */
const SB1 = {
  money: 0x290,
  flags: 0xee0,
  items: 0x310,
  keyItems: 0x3b8,
  balls: 0x430,
  tmhm: 0x464,
  berries: 0x54c,
} as const;
const SB2_KEY = 0xf20;
/** FLAG_BADGE01_GET is SYS_FLAGS (0x800) + 0x20. */
const BADGE_FLAG_1 = 0x820;
const KEY = 0x1234abcd;

type Build = (typeof builds)[number];

function frlgMemory(build: Build) {
  const memory = emeraldMemory([{ ...TREECKO, nickname: "BULBA", species: 1 }]);
  const { ewram, iwram, rom } = memory;
  // Undo the Emerald party and header bytes, then write the FireRed ones.
  ewram.fill(0);
  rom.fill(0);
  rom.set(new TextEncoder().encode(build.identify.header.gameCode), 0xac);
  rom[0xbc] = build.identify.header.revision;
  for (const word of build.identify.signature) {
    const bytes = word.bytes.match(/../g) ?? [];
    rom.set(
      bytes.map((byte) => Number.parseInt(byte, 16)),
      Number.parseInt(word.address, 16) - 0x08000000,
    );
  }
  ewram[FR.partyCount] = 1;
  ewram.set(
    partyBytes([encodeMon({ ...TREECKO, nickname: "BULBA", species: 1 })]),
    FR.party,
  );

  const view = new DataView(ewram.buffer);
  const pointers = new DataView(iwram.buffer);
  pointers.setUint32(FR.saveBlock1Ptr, 0x02000000 + FR.one, true);
  pointers.setUint32(FR.saveBlock2Ptr, 0x02000000 + FR.two, true);
  pointers.setUint32(FR.storagePtr, 0x02000000 + FR.storage, true);

  ewram.set(encodeText("RED", 8), FR.two);
  view.setUint16(FR.two + 0x0a, 4242, true);
  view.setUint16(FR.two + 0x0c, 777, true);
  view.setUint16(FR.two + 0x0e, 12, true);
  ewram[FR.two + 0x10] = 34;
  ewram[FR.two + 0x11] = 56;
  view.setUint32(FR.two + SB2_KEY, KEY, true);
  view.setInt16(FR.one, 5, true);
  view.setInt16(FR.one + 2, 6, true);
  ewram[FR.one + 4] = 3;
  ewram[FR.one + 5] = 4;
  view.setUint32(FR.one + SB1.money, (3000 ^ KEY) >>> 0, true);
  for (const id of [0, 2]) {
    const flag = BADGE_FLAG_1 + id;
    const at = FR.one + SB1.flags + (flag >> 3);
    ewram[at] = (ewram[at] ?? 0) | (1 << (flag & 7));
  }
  ewram[FR.mapHeader + 0x14] = 0x58;
  const slot = (
    pocket: number,
    index: number,
    id: number,
    quantity: number,
  ) => {
    view.setUint16(FR.one + pocket + index * 4, id, true);
    view.setUint16(
      FR.one + pocket + index * 4 + 2,
      (quantity ^ KEY) & 0xffff,
      true,
    );
  };
  slot(SB1.items, 41, 13, 7);
  slot(SB1.keyItems, 29, 259, 1);
  slot(SB1.balls, 12, 4, 5);
  slot(SB1.tmhm, 57, 339, 1);
  slot(SB1.berries, 42, 133, 9);

  ewram.set(
    storageBytes({
      currentBox: 3,
      slots: { 13: { 29: encodeMon({ ...TREECKO, nickname: "LAST" }) } },
    }),
    FR.storage,
  );
  return memory;
}

class FireRedAdapter implements Adapter {
  readonly id = "mgba";
  readonly limits = { minIntervalMs: 0, mergeGap: 32 };
  state: AdapterState;
  memory: ReturnType<typeof frlgMemory>;
  readonly #listeners = new Set<(state: AdapterState) => void>();

  constructor(build: Build) {
    this.memory = frlgMemory(build);
    this.state = {
      connection: "connected",
      bridge: null,
      problem: null,
      game: {
        platform: "gba",
        crc32: build.identify.crc32[0] ?? null,
        sha1: null,
        romName: build.name,
        domains: { rom: 0x400, ewram: 0x40000, iwram: 0x8000 },
      },
      gameEpoch: 1,
    };
  }

  subscribe(listener: (state: AdapterState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async read(ranges: readonly Range[]): Promise<ReadOutcome> {
    return {
      kind: "data",
      slices: ranges.map((range) => serve(this.memory, [range])),
    };
  }
}

const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
};
const silentLog: Log = { debug() {}, info() {}, warn() {}, error() {} };
const open: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const loop of open.splice(0)) await loop.close();
});

async function start(build: Build) {
  const clock = new ManualClock();
  const loop = createReadLoop({
    adapter: new FireRedAdapter(build),
    registry,
    pollHz: 20,
    clock,
    log: silentLog,
  });
  open.push(loop);
  const app = createApp({ resources: loop });
  for (let i = 0; i < 6; i++) {
    clock.advance(50);
    await flush();
  }
  return (path: string) => app.request(`/api/v2${path}`);
}

test("all four builds load with no profile problems", () => {
  expect(problems).toEqual([]);
  expect(
    registry
      .all()
      .map((profile) => profile.id)
      .sort(),
  ).toEqual([
    "firered-us-1.0",
    "firered-us-1.1",
    "leafgreen-us-1.0",
    "leafgreen-us-1.1",
  ]);
});

describe.each(builds)("$id on synthetic FireRed memory", (build) => {
  test("identifies by hash with a matching signature", async () => {
    const get = await start(build);
    const status = StatusResource.parse(await (await get("/status")).json());
    expect(status.game).toMatchObject({
      profileId: build.id,
      match: "exact",
      signature: "match",
    });
  });

  test("decodes the party", async () => {
    const get = await start(build);
    const party = Party.parse(await (await get("/party")).json());
    expect(party.pokemon[0]?.nickname).toBe("BULBA");
  });

  test("decodes the player with money and the badges XORed and flagged for FireRed", async () => {
    const get = await start(build);
    const player = Player.parse(await (await get("/player")).json());
    expect(player).toMatchObject({
      name: "RED",
      trainerId: 4242,
      secretId: 777,
      money: 3000,
      playTime: { hours: 12, minutes: 34, seconds: 56, frames: 0 },
      location: {
        mapGroup: 3,
        mapNumber: 4,
        x: 5,
        y: 6,
        section: { id: 0x58, name: "PALLET TOWN" },
      },
    });
    expect(player.badges.map((badge) => badge.obtained)).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  test("decodes the last slot of every bag pocket", async () => {
    const get = await start(build);
    const bag = Bag.parse(await (await get("/bag")).json());
    const last = bag.pockets.map((pocket) => pocket.items.at(-1));
    expect(last.map((item) => item?.quantity)).toEqual([7, 1, 5, 1, 9]);
    expect(bag.pockets.map((pocket) => pocket.capacity)).toEqual([
      42, 30, 13, 58, 43,
    ]);
  });

  test("decodes the boxes through the storage pointer", async () => {
    const get = await start(build);
    const boxes = Boxes.parse(await (await get("/boxes")).json());
    expect(boxes.currentBox).toBe(3);
    expect(boxes.boxes[13]?.slots[29]?.nickname).toBe("LAST");
  });
});
