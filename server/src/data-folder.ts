import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Log } from "./log";

/** Folders the program creates under the data folder at startup (spec §9.1). */
export const DATA_SUBFOLDERS = ["bridges", "profiles", "icons"] as const;

export interface DataFolderInput {
  readonly platform: NodeJS.Platform;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly home?: string;
}

/** The default data folder per OS (spec §9.1). `--data-dir` and `PMR_DATA_DIR` are applied before this. */
export function defaultDataFolder({
  platform,
  env,
  home = homedir(),
}: DataFolderInput): string {
  switch (platform) {
    case "win32":
      return join(
        env.APPDATA ?? join(home, "AppData", "Roaming"),
        "pokemon-memory-reader",
      );
    case "darwin":
      return join(
        home,
        "Library",
        "Application Support",
        "pokemon-memory-reader",
      );
    default:
      return join(
        env.XDG_DATA_HOME || join(home, ".local", "share"),
        "pokemon-memory-reader",
      );
  }
}

export interface PathsInput extends DataFolderInput {
  /** The `--data-dir` value, when given. */
  readonly dataDirFlag?: string | null;
}

/** Where the program reads and writes (spec §9.1). Passed to `/settings` so the viewer can show them. */
export interface DataPaths {
  readonly dataFolder: string;
  readonly configFile: string;
  readonly profilesFolder: string;
  readonly iconsFolder: string;
  readonly iconCacheFolder: string;
}

/**
 * Resolves every path. The data folder is `--data-dir`, then `PMR_DATA_DIR`, then the OS default.
 * `config.json` lives in the data folder, except on Linux without an override, where it follows
 * `XDG_CONFIG_HOME` (spec §9.1, §9.3).
 */
export function resolvePaths(input: PathsInput): DataPaths {
  const { platform, env, home = homedir() } = input;
  const override = input.dataDirFlag || env.PMR_DATA_DIR || null;
  const dataFolder = override ?? defaultDataFolder({ platform, env, home });
  const configFolder =
    override === null && platform !== "win32" && platform !== "darwin"
      ? join(
          env.XDG_CONFIG_HOME || join(home, ".config"),
          "pokemon-memory-reader",
        )
      : dataFolder;
  return {
    dataFolder,
    configFile: join(configFolder, "config.json"),
    profilesFolder: join(dataFolder, "profiles"),
    iconsFolder: join(dataFolder, "icons"),
    iconCacheFolder: join(dataFolder, "icon-cache"),
  };
}

/** Creates the data folder and its subfolders. Throws when the folder can't be written. */
export async function ensureDataFolder(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  for (const name of DATA_SUBFOLDERS)
    await mkdir(join(root, name), { recursive: true });
}

/**
 * Writes each bridge into `<data folder>/bridges/`, rewriting a file only when its content
 * differs (spec §4.11). A failed write is logged once and the program carries on.
 */
export async function installBridges(
  root: string,
  bridges: Readonly<Record<string, string>>,
  log: Log,
): Promise<void> {
  for (const [name, source] of Object.entries(bridges)) {
    const path = join(root, "bridges", `${name}.lua`);
    try {
      const current = await readFile(path, "utf8").catch(() => null);
      if (current === source) continue;
      const temp = `${path}.${process.pid}.tmp`;
      await writeFile(temp, source);
      await rename(temp, path);
    } catch (error) {
      log.error(`could not write the ${name} bridge to ${path}`, { error });
    }
  }
}
