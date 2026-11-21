import { z } from "zod";

/**
 * `GET /update` (amendment 021, item 10). The last check's result, never a live call to GitHub.
 * `latest` is set only when a newer release exists, and `url` is its release page. With
 * `updateCheck` off, `enabled` is false and `latest` is null.
 */
export const updateBody = z.object({
  enabled: z.boolean(),
  current: z.string(),
  latest: z.object({ version: z.string(), url: z.string() }).nullable(),
  /** When the last check that got a usable list finished, or null before the first one. */
  checkedAt: z.string().nullable(),
});
export type UpdateBody = z.infer<typeof updateBody>;
