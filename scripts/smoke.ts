import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/** Bridges the executable ships today. Spec §13.3 also lists `bizhawk`, which joins when that bridge exists. */
const BRIDGES = ["mgba"];
const START_TIMEOUT_MS = 15_000;
const EXIT_TIMEOUT_MS = 5_000;

const [executableArg, expectedVersion] = process.argv.slice(2);
if (!executableArg || !expectedVersion) {
  console.error("Usage: bun scripts/smoke.ts <executable> <expected-version>");
  process.exit(2);
}
const executable = resolve(executableArg);

function fail(message: string): never {
  throw new Error(message);
}

function check(condition: boolean, message: string): void {
  if (!condition) fail(message);
}

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

function checkVersion(): void {
  const result = spawnSync(executable, ["--version"], { encoding: "utf8" });
  check(
    result.status === 0,
    `--version exited ${result.status}: ${result.stderr}`,
  );
  const line = result.stdout.trim();
  const semver = line.split(" ")[0];
  check(
    semver === expectedVersion,
    `--version printed "${line}", expected version ${expectedVersion}`,
  );
  console.log(`version ok: ${line}`);
}

async function waitForStatus(base: string): Promise<Response> {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      return await fetch(`${base}/api/v2/status`);
    } catch (error) {
      lastError = (error as Error).message;
      await Bun.sleep(100);
    }
  }
  return fail(`the executable did not serve /api/v2/status: ${lastError}`);
}

async function checkServing(base: string, dataDir: string): Promise<void> {
  const response = await waitForStatus(base);
  check(response.status === 200, `/api/v2/status returned ${response.status}`);
  const status = (await response.json()) as { state?: unknown };
  check(
    status.state === "disconnected",
    `status.state was ${JSON.stringify(status.state)}, expected "disconnected"`,
  );

  const viewer = await fetch(`${base}/`);
  check(viewer.status === 200, `GET / returned ${viewer.status}`);
  const html = await viewer.text();
  check(/<html/i.test(html), "GET / did not return the viewer HTML");

  for (const name of BRIDGES) {
    const bridge = await fetch(`${base}/bridges/${name}.lua`);
    check(
      bridge.status === 200,
      `GET /bridges/${name}.lua returned ${bridge.status}`,
    );
    check(
      existsSync(join(dataDir, "bridges", `${name}.lua`)),
      `${name}.lua is missing from the data folder`,
    );
  }
  console.log("serving ok: status, viewer, bridges");
}

async function stop(
  child: Bun.Subprocess,
  { graceful }: { graceful: boolean },
): Promise<void> {
  if (child.exitCode !== null) return;
  if (!graceful) {
    // Windows has no SIGTERM, and the spec doesn't check the exit code there.
    spawnSync("taskkill", ["/F", "/T", "/PID", String(child.pid)]);
    await child.exited;
    return;
  }
  child.kill("SIGTERM");
  const code = await Promise.race([
    child.exited,
    Bun.sleep(EXIT_TIMEOUT_MS).then(() => null),
  ]);
  if (code === null) {
    child.kill("SIGKILL");
    fail(`the executable did not exit within ${EXIT_TIMEOUT_MS} ms of SIGTERM`);
  }
  check(code === 0, `the executable exited ${code} after SIGTERM, expected 0`);
  console.log("shutdown ok: exit 0");
}

checkVersion();

const dataDir = await mkdtemp(join(tmpdir(), "pmr-smoke-"));
const port = await freePort();
const child = Bun.spawn(
  [executable, "--no-browser", "--port", String(port), "--data-dir", dataDir],
  { stdout: "inherit", stderr: "inherit" },
);

let failure: unknown = null;
try {
  await checkServing(`http://127.0.0.1:${port}`, dataDir);
} catch (error) {
  failure = error;
}
try {
  await stop(child, { graceful: process.platform !== "win32" });
} catch (error) {
  failure ??= error;
} finally {
  if (child.exitCode === null) child.kill("SIGKILL");
  await rm(dataDir, { recursive: true, force: true }).catch(() => {});
}
if (failure) {
  console.error(`smoke failed: ${(failure as Error).message}`);
  process.exit(1);
}
console.log("smoke passed");
