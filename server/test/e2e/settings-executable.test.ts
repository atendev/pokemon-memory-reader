import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ManualPicksBody } from "@pokemon-memory-reader/internal/manual-picks-route";
import { FakeBridge, GBA_GAME } from "../bridge/fake-bridge";
import { emeraldMemory, serve, TREECKO } from "../support/emerald-memory";

/**
 * Runs the compiled executable against the fake bridge and checks the routes the Settings and About
 * screens read, a refused write, and the screens' code in the served viewer. It needs a built
 * executable, so it runs only when `PMR_EXECUTABLE` names one (the compile-smoke CI job sets it).
 */
const executable = process.env.PMR_EXECUTABLE;
const suite = executable ? describe : describe.skip;

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === "object" && address
          ? resolvePort(address.port)
          : reject(new Error("no port")),
      );
    });
  });
}

suite("the Settings and About screens on the compiled executable", () => {
  const bridge = new FakeBridge();
  let child: Bun.Subprocess | null = null;
  let dataDir = "";
  let base = "";

  const poll = async <T>(path: string): Promise<T | null> => {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${base}${path}`);
        if (response.ok) return (await response.json()) as T;
      } catch {}
      await Bun.sleep(100);
    }
    return null;
  };

  beforeAll(async () => {
    const memory = emeraldMemory([TREECKO]);
    bridge.game = { ...GBA_GAME, crc32: "1f1c08fb" };
    bridge.onRead = (read, socket) =>
      bridge.reply(socket, read.id, serve(memory, read.ranges));
    bridge.start();
    dataDir = await mkdtemp(join(tmpdir(), "pmr-settings-e2e-"));
    await writeFile(
      join(dataDir, "config.json"),
      JSON.stringify({
        version: 1,
        adapters: { mgba: { host: "127.0.0.1", port: bridge.port } },
      }),
    );
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    child = Bun.spawn(
      [
        resolve(executable as string),
        "--no-browser",
        "--port",
        String(port),
        "--data-dir",
        dataDir,
      ],
      { stdout: "ignore", stderr: "ignore" },
    );
  });

  afterAll(async () => {
    child?.kill("SIGKILL");
    bridge.stop();
    await rm(dataDir, { recursive: true, force: true });
  });

  test("serves the settings the screen shows, with the folders on this machine", async () => {
    const body = await poll<{
      settings: {
        pollHz: { value: number; source: string };
        updateCheck: { value: boolean };
        adapters: { value: { mgba: { port: number } } };
      };
      saves: { writable: boolean };
      paths: { dataFolder: string; configFile: string } | null;
    }>("/settings");
    expect(body?.settings.pollHz.value).toBe(20);
    expect(body?.settings.adapters.value.mgba.port).toBe(bridge.port);
    expect(typeof body?.settings.updateCheck.value).toBe("boolean");
    expect(body?.saves.writable).toBe(true);
    expect(body?.paths?.dataFolder).toBe(dataDir);
    expect(body?.paths?.configFile).toBe(join(dataDir, "config.json"));
  }, 30_000);

  test("serves the version the About screen shows", async () => {
    const body = await poll<{
      version: string;
      versionLine: string;
      protocol: number;
      commit: string;
      lgpl: unknown[];
    }>("/about");
    expect(body?.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(body?.versionLine).toContain(body?.version as string);
    expect(body?.protocol).toBe(1);
    expect(body?.lgpl.length).toBeGreaterThan(0);
  }, 30_000);

  test("serves the update check's last answer, which is not a live call", async () => {
    const body = await poll<{ enabled: boolean; current: string }>("/update");
    expect(typeof body?.enabled).toBe("boolean");
    expect(body?.current).toMatch(/^\d+\.\d+\.\d+/);
  }, 30_000);

  test("lists the adapters the picker shows, with the fake bridge live", async () => {
    const deadline = Date.now() + 20_000;
    let body: {
      mode: string;
      adapters: { id: string; live: boolean }[];
    } | null = null;
    while (Date.now() < deadline) {
      body = await poll("/adapters");
      if (body?.adapters.some((a) => a.live)) break;
      await Bun.sleep(100);
    }
    expect(body?.mode).toBe("auto");
    const ids = body?.adapters.map((a) => a.id) ?? [];
    expect(ids).toContain("mgba");
    expect(ids).toContain("retroarch");
    expect(body?.adapters.find((a) => a.id === "mgba")?.live).toBe(true);
  }, 30_000);

  test("refuses a write that names another host, and says why", async () => {
    await poll("/settings");
    const response = await fetch(`${base}/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Host: "evil.example",
      },
      body: JSON.stringify({ pollHz: 30 }),
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("write_forbidden");
    expect(body.error.message).toContain("Host");
    const after = await poll<{ settings: { pollHz: { value: number } } }>(
      "/settings",
    );
    expect(after?.settings.pollHz.value).toBe(20);
  }, 30_000);

  test("accepts a write from this machine and keeps it", async () => {
    await poll("/settings");
    const put = await fetch(`${base}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollHz: 30 }),
    });
    expect(put.status).toBe(200);
    const saved = (await put.json()) as {
      settings: { pollHz: { value: number } };
    };
    expect(saved.settings.pollHz.value).toBe(30);
    const after = await poll<{ settings: { pollHz: { value: number } } }>(
      "/settings",
    );
    expect(after?.settings.pollHz.value).toBe(30);
    const file = JSON.parse(
      await readFile(join(dataDir, "config.json"), "utf8"),
    ) as { pollHz?: number };
    expect(file.pollHz).toBe(30);
  }, 30_000);

  test("answers a probe with the adapter list", async () => {
    const response = await fetch(`${base}/adapters/probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { adapters: { id: string }[] };
    expect(body.adapters.map((a) => a.id)).toContain("mgba");
  }, 30_000);

  test("serves a viewer that carries the Settings and About screens", async () => {
    const html = await (await fetch(`${base}/`)).text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map(
      (m) => m[1] as string,
    );
    expect(assets.length).toBeGreaterThan(0);
    const code = (
      await Promise.all(
        assets.map(async (path) => (await fetch(`${base}${path}`)).text()),
      )
    ).join("\n");
    expect(code).toContain("Program address");
    expect(code).toContain("Emulator connection");
    expect(code).toContain("Save changes");
    expect(code).toContain("Open-source libraries");
    expect(code).toContain("third-party notices");
    expect(code).toContain("Reading the last update check.");
    expect(code).toContain("Reading the candidate profiles.");
    expect(code).not.toContain("can't list candidate profiles yet");
    expect(code).not.toContain("This screen isn't built yet.Settings");
  });
});

suite("the manual pick list on the compiled executable", () => {
  const bridge = new FakeBridge();
  let child: Bun.Subprocess | null = null;
  let dataDir = "";
  let base = "";

  beforeAll(async () => {
    const memory = emeraldMemory([TREECKO]);
    bridge.game = { ...GBA_GAME, crc32: "deadbeef" };
    bridge.onRead = (read, socket) =>
      bridge.reply(socket, read.id, serve(memory, read.ranges));
    bridge.start();
    dataDir = await mkdtemp(join(tmpdir(), "pmr-picks-e2e-"));
    await writeFile(
      join(dataDir, "config.json"),
      JSON.stringify({
        version: 1,
        adapters: { mgba: { host: "127.0.0.1", port: bridge.port } },
      }),
    );
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    child = Bun.spawn(
      [
        resolve(executable as string),
        "--no-browser",
        "--port",
        String(port),
        "--data-dir",
        dataDir,
      ],
      { stdout: "ignore", stderr: "ignore" },
    );
  });

  afterAll(async () => {
    child?.kill("SIGKILL");
    bridge.stop();
    await rm(dataDir, { recursive: true, force: true });
  });

  test("lists the profiles that fit an unidentified ROM", async () => {
    const deadline = Date.now() + 20_000;
    let body = null as ManualPicksBody | null;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${base}/manual-picks`);
        if (response.ok) {
          body = (await response.json()) as ManualPicksBody;
          if (body?.candidates.length) break;
        }
      } catch {}
      await Bun.sleep(100);
    }
    expect(body?.romKey).toBe("crc32:deadbeef");
    expect(body?.current).toBeNull();
    expect(body?.candidates.map((c) => c.id)).toContain("emerald-us-1.0");
  }, 30_000);
});
