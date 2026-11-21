import { createHash } from "node:crypto";

/** The PokeAPI/sprites commit the default source serves (spec §11.9). Run `check-icon-map` when it changes. */
export const ICON_SPRITES_SHA = "1b3b7c0a538dd2226ae08d0d2f8955125075bbd4";

const DEFAULT_BASE = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@${ICON_SPRITES_SHA}`;
/** The same commit on raw GitHub. jsDelivr answers 403 for a few files it can't serve, such as `icons/149.png`. */
const DEFAULT_FALLBACK_BASE = `https://raw.githubusercontent.com/PokeAPI/sprites/${ICON_SPRITES_SHA}`;

export interface IconSource {
  /** The cache folder name: `pokeapi-<sha>` for the default, `mirror-<first 12 hex of sha256(baseUrl)>` for a mirror. */
  readonly id: string;
  /** The folder that contains `sprites/`, with no trailing slash. */
  readonly base: string;
  /** Asked only after `base` answers 403. Null for a mirror, which has no second source. */
  readonly fallbackBase: string | null;
}

/** The source the current `baseUrl` resolves to, whatever the mode (spec §11.9, "Mirror and cache"). */
export function resolveSource(baseUrl: string | null): IconSource {
  if (baseUrl === null)
    return {
      id: `pokeapi-${ICON_SPRITES_SHA}`,
      base: DEFAULT_BASE,
      fallbackBase: DEFAULT_FALLBACK_BASE,
    };
  const base = baseUrl.replace(/\/+$/, "");
  return {
    id: `mirror-${createHash("sha256").update(base).digest("hex").slice(0, 12)}`,
    base,
    fallbackBase: null,
  };
}

export const upstreamUrl = (source: IconSource, path: string): string =>
  `${source.base}/sprites/${path}`;

/** The second source's URL for a path, or null when the source has none. */
export const fallbackUrl = (source: IconSource, path: string): string | null =>
  source.fallbackBase === null
    ? null
    : `${source.fallbackBase}/sprites/${path}`;
