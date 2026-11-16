import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildBridge, checkSettings } from "../../../bridges/src/build";
import { DOMAIN_CODES } from "../../src/adapter/bridge/constants";
import {
  decodeJsonBody,
  type GameBody,
  type HelloBody,
} from "../../src/adapter/bridge/messages";
import {
  encodeFrame,
  encodeReadBody,
  type Frame,
  FrameDecoder,
} from "../../src/adapter/bridge/wire";

const STUB = resolve(import.meta.dir, "../../../bridges/test/mgba_stub.lua");
const LUA = process.env.LUA_BIN ?? "lua";

const SETTINGS = { host: "127.0.0.1", port: 7426, build: "2.0.0-test" };

describe("build settings", () => {
  test("accept an IPv4 or IPv6 literal and a plain version", () => {
    expect(() => checkSettings(SETTINGS)).not.toThrow();
    expect(() => checkSettings({ ...SETTINGS, host: "::1" })).not.toThrow();
    expect(() =>
      checkSettings({ ...SETTINGS, host: "::ffff:7f00:1" }),
    ).not.toThrow();
  });

  test.each([
    ["a hostname", { host: "localhost" }],
    ["the IPv4 wildcard", { host: "0.0.0.0" }],
    ["the IPv6 wildcard", { host: "::" }],
    ["the IPv6 wildcard as ::0", { host: "::0" }],
    ["the IPv6 wildcard written out with a gap", { host: "0:0::0" }],
    ["the IPv6 wildcard written out", { host: "0:0:0:0:0:0:0:0" }],
    ["the IPv6 wildcard as 0::", { host: "0::" }],
    ["the IPv4-mapped wildcard", { host: "::ffff:0.0.0.0" }],
    ["the wildcard with a zone", { host: "::%lo" }],
    ["a port of zero", { port: 0 }],
    ["a port above 65535", { port: 65536 }],
    ["a fractional port", { port: 7426.5 }],
    ["a build with a quote", { build: '1"; os.exit() --' }],
  ])("reject %s", (_name, change) => {
    expect(() => checkSettings({ ...SETTINGS, ...change })).toThrow();
  });
});

describe("the generated mgba.lua", () => {
  test("holds the settings and the whole core, and nothing is left to fill", async () => {
    const source = await buildBridge("mgba", { ...SETTINGS, port: 7500 });
    expect(source).toContain('local HOST = "127.0.0.1"');
    expect(source).toContain("local PORT = 7500");
    expect(source).toContain('local BUILD = "2.0.0-test"');
    expect(source).toContain("function core.new(shim)");
    expect(source).not.toMatch(/@(HOST|PORT|BUILD)@/);
  });

  test("runs under the mGBA API stub: binds, says hello, serves a read and follows ROM changes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pmr-mgba-"));
    try {
      const path = join(dir, "mgba.lua");
      await writeFile(
        path,
        await buildBridge("mgba", {
          ...SETTINGS,
          host: "127.0.0.1",
          port: 7431,
        }),
      );
      const read = encodeFrame(
        3,
        1,
        encodeReadBody([
          { domain: "ewram", offset: 0x40, length: 8 },
          { domain: "rom", offset: 0xac, length: 4 },
        ]),
      );
      const proc = Bun.spawn(
        [LUA, STUB, path, Buffer.from(read).toString("hex")],
        { stdout: "pipe", stderr: "pipe" },
      );
      const [out, errText] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      expect(await proc.exited, errText).toBe(0);

      const lines = out.trim().split("\n");
      expect(lines.filter((l) => l.startsWith("bind "))).toEqual([
        "bind 127.0.0.1 7431",
      ]);
      expect(lines.filter((l) => l.startsWith("error "))).toEqual([]);

      // Frames sent between "step N" lines, decoded with the TypeScript codec.
      const byStep: Frame[][] = [];
      let current: Frame[] = [];
      const decoder = new FrameDecoder();
      for (const line of lines) {
        if (line.startsWith("send ")) {
          current.push(
            ...decoder.push(Buffer.from(line.slice(5), "hex")).frames,
          );
        } else if (line.startsWith("step ")) {
          byStep.push(current);
          current = [];
        }
      }
      expect(byStep).toHaveLength(5);
      const json = (frame: Frame | undefined) =>
        decodeJsonBody(frame?.body ?? new Uint8Array());

      // Step 1: hello, then the GBA game message.
      expect(byStep[0]?.map((f) => f.kind)).toEqual([1, 2]);
      expect(json(byStep[0]?.[0]) as HelloBody).toEqual({
        bridge: "mgba",
        protocol: 1,
        build: "2.0.0-test",
        emulator: { name: "mGBA", version: null },
      });
      expect(json(byStep[0]?.[1]) as GameBody).toEqual({
        platform: "gba",
        romName: "EMERALD",
        crc32: "1a2b3c4d",
        sha1: null,
        domains: { rom: 1048576, ewram: 262144, iwram: 32768 },
      });

      // Step 2: the DATA reply, with the stub's byte pattern.
      const data = byStep[1]?.[0];
      expect(data?.kind).toBe(4);
      expect(data?.id).toBe(1);
      const expected = (code: number, offset: number, n: number) =>
        Array.from({ length: n }, (_, i) => ((offset + i) * 7 + code) % 256);
      expect(Array.from(data?.body ?? [])).toEqual([
        ...expected(DOMAIN_CODES.ewram, 0x40, 8),
        ...expected(DOMAIN_CODES.rom, 0xac, 4),
      ]);

      // Step 3: a reset on the same ROM sends nothing.
      expect(byStep[2]).toEqual([]);

      // Step 4: a Game Boy ROM loads. A CGB-style WRAM size is reported as the shim reaches it.
      expect(byStep[3]).toHaveLength(1);
      expect(json(byStep[3]?.[0]) as GameBody).toEqual({
        platform: "gb",
        romName: null,
        crc32: "deadbeef",
        sha1: null,
        domains: { rom: 1048576, wram: 32768, hram: 127, sram: 32768 },
      });

      // Step 5: the ROM unloads.
      expect(byStep[4]).toHaveLength(1);
      expect(json(byStep[4]?.[0])).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("a bind that fails is retried every 2 s, and reported with the setting that controls the port", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pmr-mgba-"));
    try {
      const path = join(dir, "mgba.lua");
      await writeFile(path, await buildBridge("mgba", SETTINGS));
      const proc = Bun.spawn(
        [
          LUA,
          STUB,
          path,
          Buffer.from(encodeFrame(3, 1, encodeReadBody([]))).toString("hex"),
        ],
        {
          stdout: "pipe",
          stderr: "pipe",
          env: { ...process.env, STUB_BIND_FAILURES: "1", STUB_TICK: "1" },
        },
      );
      const out = await new Response(proc.stdout).text();
      expect(await proc.exited).toBe(0);
      expect(out).toContain(
        "log PMR bridge: bind failed: address in use (port 7426, adapters.mgba.port)",
      );
      // The stub's clock moves 1 s a frame: the first bind is at load, so frame 1 waits and frame 2 retries.
      const binds = [...out.matchAll(/^(bind |step )/gm)].map((m) => m[1]);
      expect(binds.slice(0, 4)).toEqual(["bind ", "step ", "bind ", "step "]);
      expect(out.match(/^bind /gm)).toHaveLength(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
