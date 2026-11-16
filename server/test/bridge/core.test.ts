import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  BRIDGE_CAPS,
  DOMAIN_CODES,
  ERROR_CODES,
  FRAME_KIND,
  MAX_BODY,
  PROTOCOL,
} from "../../src/adapter/bridge/constants";
import {
  decodeJsonBody,
  type ErrorBody,
  type ErrorCode,
  type GameBody,
  type HelloBody,
} from "../../src/adapter/bridge/messages";
import {
  createRequestIds,
  encodeFrame,
  encodeReadBody,
  type Frame,
  type Range,
} from "../../src/adapter/bridge/wire";
import { expectedBytes, LuaBridge, type TestClient } from "./lua-bridge";

const SIZES = "rom=1048576 ewram=262144 iwram=32768";
const LOAD_GBA = `load gba 1a2b3c4d - Emerald ${SIZES}`;

let bridge: LuaBridge;
let nextId: () => number;
const clients: TestClient[] = [];

beforeEach(async () => {
  bridge = new LuaBridge();
  nextId = createRequestIds();
  await bridge.start();
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.close();
  await bridge.stop();
});

async function connect(): Promise<TestClient> {
  const client = await bridge.connect();
  clients.push(client);
  return client;
}

/** Connects and consumes the hello and the first game message. */
async function connectReady(): Promise<TestClient> {
  const client = await connect();
  expect((await client.next()).kind).toBe(FRAME_KIND.HELLO);
  expect((await client.next()).kind).toBe(FRAME_KIND.GAME);
  return client;
}

function read(client: TestClient, ranges: readonly Range[]): number {
  const id = nextId();
  client.send(encodeFrame(FRAME_KIND.READ, id, encodeReadBody(ranges)));
  return id;
}

const json = <T>(frame: Frame) => decodeJsonBody(frame.body) as T;

async function expectError(
  client: TestClient,
  id: number,
  code: ErrorCode,
): Promise<ErrorBody> {
  const frame = await client.next();
  expect(frame.kind).toBe(FRAME_KIND.ERROR);
  expect(frame.id).toBe(id);
  const body = json<ErrorBody>(frame);
  expect(body.code).toBe(code);
  expect(body.message.length).toBeGreaterThan(0);
  return body;
}

test("the Lua core runs under Lua 5.3 or 5.4", async () => {
  const lines = await bridge.command("version");
  const version = lines.find((l) => l.startsWith("version "));
  console.log(`bridge tests run under ${version}`);
  const expected = process.env.EXPECT_LUA_VERSION;
  expect(version).toMatch(
    expected
      ? new RegExp(`^version Lua ${expected.replace(".", "\\.")}$`)
      : /^version Lua 5\.[34]$/,
  );
});

describe("protocol constants", () => {
  test("Lua and TypeScript agree", async () => {
    const lines = await bridge.command("constants");
    const line = lines.find((l) => l.startsWith("constants "));
    const lua = JSON.parse(line?.slice("constants ".length) ?? "null");
    expect(lua).toEqual({
      protocol: PROTOCOL,
      frameKind: FRAME_KIND,
      maxBody: MAX_BODY,
      caps: {
        maxRanges: BRIDGE_CAPS.maxRanges,
        maxBytes: BRIDGE_CAPS.maxBytes,
      },
      domainCodes: DOMAIN_CODES,
      errorCodes: [...ERROR_CODES],
    });
  });
});

describe("hello and game messages", () => {
  test("the hello is the first frame, then a null game with no ROM", async () => {
    const client = await connect();
    const hello = await client.next();
    expect(hello.kind).toBe(FRAME_KIND.HELLO);
    expect(hello.id).toBe(0);
    expect(json<HelloBody>(hello)).toEqual({
      bridge: "mgba",
      protocol: PROTOCOL,
      build: "test-build",
      emulator: { name: "FakeEmu", version: null },
    });
    const game = await client.next();
    expect(game.kind).toBe(FRAME_KIND.GAME);
    expect(game.id).toBe(0);
    expect(decodeJsonBody(game.body)).toBeNull();
  });

  test("a loaded ROM shows in the game message, with null for missing hashes", async () => {
    await bridge.command(LOAD_GBA);
    const client = await connect();
    await client.next();
    expect(json<GameBody>(await client.next())).toEqual({
      platform: "gba",
      romName: "Emerald",
      crc32: "1a2b3c4d",
      sha1: null,
      domains: { rom: 1048576, ewram: 262144, iwram: 32768 },
    });
  });

  test("loading, changing and unloading a ROM each send a game message", async () => {
    const client = await connectReady();
    await bridge.command(LOAD_GBA);
    expect(json<GameBody>(await client.next()).platform).toBe("gba");
    await bridge.command(
      "load gb - 0123456789abcdef0123456789abcdef01234567 - rom=32768 wram=32768 hram=127 sram=32768",
    );
    const gb = json<GameBody>(await client.next());
    expect(gb).toMatchObject({ platform: "gb", crc32: null, romName: null });
    expect(gb.sha1).toBe("0123456789abcdef0123456789abcdef01234567");
    await bridge.command("unload");
    expect(decodeJsonBody((await client.next()).body)).toBeNull();
    expect(await client.maybeNext(50)).toBeNull();
  });

  test("the game message arrives before the reply to a read on the new ROM", async () => {
    const client = await connectReady();
    await bridge.command("load gba 11111111 - First rom=65536");
    await client.next();
    // The ROM changes in the same callback that carries the read.
    await bridge.command("load gba 22222222 - Second rom=65536");
    const id = read(client, [{ domain: "rom", offset: 0, length: 4 }]);
    const first = await client.next();
    expect(first.kind).toBe(FRAME_KIND.GAME);
    expect(json<GameBody>(first).crc32).toBe("22222222");
    const reply = await client.next();
    expect(reply.kind).toBe(FRAME_KIND.DATA);
    expect(reply.id).toBe(id);
  });

  test("a version the emulator reports reaches the hello", async () => {
    await bridge.command("emuversion 0.10.5");
    const client = await connect();
    expect(json<HelloBody>(await client.next()).emulator.version).toBe(
      "0.10.5",
    );
  });
});

describe("reads", () => {
  beforeEach(async () => {
    await bridge.command(LOAD_GBA);
  });

  test("a multi-range read returns every range in request order, with the request's id", async () => {
    const client = await connectReady();
    const ranges: Range[] = [
      { domain: "rom", offset: 0x100, length: 16 },
      { domain: "ewram", offset: 0x2000, length: 300 },
      { domain: "iwram", offset: 0, length: 1 },
      { domain: "rom", offset: 1048576 - 8, length: 8 },
    ];
    const id = read(client, ranges);
    const reply = await client.next();
    expect(reply.kind).toBe(FRAME_KIND.DATA);
    expect(reply.id).toBe(id);
    expect(reply.body).toEqual(
      new Uint8Array(
        ranges.flatMap((r) => [...expectedBytes(r.domain, r.offset, r.length)]),
      ),
    );
  });

  test("a batch of 512 ranges that fills the 64 KiB cap is answered in full", async () => {
    const client = await connectReady();
    const ranges: Range[] = Array.from(
      { length: BRIDGE_CAPS.maxRanges },
      (_, i) => ({
        domain: "ewram",
        offset: i * 256,
        length: BRIDGE_CAPS.maxBytes / BRIDGE_CAPS.maxRanges,
      }),
    );
    const id = read(client, ranges);
    const reply = await client.next(5000);
    expect(reply.id).toBe(id);
    expect(reply.body.length).toBe(BRIDGE_CAPS.maxBytes);
    expect(reply.body).toEqual(
      new Uint8Array(
        ranges.flatMap((r) => [...expectedBytes("ewram", r.offset, r.length)]),
      ),
    );
  });

  test("a reply the emulator can only send in small pieces still arrives whole", async () => {
    await bridge.command("sendlimit 1500");
    const client = await connectReady();
    const id = read(client, [{ domain: "rom", offset: 0, length: 65536 }]);
    const reply = await client.next(5000);
    expect(reply.id).toBe(id);
    expect(reply.body).toEqual(expectedBytes("rom", 0, 65536));
  });

  test("a request that arrives a byte at a time is still one request", async () => {
    const client = await connectReady();
    const id = nextId();
    const frame = encodeFrame(
      FRAME_KIND.READ,
      id,
      encodeReadBody([{ domain: "rom", offset: 3, length: 5 }]),
    );
    for (const byte of frame) {
      client.send(Uint8Array.of(byte));
      await Bun.sleep(1);
    }
    const reply = await client.next();
    expect(reply.id).toBe(id);
    expect(reply.body).toEqual(expectedBytes("rom", 3, 5));
  });

  test("an empty read gets an empty DATA reply", async () => {
    const client = await connectReady();
    const id = read(client, []);
    const reply = await client.next();
    expect([reply.kind, reply.id, reply.body.length]).toEqual([
      FRAME_KIND.DATA,
      id,
      0,
    ]);
  });

  test("one request in flight: each reply carries its own id, and ids go up one at a time", async () => {
    const client = await connectReady();
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      const id = read(client, [{ domain: "rom", offset: i, length: 2 }]);
      const reply = await client.next();
      expect(reply.id).toBe(id);
      expect(reply.body).toEqual(expectedBytes("rom", i, 2));
      seen.push(reply.id);
    }
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });

  test("requests that arrive together are answered in order, one reply each", async () => {
    const client = await connectReady();
    const a = read(client, [{ domain: "rom", offset: 0, length: 4 }]);
    const b = read(client, [{ domain: "ewram", offset: 8, length: 4 }]);
    const first = await client.next();
    const second = await client.next();
    expect([first.id, second.id]).toEqual([a, b]);
    expect(first.body).toEqual(expectedBytes("rom", 0, 4));
    expect(second.body).toEqual(expectedBytes("ewram", 8, 4));
  });
});

describe("error codes", () => {
  beforeEach(async () => {
    await bridge.command(LOAD_GBA);
  });

  test("no_game: a read with no ROM loaded, and the connection stays open", async () => {
    await bridge.command("unload");
    const client = await connectReady();
    const id = read(client, [{ domain: "rom", offset: 0, length: 4 }]);
    await expectError(client, id, "no_game");
    await bridge.command(LOAD_GBA);
    expect((await client.next()).kind).toBe(FRAME_KIND.GAME);
    const again = read(client, [{ domain: "rom", offset: 0, length: 4 }]);
    expect((await client.next()).id).toBe(again);
  });

  test("bad_range: one bad range fails the whole request, and the connection stays open", async () => {
    const client = await connectReady();
    const cases: [string, Range[]][] = [
      [
        "past the end of the domain",
        [{ domain: "iwram", offset: 32768 - 4, length: 5 }],
      ],
      [
        "a domain this platform lacks",
        [{ domain: "wram", offset: 0, length: 1 }],
      ],
      [
        "one bad range among good ones",
        [
          { domain: "rom", offset: 0, length: 4 },
          { domain: "ewram", offset: 262144, length: 1 },
        ],
      ],
      [
        "an offset past u32 range sums",
        [{ domain: "rom", offset: 0xffffffff, length: 0xffff }],
      ],
    ];
    for (const [, ranges] of cases) {
      const id = read(client, ranges);
      await expectError(client, id, "bad_range");
    }
    const id = read(client, [
      { domain: "iwram", offset: 32768 - 4, length: 4 },
    ]);
    expect((await client.next()).kind).toBe(FRAME_KIND.DATA);
    expect(id).toBeGreaterThan(0);
  });

  test("bad_range: a domain code outside the table", async () => {
    const client = await connectReady();
    const id = nextId();
    const body = encodeReadBody([{ domain: "rom", offset: 0, length: 1 }]);
    body[2] = 7;
    client.send(encodeFrame(FRAME_KIND.READ, id, body));
    await expectError(client, id, "bad_range");
  });

  test("too_large: more than 64 KiB in one request, and the connection stays open", async () => {
    const client = await connectReady();
    const id = read(client, [
      { domain: "rom", offset: 0, length: BRIDGE_CAPS.maxBytes + 1 },
    ]);
    await expectError(client, id, "too_large");
    const split = read(client, [
      { domain: "rom", offset: 0, length: 40000 },
      { domain: "rom", offset: 0, length: 25537 },
    ]);
    await expectError(client, split, "too_large");
    const ok = read(client, [
      { domain: "rom", offset: 0, length: BRIDGE_CAPS.maxBytes },
    ]);
    expect((await client.next(5000)).id).toBe(ok);
  });

  test("unknown_kind: a known kind sent the wrong way, and the connection stays open", async () => {
    const client = await connectReady();
    for (const kind of [
      FRAME_KIND.HELLO,
      FRAME_KIND.GAME,
      FRAME_KIND.DATA,
      FRAME_KIND.ERROR,
    ]) {
      const id = nextId();
      client.send(encodeFrame(kind, id, new TextEncoder().encode("{}")));
      await expectError(client, id, "unknown_kind");
    }
    const id = read(client, [{ domain: "rom", offset: 0, length: 4 }]);
    expect((await client.next()).id).toBe(id);
  });

  test("internal: an error inside a request handler answers that request, and the connection stays open", async () => {
    const client = await connectReady();
    await bridge.command("failread");
    const id = read(client, [{ domain: "rom", offset: 0, length: 4 }]);
    const body = await expectError(client, id, "internal");
    expect(body.message).toContain("boom");
    const next = read(client, [{ domain: "rom", offset: 0, length: 4 }]);
    expect((await client.next()).id).toBe(next);
  });

  test("internal: a long error text is cut to fit the 4 KiB error body", async () => {
    const client = await connectReady();
    await bridge.command("failread long");
    const id = read(client, [{ domain: "rom", offset: 0, length: 4 }]);
    const frame = await client.next();
    expect(frame.id).toBe(id);
    expect(frame.body.length).toBeLessThanOrEqual(MAX_BODY.ERROR);
    expect(json<ErrorBody>(frame).code).toBe("internal");
  });

  test("busy: a second client gets the hello and a busy error, then is closed, and the first is unaffected", async () => {
    const first = await connectReady();
    const second = await connect();
    expect((await second.next()).kind).toBe(FRAME_KIND.HELLO);
    await expectError(second, 0, "busy");
    await second.closed;
    const id = read(first, [{ domain: "rom", offset: 0, length: 4 }]);
    expect((await first.next()).id).toBe(id);
  });

  describe("bad_frame: the bridge sends the error with id 0, then closes", () => {
    const frameWithLength = (length: number, kind: number) => {
      const bytes = new Uint8Array(9);
      const view = new DataView(bytes.buffer);
      view.setUint32(0, length);
      view.setUint8(4, kind);
      return bytes;
    };
    const cases: [string, () => Uint8Array][] = [
      [
        "513 ranges, one over the cap",
        () => {
          const body = new Uint8Array(2 + 9 * 513);
          new DataView(body.buffer).setUint16(0, 513);
          return encodeFrame(FRAME_KIND.READ, 1, body);
        },
      ],
      ["a length below the header", () => frameWithLength(4, FRAME_KIND.READ)],
      ["a kind outside the table", () => frameWithLength(5, 9)],
      ["a kind of zero", () => frameWithLength(5, 0)],
      [
        "a READ over its limit",
        () => frameWithLength(4611 + 5, FRAME_KIND.READ),
      ],
      [
        "a READ body whose count disagrees with its length",
        () => {
          const body = encodeReadBody([
            { domain: "rom", offset: 0, length: 4 },
          ]);
          body[1] = 2;
          return encodeFrame(FRAME_KIND.READ, 1, body);
        },
      ],
      [
        "a READ body shorter than its count",
        () => encodeFrame(FRAME_KIND.READ, 1, Uint8Array.of(0)),
      ],
    ];
    for (const [name, make] of cases) {
      test(name, async () => {
        const client = await connectReady();
        client.send(make());
        await expectError(client, 0, "bad_frame");
        await client.closed;
        expect(await client.maybeNext(20)).toBeNull();
      });
    }

    test("a client can reconnect after a bad frame", async () => {
      const client = await connectReady();
      client.send(frameWithLength(5, 9));
      await client.closed;
      const again = await connectReady();
      const id = read(again, [{ domain: "rom", offset: 0, length: 4 }]);
      expect((await again.next()).id).toBe(id);
    });
  });
});

describe("the bridge's own failures", () => {
  test("an error outside a request handler is logged and closes the client", async () => {
    await bridge.command(LOAD_GBA);
    const client = await connectReady();
    await bridge.command("failreceive");
    await client.closed;
    expect(
      bridge.logs.some((l) => l.includes("bridge error: receive blew up")),
    ).toBe(true);
    const again = await connectReady();
    expect(again).toBeDefined();
  });

  test("a failed bind is logged and retried every 2 seconds", async () => {
    const fresh = new LuaBridge();
    try {
      await fresh.command("bindfail 2");
      await fresh.command("open 1");
      await fresh.command("step");
      expect(
        fresh.logs.filter((l) => l.startsWith("bind failed")),
      ).toHaveLength(1);
      await fresh.command("time 1");
      await fresh.command("step");
      expect(
        fresh.logs.filter((l) => l.startsWith("bind failed")),
      ).toHaveLength(1);
      await fresh.command("time 2");
      await fresh.command("step");
      expect(
        fresh.logs.filter((l) => l.startsWith("bind failed")),
      ).toHaveLength(2);
      await fresh.command("time 4");
      const out = await fresh.command("step");
      expect(fresh.logs).toContain("listening");
      expect(out.some((l) => l.startsWith("send 1 "))).toBe(true);
    } finally {
      await fresh.stop();
    }
  });

  test("a serving session is logged from the first read, not from the connect", async () => {
    await bridge.command(LOAD_GBA);
    const client = await connectReady();
    expect(bridge.logs).not.toContain("serving session started");
    const id = read(client, [{ domain: "rom", offset: 0, length: 4 }]);
    await client.next();
    expect(id).toBeGreaterThan(0);
    expect(bridge.logs).toContain("serving session started");
    client.close();
    await client.closed;
    await Bun.sleep(30);
    expect(bridge.logs).toContain("serving session ended");
  });
});
