import { DEFAULT_HOST, DEFAULT_PORT } from "@pokemon-memory-reader/api/client";
import { z } from "zod";

/** The `configVersion` this build writes and understands (spec §9.2). */
export const CONFIG_VERSION = 1;
export const MIN_POLL_HZ = 5;
export const MAX_POLL_HZ = 60;
export const DEFAULT_POLL_HZ = 20;

const port = z.number().int().min(1).max(65535);
const host = z.string().min(1);
const endpoint = z.object({ host, port });

/** The one definition of `config.json` (spec §9.2). An out-of-range `pollHz` integer clamps. */
export const configSchema = z.object({
  configVersion: z.number().int().min(1),
  port,
  host,
  openBrowser: z.boolean(),
  adapter: z.enum(["auto", "mgba", "retroarch", "bizhawk"]),
  adapters: z.object({
    mgba: endpoint,
    retroarch: endpoint,
    bizhawk: endpoint,
  }),
  pollHz: z
    .number()
    .int()
    .transform((hz) => Math.min(MAX_POLL_HZ, Math.max(MIN_POLL_HZ, hz))),
  updateCheck: z.boolean(),
  icons: z.object({
    mode: z.enum(["online", "local", "off"]),
    baseUrl: z.url({ protocol: /^https?$/ }).nullable(),
  }),
});

export type Settings = z.output<typeof configSchema>;
export type SettingKey = keyof Settings;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
export type SettingsPatch = DeepPartial<Settings>;

export const DEFAULT_SETTINGS: Settings = {
  configVersion: CONFIG_VERSION,
  port: DEFAULT_PORT,
  host: DEFAULT_HOST,
  openBrowser: true,
  adapter: "auto",
  adapters: {
    mgba: { host: DEFAULT_HOST, port: 7426 },
    retroarch: { host: DEFAULT_HOST, port: 55355 },
    bizhawk: { host: DEFAULT_HOST, port: 7427 },
  },
  pollHz: DEFAULT_POLL_HZ,
  updateCheck: true,
  icons: { mode: "online", baseUrl: null },
};

/** Read only at startup, and the viewer says "restart to apply" (spec §9.4). */
export const STARTUP_KEYS = [
  "port",
  "host",
  "openBrowser",
] as const satisfies readonly SettingKey[];
export type StartupKey = (typeof STARTUP_KEYS)[number];

/** Apply the moment they change (spec §9.4). */
export const LIVE_KEYS = [
  "adapter",
  "adapters",
  "pollHz",
  "updateCheck",
  "icons",
] as const satisfies readonly SettingKey[];
export type LiveKey = (typeof LIVE_KEYS)[number];

export interface ConfigIssue {
  readonly level: "warn" | "error";
  readonly message: string;
}

/** Why saves are refused (spec §9.4). `unreadable` is a file that exists but can't be read. */
export type SaveRefusal = "malformed" | "unreadable" | "newer-version";

export interface ParsedConfig {
  /** The file's valid values over the defaults. */
  readonly settings: Settings;
  /** Keys the schema doesn't know, in the file's own shape, so a save can keep them. */
  readonly unknown: Readonly<Record<string, unknown>>;
  /** The top-level keys the file set to a valid value, for each setting's `source`. */
  readonly present: ReadonlySet<SettingKey>;
  readonly refusal: SaveRefusal | null;
  readonly issues: readonly ConfigIssue[];
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const show = (value: unknown): string => JSON.stringify(value) ?? String(value);

interface Walk {
  readonly value: Json;
  readonly unknown: Json;
  readonly present: Set<string>;
}

/** Checks each key on its own, so one bad value costs only that key (spec §9.4). */
function walk(
  shape: Readonly<Record<string, z.ZodType>>,
  raw: Json,
  defaults: Json,
  path: string,
  issues: ConfigIssue[],
  unknownPaths: string[],
): Walk {
  const value: Json = {};
  const unknown: Json = {};
  const present = new Set<string>();
  const label = (key: string) => (path === "" ? key : `${path}.${key}`);
  for (const [key, field] of Object.entries(shape)) {
    const fallback = defaults[key];
    const given = raw[key];
    if (field instanceof z.ZodObject) {
      if (given !== undefined && !isObject(given)) {
        issues.push({
          level: "warn",
          message: `${label(key)} must be an object, using the defaults`,
        });
      }
      const inner = walk(
        field.shape as Record<string, z.ZodType>,
        isObject(given) ? given : {},
        fallback as Json,
        label(key),
        issues,
        unknownPaths,
      );
      value[key] = inner.value;
      if (Object.keys(inner.unknown).length > 0) unknown[key] = inner.unknown;
      if (inner.present.size > 0) present.add(key);
      continue;
    }
    if (given === undefined) {
      value[key] = fallback;
      continue;
    }
    const parsed = field.safeParse(given);
    if (!parsed.success) {
      const reason = parsed.error.issues[0]?.message ?? "invalid";
      issues.push({
        level: "warn",
        message: `${label(key)} is invalid (${reason}), got ${show(given)}, using ${show(fallback)}`,
      });
      value[key] = fallback;
      continue;
    }
    value[key] = parsed.data;
    present.add(key);
    if (parsed.data !== given) {
      issues.push({
        level: "warn",
        message: `${label(key)} ${show(given)} is out of range, using ${show(parsed.data)}`,
      });
    }
  }
  for (const key of Object.keys(raw)) {
    if (key in shape) continue;
    unknown[key] = raw[key];
    unknownPaths.push(label(key));
  }
  return { value, unknown, present };
}

/** The result for a file that can't be used: defaults, and saves refused. */
export function refusedConfig(
  refusal: SaveRefusal,
  message: string,
): ParsedConfig {
  return {
    settings: DEFAULT_SETTINGS,
    unknown: {},
    present: new Set(),
    refusal,
    issues: [{ level: "error", message }],
  };
}

/** The result for a file that doesn't exist: defaults, and nothing is written (spec §9.4). */
export function missingConfig(): ParsedConfig {
  return {
    settings: DEFAULT_SETTINGS,
    unknown: {},
    present: new Set(),
    refusal: null,
    issues: [],
  };
}

/**
 * Reads the text of a `config.json` (spec §9.4). It never throws: bad JSON means defaults and
 * refused saves, a bad key means its default, unknown keys are reported once and kept, and a
 * newer `configVersion` runs on the keys this build understands.
 */
export function parseConfigText(text: string): ParsedConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return refusedConfig(
      "malformed",
      `is not valid JSON (${(error as Error).message}), running on the defaults and not saving`,
    );
  }
  if (!isObject(raw)) {
    return refusedConfig(
      "malformed",
      "must hold a JSON object, running on the defaults and not saving",
    );
  }
  const issues: ConfigIssue[] = [];
  const unknownKeys: string[] = [];
  const result = walk(
    configSchema.shape as Record<string, z.ZodType>,
    raw,
    DEFAULT_SETTINGS as unknown as Json,
    "",
    issues,
    unknownKeys,
  );
  const settings = result.value as unknown as Settings;
  const newer = result.present.has("configVersion")
    ? settings.configVersion > CONFIG_VERSION
    : false;
  if (newer) {
    issues.push({
      level: "warn",
      message: `configVersion ${settings.configVersion} is newer than this build's ${CONFIG_VERSION}, using the keys it understands and not saving`,
    });
  } else if (unknownKeys.length > 0) {
    issues.push({
      level: "warn",
      message: `unknown keys ${unknownKeys.join(", ")} are ignored and kept on save`,
    });
  }
  return {
    settings,
    unknown: result.unknown,
    present: result.present as ReadonlySet<SettingKey>,
    refusal: newer ? "newer-version" : null,
    issues,
  };
}

/** Applies a patch over the settings, one key at a time down through `adapters` and `icons`. */
export function mergeSettings(base: Settings, patch: SettingsPatch): Settings {
  return mergeDeep(
    base as unknown as Json,
    patch as Json,
  ) as unknown as Settings;
}

function mergeDeep(base: Json, patch: Json): Json {
  const merged: Json = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = merged[key];
    merged[key] =
      isObject(value) && isObject(current) ? mergeDeep(current, value) : value;
  }
  return merged;
}
