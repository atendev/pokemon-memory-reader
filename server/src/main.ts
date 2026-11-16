import { spawn } from "node:child_process";
import { join } from "node:path";
import viewer from "../../viewer/src/index.html";
import { createBridgeAdapter } from "./adapter/bridge/adapter";
import { generateBridges } from "./bridges";
import { versionLine } from "./build-info";
import { type Command, parseArgs, USAGE } from "./cli";
import { systemClock } from "./clock";
import {
  defaultDataFolder,
  ensureDataFolder,
  installBridges,
} from "./data-folder";
import { consoleLog } from "./log";
import { builtinProfiles } from "./profile/builtin";
import { loadProfiles } from "./profile/registry";
import { startServer } from "./server";

/** The mGBA bridge's default endpoint. The config ticket makes it a setting (spec §9.2). */
const MGBA_ENDPOINT = { host: "127.0.0.1", port: 7426 } as const;
/** Spec §9.7: a graceful shutdown that takes longer than this logs the hung step and exits 1. */
const SHUTDOWN_MS = 2000;

function isLoopback(host: string): boolean {
  return (
    host === "localhost" ||
    host === "::1" ||
    host === "[::1]" ||
    host.startsWith("127.")
  );
}

function openInBrowser(url: string): void {
  const [command, args]: [string, string[]] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  try {
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    // The URL is already printed, so a missing opener costs nothing.
  }
}

/** After a fatal startup error on Windows, a double-clicked console would close before the message can be read (spec §9.7). */
async function exitAfterFatal(code: number): Promise<never> {
  if (
    process.platform === "win32" &&
    process.stdin.isTTY &&
    process.stdout.isTTY
  ) {
    console.error("Press Enter to close");
    await new Promise<void>((resolve) =>
      process.stdin.once("data", () => resolve()),
    );
  }
  process.exit(code);
}

async function run(
  options: Extract<Command, { kind: "run" }>["options"],
): Promise<void> {
  const log = consoleLog(options.debug);
  const dataFolder =
    options.dataDir ??
    process.env.PMR_DATA_DIR ??
    defaultDataFolder({ platform: process.platform, env: process.env });

  console.log(`Pokemon Memory Reader ${versionLine()}`);
  try {
    await ensureDataFolder(dataFolder);
  } catch (error) {
    console.error(
      `Cannot write to the data folder ${dataFolder}: ${(error as Error).message}`,
    );
    return exitAfterFatal(1);
  }
  console.log(`Data folder: ${dataFolder}`);

  const { registry, problems } = loadProfiles({
    builtin: builtinProfiles,
    user: [],
  });
  for (const problem of problems)
    log.warn(`profile ${problem.path}: ${problem.message}`);

  const bridges = await generateBridges({ mgba: MGBA_ENDPOINT });
  await installBridges(dataFolder, bridges, log);

  const adapter = createBridgeAdapter("mgba", MGBA_ENDPOINT, {
    clock: systemClock,
    log,
  });
  adapter.setMode("live");

  let server: ReturnType<typeof startServer>;
  try {
    server = startServer({
      adapter,
      registry,
      host: options.host,
      port: options.port,
      bridges,
      viewer,
      log,
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "EADDRINUSE") {
      console.error(
        `Port ${options.port} on ${options.host} is already in use. Pass --port <n> to pick another. A second emulator needs its own port.`,
      );
    } else {
      console.error(`Cannot start the server: ${(error as Error).message}`);
    }
    await adapter.close();
    return exitAfterFatal(1);
  }

  const url = `http://${server.host.includes(":") ? `[${server.host}]` : server.host}:${server.port}`;
  if (!isLoopback(options.host)) {
    console.warn(
      "Warning: the API and viewer are reachable by anyone on this network. Settings stay writable only from this machine.",
    );
  }
  console.log(`Viewer: ${url}`);
  console.log(
    `mGBA bridge: ${join(dataFolder, "bridges", "mgba.lua")} or ${url}/bridges/mgba.lua`,
  );
  if (options.openBrowser) openInBrowser(url);

  let stopping = false;
  const shutdown = async () => {
    // A second signal inside the window exits at once (spec §9.7).
    if (stopping) process.exit(130);
    stopping = true;
    let step = "the server";
    const timer = setTimeout(() => {
      log.error(`shutdown hung while stopping ${step}`);
      process.exit(1);
    }, SHUTDOWN_MS);
    await server.stop();
    step = "the adapter";
    await adapter.close();
    clearTimeout(timer);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

const command = parseArgs(process.argv.slice(2));
switch (command.kind) {
  case "help":
    console.log(USAGE);
    process.exit(0);
    break;
  case "version":
    console.log(versionLine());
    process.exit(0);
    break;
  case "error":
    console.error(`${command.message}\n\n${USAGE}`);
    process.exit(2);
    break;
  case "run":
    await run(command.options);
    break;
}
