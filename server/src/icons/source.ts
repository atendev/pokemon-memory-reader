import { createHash } from "node:crypto";

/** The PokeAPI/sprites commit the default source serves (spec §11.9). Run `check-icon-map` when it changes. */
export const ICON_SPRITES_SHA = "1b3b7c0a538dd2226ae08d0d2f8955125075bbd4";

const DEFAULT_BASE = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@${ICON_SPRITES_SHA}`;

export interface IconSource {
  /** The cache folder name: `pokeapi-<sha>` for the default, `mirror-<first 12 hex of sha256(baseUrl)>` for a mirror. */
  readonly id: string;
  /** The folder that contains `sprites/`, with no trailing slash. */
  readonly base: string;
}

/** The source the current `baseUrl` resolves to, whatever the mode (spec §11.9, "Mirror and cache"). */
export function resolveSource(baseUrl: string | null): IconSource {
  if (baseUrl === null)
    return { id: `pokeapi-${ICON_SPRITES_SHA}`, base: DEFAULT_BASE };
  const base = baseUrl.replace(/\/+$/, "");
  return {
    id: `mirror-${createHash("sha256").update(base).digest("hex").slice(0, 12)}`,
    base,
  };
}

export const upstreamUrl = (source: IconSource, path: string): string =>
  `${source.base}/sprites/${path}`;
