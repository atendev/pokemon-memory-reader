import type { SettingsPatch } from "@pokemon-memory-reader/internal/config";
import type { SettingsBody } from "@pokemon-memory-reader/internal/settings-route";

type Settings = SettingsBody["settings"];

export const ADAPTER_KEYS = ["mgba", "retroarch", "bizhawk"] as const;
export type AdapterKey = (typeof ADAPTER_KEYS)[number];
export type AdapterPin = "auto" | AdapterKey;

/** The program refuses `pollHz` outside this range, so the form checks it first (spec §9.5). */
export const POLL_HZ_RANGE = { min: 5, max: 60 } as const;

export const ADAPTER_LABELS: Readonly<Record<AdapterKey, string>> = {
  mgba: "mGBA",
  retroarch: "RetroArch",
  bizhawk: "BizHawk",
};

/** The form's text fields hold strings, so a half-typed number is never lost. */
export interface Draft {
  port: string;
  host: string;
  openBrowser: boolean;
  adapter: AdapterPin;
  endpoints: Record<AdapterKey, { host: string; port: string }>;
  pollHz: string;
  updateCheck: boolean;
}

/**
 * Every field the form edits, by the id its input and its error use. A field the form doesn't
 * edit, like `icons`, is not here and is never sent.
 */
export type FieldId =
  | "port"
  | "host"
  | "openBrowser"
  | "adapter"
  | "pollHz"
  | "updateCheck"
  | `${AdapterKey}.host`
  | `${AdapterKey}.port`;

/** A startup setting shows the value waiting for a restart, so saving it twice isn't a change. */
const shown = <T>(entry: { value: T; pending?: T | undefined }): T =>
  entry.pending ?? entry.value;

export function draftFrom(settings: Settings): Draft {
  const endpoints = shown(settings.adapters);
  return {
    port: String(shown(settings.port)),
    host: shown(settings.host),
    openBrowser: shown(settings.openBrowser),
    adapter: shown(settings.adapter),
    endpoints: {
      mgba: { host: endpoints.mgba.host, port: String(endpoints.mgba.port) },
      retroarch: {
        host: endpoints.retroarch.host,
        port: String(endpoints.retroarch.port),
      },
      bizhawk: {
        host: endpoints.bizhawk.host,
        port: String(endpoints.bizhawk.port),
      },
    },
    pollHz: String(shown(settings.pollHz)),
    updateCheck: shown(settings.updateCheck),
  };
}

/** A flag beats the file, so the program refuses to let the form change a field it sets (spec §9.4). */
export function isLocked(source: "flag" | "file" | "default"): boolean {
  return source === "flag";
}

/** Whether a field can be edited here. The adapter endpoints share one setting, `adapters`. */
export function fieldLocked(settings: Settings, field: FieldId): boolean {
  if (field.includes(".")) return isLocked(settings.adapters.source);
  return isLocked(settings[field as keyof Settings & FieldId].source);
}

const SOURCE_TEXT = {
  flag: "Set by a command-line flag",
  file: "From config.json",
  default: "Default",
} as const;

export const sourceLabel = (source: "flag" | "file" | "default"): string =>
  SOURCE_TEXT[source];

const INTEGER = /^\d+$/;

function portError(text: string): string | null {
  if (!INTEGER.test(text.trim()))
    return "Enter a whole number from 1 to 65535.";
  const port = Number(text);
  return port >= 1 && port <= 65535
    ? null
    : "Enter a whole number from 1 to 65535.";
}

const hostError = (text: string): string | null =>
  text.trim() === "" ? "Enter a host name or address." : null;

/** What is wrong with the draft, by field. A locked field is skipped, since nothing is sent for it. */
export function validate(
  settings: Settings,
  draft: Draft,
): Partial<Record<FieldId, string>> {
  const errors: Partial<Record<FieldId, string>> = {};
  const check = (field: FieldId, message: string | null) => {
    if (message !== null && !fieldLocked(settings, field))
      errors[field] = message;
  };
  check("port", portError(draft.port));
  check("host", hostError(draft.host));
  const hz = draft.pollHz.trim();
  check(
    "pollHz",
    INTEGER.test(hz) &&
      Number(hz) >= POLL_HZ_RANGE.min &&
      Number(hz) <= POLL_HZ_RANGE.max
      ? null
      : `Enter a whole number from ${POLL_HZ_RANGE.min} to ${POLL_HZ_RANGE.max}.`,
  );
  for (const key of ADAPTER_KEYS) {
    check(`${key}.host`, hostError(draft.endpoints[key].host));
    check(`${key}.port`, portError(draft.endpoints[key].port));
  }
  return errors;
}

/**
 * The patch that turns the saved settings into the draft: only the fields that differ and aren't
 * locked, with `adapters` carrying only the endpoint parts that changed. Empty when nothing changed.
 * It doesn't check the values, so call `validate` first.
 */
export function patchFrom(settings: Settings, draft: Draft): SettingsPatch {
  const saved = draftFrom(settings);
  const patch: SettingsPatch = {};
  const open = (field: FieldId) => !fieldLocked(settings, field);
  if (open("port") && draft.port.trim() !== saved.port)
    patch.port = Number(draft.port);
  if (open("host") && draft.host.trim() !== saved.host)
    patch.host = draft.host.trim();
  if (open("openBrowser") && draft.openBrowser !== saved.openBrowser)
    patch.openBrowser = draft.openBrowser;
  if (open("adapter") && draft.adapter !== saved.adapter)
    patch.adapter = draft.adapter;
  if (open("pollHz") && draft.pollHz.trim() !== saved.pollHz)
    patch.pollHz = Number(draft.pollHz);
  if (open("updateCheck") && draft.updateCheck !== saved.updateCheck)
    patch.updateCheck = draft.updateCheck;
  const adapters: NonNullable<SettingsPatch["adapters"]> = {};
  for (const key of ADAPTER_KEYS) {
    const part: { host?: string; port?: number } = {};
    if (
      open(`${key}.host`) &&
      draft.endpoints[key].host.trim() !== saved.endpoints[key].host
    )
      part.host = draft.endpoints[key].host.trim();
    if (
      open(`${key}.port`) &&
      draft.endpoints[key].port.trim() !== saved.endpoints[key].port
    )
      part.port = Number(draft.endpoints[key].port);
    if (Object.keys(part).length > 0) adapters[key] = part;
  }
  if (Object.keys(adapters).length > 0) patch.adapters = adapters;
  return patch;
}

/** Loopback hosts keep the API on this computer. Anything else, `0.0.0.0` included, opens it to the network. */
export function isLanHost(host: string): boolean {
  const value = host.trim().toLowerCase();
  return !(
    value === "localhost" ||
    value === "::1" ||
    value === "[::1]" ||
    /^127(\.\d{1,3}){3}$/.test(value)
  );
}

/** The fields whose change warns that overlays using the default address need the new URL (spec §11.7). */
export const portChanged = (settings: Settings, draft: Draft): boolean =>
  !fieldLocked(settings, "port") &&
  draft.port.trim() !== draftFrom(settings).port;

/** Whether a patch touches `updateCheck`, so the banner re-reads `/update` (amendment 021, item 10). */
export const changesUpdateCheck = (patch: SettingsPatch): boolean =>
  patch.updateCheck !== undefined;

const REFUSAL_TEXT = {
  malformed: "is not valid JSON",
  unreadable: "could not be read",
  "newer-version": "has a newer configVersion than this build",
} as const;

/** The banner for refused saves, naming the file (spec §11.7), or null when saves are allowed. */
export function savesBanner(body: SettingsBody): string | null {
  if (body.saves.writable) return null;
  const file = body.paths?.configFile ?? "config.json";
  const why = body.saves.refusal ? REFUSAL_TEXT[body.saves.refusal] : null;
  return why === null
    ? `Saving is turned off for ${file}. Fix or remove the file and restart the program.`
    : `Saving is turned off because ${file} ${why}. Fix or remove the file and restart the program.`;
}
