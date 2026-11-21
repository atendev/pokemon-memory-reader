import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  CONFIG_VERSION,
  configSchema,
  MAX_POLL_HZ,
  MIN_POLL_HZ,
  type SettingsPatch,
} from "@pokemon-memory-reader/internal/config";
import type { InternalErrorCode } from "@pokemon-memory-reader/internal/errors";
import { z } from "zod";
import type { ChangeResult, Config } from "./config";

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const { shape } = configSchema;
const endpoint = shape.adapters.shape.mgba;

/**
 * A save patch (spec §9.5): any subset of the known keys, down through `adapters` and `icons`,
 * checked by the same field schemas as the file. Unknown keys and `configVersion` are refused, and
 * unlike a hand edit, an out-of-range `pollHz` is refused instead of clamped, so the viewer never
 * saves a value other than the one the user typed.
 */
export const settingsPatchSchema = z.strictObject({
  port: shape.port.optional(),
  host: shape.host.optional(),
  openBrowser: shape.openBrowser.optional(),
  adapter: shape.adapter.optional(),
  adapters: z
    .strictObject({
      mgba: endpoint.partial().optional(),
      retroarch: endpoint.partial().optional(),
      bizhawk: endpoint.partial().optional(),
    })
    .optional(),
  pollHz: z.number().int().min(MIN_POLL_HZ).max(MAX_POLL_HZ).optional(),
  updateCheck: shape.updateCheck.optional(),
  icons: z
    .strictObject({
      mode: shape.icons.shape.mode.optional(),
      baseUrl: shape.icons.shape.baseUrl.optional(),
    })
    .optional(),
});

export type SaveResult =
  | { readonly ok: true; readonly change: ChangeResult }
  | {
      readonly ok: false;
      readonly code: InternalErrorCode;
      readonly message: string;
    };

const REFUSAL_TEXT = {
  malformed: "is not valid JSON",
  unreadable: "could not be read",
  "newer-version": "has a newer configVersion than this build",
} as const;

export function checkPatch(
  body: unknown,
):
  | { readonly ok: true; readonly patch: SettingsPatch }
  | { readonly ok: false; readonly message: string } {
  const parsed = settingsPatchSchema.safeParse(body);
  if (parsed.success) return { ok: true, patch: parsed.data as SettingsPatch };
  const issue = parsed.error.issues[0];
  const where = issue?.path.join(".") || "the body";
  return { ok: false, message: `${where}: ${issue?.message ?? "invalid"}` };
}

const deepMerge = (base: Json, patch: Json): Json => {
  const merged: Json = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = merged[key];
    merged[key] =
      isObject(value) && isObject(current) ? deepMerge(current, value) : value;
  }
  return merged;
};

/**
 * Saves a checked patch (spec §9.5). It re-reads the file, applies the patch over what the file
 * holds so unknown keys and other instances' keys survive, writes a temp file with a name
 * unique to this process in the same folder, and renames it over the original. A file that
 * went bad since startup refuses the save too. The in-memory settings change only after the
 * file is written.
 */
export async function saveSettings(
  config: Config,
  patch: SettingsPatch,
): Promise<SaveResult> {
  const path = config.paths.configFile;
  if (!config.writable) {
    const reason = config.file.refusal
      ? REFUSAL_TEXT[config.file.refusal]
      : "can't be saved";
    return {
      ok: false,
      code: "saves_refused",
      message: `Saving is turned off because ${path} ${reason}. Fix or remove the file and restart.`,
    };
  }
  if (Object.keys(patch).length === 0)
    return { ok: true, change: config.change(patch) };

  let current: Json = { configVersion: CONFIG_VERSION };
  try {
    const text = await readFile(path, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    if (!isObject(parsed))
      return {
        ok: false,
        code: "saves_refused",
        message: `Saving is turned off because ${path} is no longer valid JSON. Fix or remove the file and restart.`,
      };
    const version = parsed.configVersion;
    if (typeof version === "number" && version > CONFIG_VERSION)
      return {
        ok: false,
        code: "saves_refused",
        message: `Saving is turned off because ${path} has a newer configVersion than this build. Fix or remove the file and restart.`,
      };
    current = parsed;
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT")
      return {
        ok: false,
        code: "save_failed",
        message: `Could not read ${path}: ${(error as Error).message}`,
      };
  }

  const next = deepMerge(current, patch as Json);
  const temp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`);
    await rename(temp, path);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {});
    return {
      ok: false,
      code: "save_failed",
      message: `Could not write ${path}: ${(error as Error).message}`,
    };
  }
  return { ok: true, change: config.change(patch) };
}
