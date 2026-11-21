import { spawn } from "node:child_process";
import { join } from "node:path";
import viewer from "../../viewer/src/index.html";
import { LGPL_COMPONENTS } from "../../viewer/src/lgpl";
import { createBridgeAdapter } from "./adapter/bridge/adapter";
import { createRetroArchAdapter } from "./adapter/retroarch/adapter";
import { createSelector } from "./adapter/selector";
import { generateBridges } from "./bridges";
import { buildCommit, buildTarget, versionLine } from "./build-info";
import { type Command, parseArgs, USAGE } from "./cli";
import { systemClock } from "./clock";
import { logConfigIssues, readConfigFile, resolveConfig } from "./config";
import { ensureDataFolder, installBridges, resolvePaths } from "./data-folder";
import { createIconService } from "./icons/service";
import { openPickStore } from "./identify/pick-store";
import { consoleLog } from "./log";
import { loadNotices } from "./notices";
import { builtinProfiles } from "./profile/builtin";
import { loadStartupProfiles } from "./profile/startup";
import { startServer } from "./server";
import { createUpdateChecker, followUpdateSetting } from "./update/check";
import { APP_VERSION } from "./version";

/** Spec §9.8: the release list of this repo. The API hides drafts. */
const UPDATE_FEED_URL =
  "https://api.github.com/repos/atendev/pokemon-memory-reader/releases?per_page=100";

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
  const paths = resolvePaths({
    platform: process.platform,
    env: process.env,
    dataDirFlag: options.dataDir,
  });
  const dataFolder = paths.dataFolder;

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

  const file = await readConfigFile(paths.configFile);
  logConfigIssues(paths.configFile, file.issues, log);
  console.log(
    file.exists
      ? `Config file: ${paths.configFile}`
      : `Config file: ${paths.configFile} (not created yet, using defaults)`,
  );
  const config = resolveConfig(file, options, paths);
  const settings = config.applied();

  const profiles = loadStartupProfiles(
    { builtin: builtinProfiles, user: [] },
    log,
  );
  if (!profiles.ok) {
    console.error(profiles.message);
    return exitAfterFatal(1);
  }
  const registry = profiles.registry;
  console.log(
    `Profiles: ${registry
      .all()
      .map((profile) => profile.id)
      .join(", ")}`,
  );

  const mgbaEndpoint = settings.adapters.mgba;
  const bridges = await generateBridges({ mgba: mgbaEndpoint });
  await installBridges(dataFolder, bridges, log);

  const icons = createIconService({
    paths,
    registry,
    settings: () => config.applied().icons,
    log,
  });
  await icons.pruneCache();

  const adapterDeps = { clock: systemClock, log };
  const selector = createSelector({
    create: (id) =>
      id === "mgba"
        ? createBridgeAdapter("mgba", settings.adapters.mgba, adapterDeps)
        : id === "retroarch"
          ? createRetroArchAdapter(settings.adapters.retroarch, adapterDeps)
          : null,
    endpoint: (id) => config.applied().adapters[id],
    pin: settings.adapter,
    clock: systemClock,
    log,
  });

  // The tests and the smoke run set this so no request leaves the machine.
  const updateAllowed = process.env.PMR_UPDATE_CHECK !== "off";
  const update = createUpdateChecker({
    current: APP_VERSION,
    enabled: settings.updateCheck && updateAllowed,
    feedUrl: UPDATE_FEED_URL,
    fetch: (url, init) => fetch(url, init),
    clock: systemClock,
    log,
    onNewer: (latest) =>
      console.log(`Update available: ${latest.version} ${latest.url}`),
  });
  const picks = await openPickStore(join(dataFolder, "manual-picks.json"), log);

  let server: ReturnType<typeof startServer>;
  try {
    server = startServer({
      adapter: selector.adapter,
      selector,
      registry,
      host: settings.host,
      port: settings.port,
      pollHz: settings.pollHz,
      bridges,
      icons,
      picks,
      viewer,
      config,
      update,
      about: {
        version: APP_VERSION,
        target: buildTarget(),
        commit: buildCommit(),
        versionLine: versionLine(),
        lgpl: LGPL_COMPONENTS,
        notices: await loadNotices(),
      },
      debug: options.debug,
      log,
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "EADDRINUSE") {
      console.error(
        `Port ${settings.port} on ${settings.host} is already in use. Pass --port <n> to pick another. A second emulator needs its own port.`,
      );
    } else {
      console.error(`Cannot start the server: ${(error as Error).message}`);
    }
    update.close();
    await selector.close();
    return exitAfterFatal(1);
  }

  const url = `http://${server.host.includes(":") ? `[${server.host}]` : server.host}:${server.port}`;
  if (!isLoopback(settings.host)) {
    console.warn(
      "Warning: the API and viewer are reachable by anyone on this network. Settings stay writable only from this machine.",
    );
  }
  console.log(`Viewer: ${url}`);
  console.log(
    `mGBA bridge: ${join(dataFolder, "bridges", "mgba.lua")} or ${url}/bridges/mgba.lua`,
  );
  if (settings.openBrowser) openInBrowser(url);
  // The server is listening, so the check never delays startup.
  update.start();

  config.onLive((live, changed) => {
    if (changed.includes("pollHz")) server.setPollHz(live.pollHz);
    if (changed.includes("adapter")) selector.setPin(live.adapter);
  });

  followUpdateSetting(config, update, updateAllowed);

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
    try {
      update.close();
      await server.stop();
      step = "the adapters";
      await selector.close();
    } catch (error) {
      log.error(`shutdown failed while stopping ${step}`, { error });
      process.exit(1);
    }
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
