import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
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
