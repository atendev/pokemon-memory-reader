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
