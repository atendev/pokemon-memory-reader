import { z } from "zod";

/**
 * Every error code an internal route (anything outside `/api/v2`) answers with. A closed
 * enum: only the viewer reads it, and the viewer shows `message` for a code it doesn't know
 * (amendment 021, item 4). A new code is added here and in `INTERNAL_ERROR_STATUS`.
 */
export const INTERNAL_ERROR_CODES = [
  "write_forbidden",
  "invalid_request",
  "invalid_setting",
  "saves_refused",
  "save_failed",
  "adapter_not_usable",
  "adapter_pinned",
  "adapter_connect_failed",
  "switch_in_progress",
  "no_rom",
  "pick_not_allowed",
  "forget_not_allowed",
  "base_pick_not_allowed",
  "unknown_profile",
  "expansion_rom",
  "not_connected",
  "bad_read",
  "read_busy",
] as const;
export type InternalErrorCode = (typeof INTERNAL_ERROR_CODES)[number];

export const INTERNAL_ERROR_STATUS: Readonly<
  Record<InternalErrorCode, 400 | 403 | 409 | 500>
> = {
  write_forbidden: 403,
  invalid_request: 400,
  invalid_setting: 400,
  saves_refused: 409,
  save_failed: 500,
  adapter_not_usable: 409,
  adapter_pinned: 409,
  adapter_connect_failed: 409,
  switch_in_progress: 409,
  no_rom: 409,
  pick_not_allowed: 409,
  forget_not_allowed: 409,
  base_pick_not_allowed: 409,
  unknown_profile: 409,
  expansion_rom: 409,
  not_connected: 409,
  bad_read: 400,
  read_busy: 409,
};

/** An internal route's error body: no public `status` (amendment 021, item 4). */
export const internalErrorBody = z.object({
  error: z.object({
    code: z.enum(INTERNAL_ERROR_CODES),
    message: z.string(),
  }),
});
export type InternalErrorBody = z.infer<typeof internalErrorBody>;
