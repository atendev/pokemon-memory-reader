import { readFile } from "node:fs/promises";
import {
  type ConfigIssue,
  LIVE_KEYS,
  type LiveKey,
  mergeSettings,
  missingConfig,
  type ParsedConfig,
  parseConfigText,
  refusedConfig,
  type SettingKey,
  type Settings,
  type SettingsPatch,
  STARTUP_KEYS,
  type StartupKey,
} from "@pokemon-memory-reader/internal/config";
import type { Options } from "./cli";
import type { DataPaths } from "./data-folder";
import type { Log } from "./log";

export interface ConfigFile extends ParsedConfig {
  /** False when there is no file yet, which is not an error and writes nothing (spec §9.4). */
  readonly exists: boolean;
}

/** Reads `config.json`. It never throws: every failure means defaults and, where the file is bad, refused saves. */
export async function readConfigFile(path: string): Promise<ConfigFile> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT")
      return { ...missingConfig(), exists: false };
    return {
      ...refusedConfig(
        "unreadable",
        `could not be read (${(error as Error).message}), running on the defaults and not saving`,
      ),
      exists: true,
    };
  }
  return { ...parseConfigText(text), exists: true };
}

export function logConfigIssues(
  path: string,
  issues: readonly ConfigIssue[],
  log: Log,
): void {
  for (const issue of issues)
    log[issue.level](`config file ${path} ${issue.message}`);
}

export type SettingSource = "flag" | "file" | "default";

export type LiveListener = (
  settings: Settings,
  changed: readonly LiveKey[],
) => void;

export interface ChangeResult {
  /** Live keys whose applied value changed. */
  readonly applied: readonly LiveKey[];
  /** Startup keys whose file value now differs from the running one, waiting for a restart. */
  readonly pending: readonly StartupKey[];
}

/**
 * The settings this run uses, and the file's values when they differ. A live key takes a new
 * value at once. A startup key keeps the value it started with until the next run (spec §9.4).
 */
export interface Config {
  readonly paths: DataPaths;
  readonly file: ConfigFile;
  /** True when a save may write the file. */
  readonly writable: boolean;
  /** What the program runs on now. */
  applied(): Settings;
  /** Where a top-level setting's applied value came from (spec §9.5). */
  sourceOf(key: SettingKey): SettingSource;
  /** Startup keys the file holds a different value for, waiting for a restart. */
  pending(): readonly StartupKey[];
  /** What a settings save does in memory. The route validates the patch and writes the file. */
  change(patch: SettingsPatch): ChangeResult;
  onLive(listener: LiveListener): () => void;
}

const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Flag > file > default (spec §9.3). Flag values apply to this run and are never saved. */
export function resolveConfig(
  file: ConfigFile,
  flags: Pick<Options, "port" | "host" | "openBrowser">,
  paths: DataPaths,
): Config {
  const overrides: Partial<Settings> = {
    ...(flags.port !== null && { port: flags.port }),
    ...(flags.host !== null && { host: flags.host }),
    ...(flags.openBrowser !== null && { openBrowser: flags.openBrowser }),
  };
  let fileSettings = file.settings;
  let applied: Settings = { ...fileSettings, ...overrides };
  const listeners = new Set<LiveListener>();

  const pending = () =>
    STARTUP_KEYS.filter((key) => !sameValue(fileSettings[key], applied[key]));

  return {
    paths,
    file,
    writable: file.refusal === null,
    applied: () => applied,
    sourceOf(key) {
      if (key in overrides) return "flag";
      return file.present.has(key) ? "file" : "default";
    },
    pending,
    change(patch) {
      fileSettings = mergeSettings(fileSettings, patch);
      const before = applied;
      applied = {
        ...applied,
        ...Object.fromEntries(LIVE_KEYS.map((key) => [key, fileSettings[key]])),
      };
      const changed = LIVE_KEYS.filter(
        (key) => !sameValue(before[key], applied[key]),
      );
      if (changed.length > 0)
        for (const listener of listeners) listener(applied, changed);
      return { applied: changed, pending: pending() };
    },
    onLive(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
