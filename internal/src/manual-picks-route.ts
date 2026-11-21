import { z } from "zod";

export const PICK_SCOPES = ["rom", "base"] as const;
export const pickScope = z.enum(PICK_SCOPES);
export type PickScope = z.infer<typeof pickScope>;

/** `POST /manual-picks` (amendment 021, item 8). The client never sends a key: the server derives it from the ROM loaded now. */
export const pickRequest = z.object({
  profileId: z.string().min(1),
  scope: pickScope,
});
export type PickRequest = z.infer<typeof pickRequest>;

/**
 * What `POST /manual-picks` answers. `key` is null exactly when `reason` is `no_key`. A pick with no
 * ROM key, or one whose file write failed, still loads, and the viewer says it won't be remembered.
 */
export const pickBody = z.object({
  key: z.string().nullable(),
  scope: pickScope,
  profileId: z.string(),
  saved: z.boolean(),
  reason: z.enum(["no_key", "write_failed"]).nullable(),
});
export type PickBody = z.infer<typeof pickBody>;

/** One profile the viewer may offer for the ROM loaded now (amendment 021, item 8). */
export const pickCandidate = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["official", "hack"]),
  dataFormat: z.string(),
  /** The ROM's header names this profile. */
  headerMatch: z.boolean(),
  /** The profile's signature checked against the ROM now. null when the profile declares none. */
  signature: z.enum(["match", "mismatch", "unchecked"]).nullable(),
  /** The profile may be picked with `scope: "base"` (amendment 014, item 3). */
  baseEligible: z.boolean(),
});
export type PickCandidate = z.infer<typeof pickCandidate>;

/**
 * What `GET /manual-picks` answers (amendment 021, item 8). `romKey` is the key a `rom` pick would
 * be saved under now. `current` is the saved entry that applied, so it is null when no pick applied
 * and also when the pick lasts for this session only and has no key. `candidates` is empty unless the
 * ROM is unidentified or loaded by a manual pick.
 */
export const manualPicksBody = z.object({
  romKey: z.string().nullable(),
  current: z
    .object({ key: z.string(), scope: pickScope, profileId: z.string() })
    .nullable(),
  candidates: z.array(pickCandidate),
});
export type ManualPicksBody = z.infer<typeof manualPicksBody>;
