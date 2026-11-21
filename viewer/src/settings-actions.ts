import type { AdaptersBody } from "@pokemon-memory-reader/internal/adapters-route";
import type { SettingsPatch } from "@pokemon-memory-reader/internal/config";
import type { SettingsBody } from "@pokemon-memory-reader/internal/settings-route";
import {
  type Fetch,
  forgetPick,
  pickProfile,
  probeAdapters,
  putSettings,
  refusalCopy,
  switchAdapter,
} from "./internal-api";
import {
  ADAPTER_LABELS,
  type AdapterKey,
  changesUpdateCheck,
  type Draft,
  draftFrom,
} from "./settings-form";

/** One message under the form: what a write did, or why the program refused it. */
export type Notice =
  | { readonly kind: "ok"; readonly message: string }
  | {
      readonly kind: "error";
      readonly title: string | null;
      readonly message: string;
    };

const refusal = (outcome: {
  code: string | null;
  message: string;
}): Notice => ({ kind: "error", ...refusalCopy(outcome) });

/** What a write did: the notice to show and what to refresh. `value` is the new body when the route answers with one. */
export interface WriteResult<T> {
  readonly notice: Notice;
  readonly value: T | null;
}

/**
 * The form starts from the first read and only changes again on a save or a discard, so a poll
 * never overwrites what is being typed.
 */
export const adoptDraft = (
  current: Draft | null,
  loaded: SettingsBody,
): Draft => current ?? draftFrom(loaded.settings);

export interface SaveResult extends WriteResult<SettingsBody> {
  /** True when the save changed `updateCheck`, so the banner re-reads `/update` (amendment 021, item 10). */
  readonly refreshUpdate: boolean;
}

export async function saveSettings(
  patch: SettingsPatch,
  fetchFn?: Fetch,
): Promise<SaveResult> {
  const outcome = await putSettings(patch, fetchFn);
  if (!outcome.ok)
    return { notice: refusal(outcome), value: null, refreshUpdate: false };
  return {
    notice: { kind: "ok", message: "Saved." },
    value: outcome.value,
    refreshUpdate: changesUpdateCheck(patch),
  };
}

export async function probeNow(
  fetchFn?: Fetch,
): Promise<WriteResult<AdaptersBody>> {
  const outcome = await probeAdapters(fetchFn);
  return outcome.ok
    ? {
        notice: { kind: "ok", message: "Checked again." },
        value: outcome.value,
      }
    : { notice: refusal(outcome), value: null };
}

export async function switchNow(
  id: AdapterKey,
  fetchFn?: Fetch,
): Promise<WriteResult<true>> {
  const outcome = await switchAdapter(id, fetchFn);
  return outcome.ok
    ? {
        notice: {
          kind: "ok",
          message: `Now reading from ${ADAPTER_LABELS[id]}, until the program restarts.`,
        },
        value: true,
      }
    : { notice: refusal(outcome), value: null };
}

export async function pickNow(
  profileId: string,
  scope: "rom" | "base",
  fetchFn?: Fetch,
): Promise<WriteResult<true>> {
  const outcome = await pickProfile({ profileId, scope }, fetchFn);
  if (!outcome.ok) return { notice: refusal(outcome), value: null };
  const message = outcome.value.saved
    ? "Profile picked and remembered for this ROM."
    : outcome.value.reason === "no_key"
      ? "Profile picked for this session. This ROM has nothing to remember it by, so it won't be remembered."
      : "Profile picked for this session. The pick couldn't be saved to disk, so it won't be remembered.";
  return { notice: { kind: "ok", message }, value: true };
}

export async function forgetNow(fetchFn?: Fetch): Promise<WriteResult<true>> {
  const outcome = await forgetPick(fetchFn);
  return outcome.ok
    ? {
        notice: {
          kind: "ok",
          message: "Pick forgotten. The ROM was identified again.",
        },
        value: true,
      }
    : { notice: refusal(outcome), value: null };
}
