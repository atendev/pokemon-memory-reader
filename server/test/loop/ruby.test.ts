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
import ruby10 from "../../src/profile/builtin/ruby-us-1.0.json";
import ruby11 from "../../src/profile/builtin/ruby-us-1.1.json";
import ruby12 from "../../src/profile/builtin/ruby-us-1.2.json";
import sapphire10 from "../../src/profile/builtin/sapphire-us-1.0.json";
import sapphire11 from "../../src/profile/builtin/sapphire-us-1.1.json";
import sapphire12 from "../../src/profile/builtin/sapphire-us-1.2.json";
import { loadProfiles } from "../../src/profile/registry";
import { ManualClock } from "../bridge/manual-clock";
import {
  encodeMon,
  encodeText,
  partyBytes,
  storageBytes,
} from "../gen3/encode";
import { emeraldMemory, serve, TREECKO } from "../support/emerald-memory";
import { ALL_SUPPORTED } from "../support/supported";

const builds = [ruby10, ruby11, ruby12, sapphire10, sapphire11, sapphire12];
const { registry, problems } = loadProfiles({ builtin: builds, user: [] });

/**
 * pokeruby addresses, written out here from the `.sym` files so the test checks the generated profile instead of
 * reading it. The RAM symbols are the same in all six builds. Each is an EWRAM or IWRAM offset (the address minus its base).
 */
const RS = {
  party: 0x4360,
  partyCount: 0x4350,
  saveBlock1: 0x25734,
  saveBlock2: 0x24ea4,
  storage: 0x300a0,
  mapHeader: 0x2e828,
} as const;
/** `struct SaveBlock1` offsets from pokeruby `include/global.h`. Money is not XORed and SaveBlock2 has no key. */
const SB1 = {
  money: 0x490,
  flags: 0x1220,
  items: 0x560,
  keyItems: 0x5b0,
  balls: 0x600,
  tmhm: 0x640,
  berries: 0x740,
} as const;
/** FLAG_BADGE01_GET is SYSTEM_FLAGS (0x800) + 7. */
const BADGE_FLAG_1 = 0x807;
/** A ROM big enough for the signature words, which sit in code and data at 0x26ce4 and 0x39f4e4. */
const ROM_SIZE = 0x400000;

type Build = (typeof builds)[number];

function rubyMemory(build: Build) {
  const memory = emeraldMemory([{ ...TREECKO, nickname: "BULBA", species: 1 }]);
  const { ewram, iwram } = memory;
  const rom = new Uint8Array(ROM_SIZE);
  memory.rom = rom;
  // Undo the Emerald party, then write the Ruby ones. English Ruby has no GF header, only the identify header words.
  ewram.fill(0);
  rom.set(new TextEncoder().encode(build.identify.header.gameCode), 0xac);
  rom[0xbc] = build.identify.header.revision;
  for (const word of build.identify.signature) {
    const bytes = word.bytes.match(/../g) ?? [];
    rom.set(
      bytes.map((byte) => Number.parseInt(byte, 16)),
      Number.parseInt(word.address, 16) - 0x08000000,
    );
  }
  iwram[RS.partyCount] = 1;
  iwram.set(
    partyBytes([encodeMon({ ...TREECKO, nickname: "BULBA", species: 1 })]),
    RS.party,
  );

  const view = new DataView(ewram.buffer);
  ewram.set(encodeText("RUBY", 8), RS.saveBlock2);
  view.setUint16(RS.saveBlock2 + 0x0a, 4242, true);
  view.setUint16(RS.saveBlock2 + 0x0c, 777, true);
  view.setUint16(RS.saveBlock2 + 0x0e, 12, true);
  ewram[RS.saveBlock2 + 0x10] = 34;
  ewram[RS.saveBlock2 + 0x11] = 56;
  view.setInt16(RS.saveBlock1, 5, true);
  view.setInt16(RS.saveBlock1 + 2, 6, true);
  ewram[RS.saveBlock1 + 4] = 3;
  ewram[RS.saveBlock1 + 5] = 4;
  view.setUint32(RS.saveBlock1 + SB1.money, 3000, true);
  for (const id of [0, 2]) {
    const flag = BADGE_FLAG_1 + id;
    const at = RS.saveBlock1 + SB1.flags + (flag >> 3);
    ewram[at] = (ewram[at] ?? 0) | (1 << (flag & 7));
  }
  ewram[RS.mapHeader + 0x14] = 0x58;
  const slot = (
    pocket: number,
    index: number,
    id: number,
    quantity: number,
  ) => {
    view.setUint16(RS.saveBlock1 + pocket + index * 4, id, true);
    view.setUint16(RS.saveBlock1 + pocket + index * 4 + 2, quantity, true);
  };
  slot(SB1.items, 19, 13, 7);
  slot(SB1.keyItems, 19, 259, 1);
  slot(SB1.balls, 15, 4, 5);
  slot(SB1.tmhm, 63, 339, 1);
  slot(SB1.berries, 45, 133, 9);

  ewram.set(
    storageBytes({
      currentBox: 3,
      slots: { 13: { 29: encodeMon({ ...TREECKO, nickname: "LAST" }) } },
    }),
    RS.storage,
  );
  return memory;
}

class RubyAdapter implements Adapter {
  readonly id = "mgba";
  readonly limits = { minIntervalMs: 0, mergeGap: 32 };
  state: AdapterState;
  memory: ReturnType<typeof rubyMemory>;
  readonly #listeners = new Set<(state: AdapterState) => void>();

  constructor(build: Build) {
    this.memory = rubyMemory(build);
    this.state = {
      connection: "connected",
      bridge: null,
      problem: null,
      game: {
        platform: "gba",
        crc32: build.identify.crc32[0] ?? null,
        sha1: null,
        romName: build.name,
        domains: { rom: ROM_SIZE, ewram: 0x40000, iwram: 0x8000 },
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
    supported: ALL_SUPPORTED,
    adapter: new RubyAdapter(build),
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

test("all six builds load with no profile problems", () => {
  expect(problems).toEqual([]);
  expect(
    registry
      .all()
      .map((profile) => profile.id)
      .sort(),
  ).toEqual([
    "ruby-us-1.0",
    "ruby-us-1.1",
    "ruby-us-1.2",
    "sapphire-us-1.0",
    "sapphire-us-1.1",
    "sapphire-us-1.2",
  ]);
});

describe.each(builds)("$id on synthetic Ruby memory", (build) => {
  test("identifies by hash with the two anchored signature words matching", async () => {
    const get = await start(build);
    const status = StatusResource.parse(await (await get("/status")).json());
    expect(status.game).toMatchObject({
      profileId: build.id,
      match: "exact",
      signature: "match",
    });
  });

  test("decodes the party from the static IWRAM party", async () => {
    const get = await start(build);
    const party = Party.parse(await (await get("/party")).json());
    expect(party.pokemon[0]?.nickname).toBe("BULBA");
  });

  test("decodes the player with money in the clear and the badges flagged for Ruby", async () => {
    const get = await start(build);
    const player = Player.parse(await (await get("/player")).json());
    expect(player).toMatchObject({
      name: "RUBY",
      trainerId: 4242,
      secretId: 777,
      money: 3000,
      playTime: { hours: 12, minutes: 34, seconds: 56, frames: 0 },
      location: {
        mapGroup: 3,
        mapNumber: 4,
        x: 5,
        y: 6,
        section: { id: 0x58 },
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
      20, 20, 16, 64, 46,
    ]);
  });

  test("decodes the boxes from the static storage address", async () => {
    const get = await start(build);
    const boxes = Boxes.parse(await (await get("/boxes")).json());
    expect(boxes.currentBox).toBe(3);
    expect(boxes.boxes[13]?.slots[29]?.nickname).toBe("LAST");
  });
});
