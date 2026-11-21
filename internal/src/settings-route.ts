import { z } from "zod";
import { configSchema } from "./config";

const sources = ["flag", "file", "default"] as const;

/** The setting keys `GET` and `PUT /settings` carry. `configVersion` is never patched (spec §9.5). */
export const SETTING_ROUTE_KEYS = [
  "port",
  "host",
  "openBrowser",
  "adapter",
  "adapters",
  "pollHz",
  "updateCheck",
  "icons",
] as const;
export type SettingRouteKey = (typeof SETTING_ROUTE_KEYS)[number];

const entry = <T extends z.ZodType>(value: T) =>
  z.object({
    value,
    source: z.enum(sources),
    restartRequired: z.boolean(),
    /** The file's value, when it differs from the running one and waits for a restart. */
    pending: value.optional(),
  });

const { shape } = configSchema;

export const settingsPaths = z.object({
  dataFolder: z.string(),
  configFile: z.string(),
  profiles: z.string(),
  bridges: z.string(),
  iconPack: z.string(),
  iconCache: z.string(),
});

/**
 * `GET /settings` and the answer to a saved `PUT` (spec §9.5, amendment 021, item 13).
 * `paths` is null for a peer that isn't loopback, since paths can expose the OS user name.
 */
export const settingsBody = z.object({
  settings: z.object({
    port: entry(shape.port),
    host: entry(shape.host),
    openBrowser: entry(shape.openBrowser),
    adapter: entry(shape.adapter),
    adapters: entry(shape.adapters),
    pollHz: entry(z.number()),
    updateCheck: entry(shape.updateCheck),
    icons: entry(shape.icons),
  }),
  /** Why saves are refused, or null when a save may write the file (spec §9.4). */
  saves: z.object({
    writable: z.boolean(),
    refusal: z.enum(["malformed", "unreadable", "newer-version"]).nullable(),
  }),
  paths: settingsPaths.nullable(),
  iconCache: z.object({ bytes: z.number().int().min(0) }),
});
export type SettingsBody = z.infer<typeof settingsBody>;
export type SettingsPaths = z.infer<typeof settingsPaths>;
