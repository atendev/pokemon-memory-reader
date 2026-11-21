import { z } from "zod";

/** One LGPL component the About page names (ticket 048). */
export const lgplComponent = z.object({
  displayName: z.string(),
  copyright: z.string(),
});

/** `GET /about` (amendment 021, item 9). `commit` is `dev` in a local build. */
export const aboutBody = z.object({
  version: z.string(),
  target: z.string(),
  commit: z.string(),
  /** The `--version` text (spec §9.3). */
  versionLine: z.string(),
  lgpl: z.array(lgplComponent).readonly(),
  /** False in a dev build without the generated notices file, so About says notices ship with release builds. */
  notices: z.boolean(),
});
export type AboutBody = z.infer<typeof aboutBody>;
