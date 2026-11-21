import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  STARTUP_KEYS,
  type StartupKey,
} from "@pokemon-memory-reader/internal/config";
import type {
  SettingRouteKey,
  SettingsBody,
} from "@pokemon-memory-reader/internal/settings-route";
import { SETTING_ROUTE_KEYS } from "@pokemon-memory-reader/internal/settings-route";
import type { Config } from "./config";

/** Total bytes of every file under a folder. A missing folder is empty. */
export async function folderSize(path: string): Promise<number> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch {
    return 0;
  }
  let total = 0;
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) total += await folderSize(child);
    else if (entry.isFile())
      total += await stat(child).then(
        (info) => info.size,
        () => 0,
      );
  }
  return total;
}

/**
 * The `GET /settings` body (spec §9.5, amendment 021 items 12 and 13). `paths` is null unless the
 * peer is loopback, since they can expose the OS user name. The icon cache size is for everyone.
 */
export async function settingsBody(
  config: Config,
  who: { readonly loopback: boolean },
): Promise<SettingsBody> {
  const applied = config.applied();
  const saved = config.saved();
  const pending = new Set<StartupKey>(config.pending());
  const entry = <K extends SettingRouteKey>(key: K) => ({
    value: applied[key],
    source: config.sourceOf(key),
    restartRequired: (STARTUP_KEYS as readonly string[]).includes(key),
    ...(pending.has(key as StartupKey) ? { pending: saved[key] } : {}),
  });
  const entries = Object.fromEntries(
    SETTING_ROUTE_KEYS.map((key) => [key, entry(key)]),
  ) as SettingsBody["settings"];
  const { paths } = config;
  return {
    settings: entries,
    saves: { writable: config.writable, refusal: config.file.refusal },
    paths: who.loopback
      ? {
          dataFolder: paths.dataFolder,
          configFile: paths.configFile,
          profiles: paths.profilesFolder,
          bridges: join(paths.dataFolder, "bridges"),
          iconPack: paths.iconsFolder,
          iconCache: paths.iconCacheFolder,
        }
      : null,
    iconCache: { bytes: await folderSize(paths.iconCacheFolder) },
  };
}
