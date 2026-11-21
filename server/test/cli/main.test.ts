import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP_VERSION } from "../../src/version";

const MAIN = join(import.meta.dir, "../../src/main.ts");

async function run(args: readonly string[]) {
  const child = Bun.spawn(["bun", MAIN, ...args], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}

test("--version prints the version line and exits 0", async () => {
  const { stdout, code } = await run(["--version"]);
  expect(code).toBe(0);
  expect(stdout.trim()).toMatch(
    new RegExp(`^${APP_VERSION.replaceAll(".", "\\.")} \\(\\S+, \\S+\\)$`),
  );
});

test("a bad flag prints the usage and exits 2", async () => {
  const { stderr, code } = await run(["--port", "nope"]);
  expect(code).toBe(2);
  expect(stderr).toContain("--port needs");
  expect(stderr).toContain("Usage:");
});

test("a port already in use exits 1 with a clear message", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "pmr-main-"));
  const blocker = createServer();
  await new Promise<void>((resolve) =>
    blocker.listen(0, "127.0.0.1", () => resolve()),
  );
  const address = blocker.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    const { stderr, code } = await run([
      "--no-browser",
      "--port",
      String(port),
      "--data-dir",
      dataDir,
    ]);
    expect(code).toBe(1);
    expect(stderr).toContain(`Port ${port}`);
    expect(stderr).toContain("already in use");
  } finally {
    blocker.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("starting the server loads the built-in profiles and names them", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "pmr-main-"));
  const probe = createServer();
  await new Promise<void>((resolve) =>
    probe.listen(0, "127.0.0.1", () => resolve()),
  );
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => probe.close(resolve));
  const child = Bun.spawn(
    [
      "bun",
      MAIN,
      "--no-browser",
      "--port",
      String(port),
      "--data-dir",
      dataDir,
    ],
    { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
  );
  try {
    const reader = child.stdout.getReader();
    const decoder = new TextDecoder();
    let out = "";
    while (!out.includes("Viewer:")) {
      const { value, done } = await reader.read();
      if (done) break;
      out += decoder.decode(value);
    }
    expect(out).toContain("Profiles: emerald-us-1.0");
  } finally {
    child.kill("SIGKILL");
    await child.exited;
    await rm(dataDir, { recursive: true, force: true });
  }
});

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) =>
    probe.listen(0, "127.0.0.1", () => resolve()),
  );
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

/** Starts the program, waits for the "Viewer:" line and returns everything printed so far. */
async function startWith(args: readonly string[]) {
  const child = Bun.spawn(["bun", MAIN, "--no-browser", ...args], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const reader = child.stdout.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (!out.includes("Viewer:")) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return { child, out };
}

test("a missing config file is reported and nothing is written", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "pmr-main-"));
  const { child, out } = await startWith([
    "--port",
    String(await freePort()),
    "--data-dir",
    dataDir,
  ]);
  try {
    expect(out).toContain(`Data folder: ${dataDir}`);
    expect(out).toContain(
      `Config file: ${join(dataDir, "config.json")} (not created yet, using defaults)`,
    );
    expect(await Bun.file(join(dataDir, "config.json")).exists()).toBe(false);
  } finally {
    child.kill("SIGKILL");
    await child.exited;
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("the file's port is used, and a flag beats it", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "pmr-main-"));
  const filePort = await freePort();
  await writeFile(
    join(dataDir, "config.json"),
    JSON.stringify({ port: filePort, pollHz: 500 }),
  );
  const fromFile = await startWith(["--data-dir", dataDir]);
  try {
    expect(fromFile.out).toContain(`Viewer: http://127.0.0.1:${filePort}`);
    expect(fromFile.out).toContain(
      `Config file: ${join(dataDir, "config.json")}\n`,
    );
  } finally {
    fromFile.child.kill("SIGKILL");
    await fromFile.child.exited;
  }

  const flagPort = await freePort();
  const fromFlag = await startWith([
    "--data-dir",
    dataDir,
    "--port",
    String(flagPort),
  ]);
  try {
    expect(fromFlag.out).toContain(`Viewer: http://127.0.0.1:${flagPort}`);
  } finally {
    fromFlag.child.kill("SIGKILL");
    await fromFlag.child.exited;
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("a malformed config file warns on stderr and the program runs on the defaults", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "pmr-main-"));
  await writeFile(join(dataDir, "config.json"), "{ not json");
  const { child, out } = await startWith([
    "--data-dir",
    dataDir,
    "--port",
    String(await freePort()),
  ]);
  try {
    expect(out).toContain("Viewer:");
    const reader = child.stderr.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("[error] config file");
    expect(text).toContain(join(dataDir, "config.json"));
    expect(text).toContain("not valid JSON");
  } finally {
    child.kill("SIGKILL");
    await child.exited;
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("a live mGBA endpoint change regenerates the served and installed script and flags the loaded one", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "pmr-main-"));
  const port = await freePort();
  const first = await freePort();
  const second = await freePort();
  await writeFile(
    join(dataDir, "config.json"),
    JSON.stringify({
      version: 1,
      adapters: { mgba: { host: "127.0.0.1", port: first } },
    }),
  );
  const { child } = await startWith([
    "--port",
    String(port),
    "--data-dir",
    dataDir,
  ]);
  const base = `http://127.0.0.1:${port}`;
  const served = async () => (await fetch(`${base}/bridges/mgba.lua`)).text();
  const stale = async () =>
    (
      (await (await fetch(`${base}/adapters`)).json()) as {
        adapters: { id: string; scriptStale: boolean }[];
      }
    ).adapters.find((a) => a.id === "mgba")?.scriptStale;
  const put = (body: unknown) =>
    fetch(`${base}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    expect(await served()).toContain(`local PORT = ${first}`);
    expect(await stale()).toBe(false);

    // An endpoint that does not change leaves the script and the flag alone.
    expect((await put({ adapters: { mgba: { port: first } } })).status).toBe(
      200,
    );
    expect(await served()).toContain(`local PORT = ${first}`);
    expect(await stale()).toBe(false);

    expect((await put({ adapters: { mgba: { port: second } } })).status).toBe(
      200,
    );
    const deadline = Date.now() + 5000;
    while (!(await served()).includes(`local PORT = ${second}`)) {
      if (Date.now() > deadline) throw new Error("the script never changed");
      await Bun.sleep(50);
    }
    expect(await served()).not.toContain(`local PORT = ${first}`);
    expect(
      await Bun.file(join(dataDir, "bridges", "mgba.lua")).text(),
    ).toContain(`local PORT = ${second}`);
    expect(await stale()).toBe(true);
  } finally {
    child.kill("SIGKILL");
    await child.exited;
    await rm(dataDir, { recursive: true, force: true });
  }
}, 30_000);
