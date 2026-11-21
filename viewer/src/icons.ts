import type { Type } from "@pokemon-memory-reader/api/schemas";

/** The `icons.mode` setting (spec §11.9). */
export type IconMode = "online" | "local" | "off";

/** What an icon request needs: the loaded game's profile, its generation, and the icon mode. */
export interface IconSettings {
  /** The profile ID from `status`, or null while no game is identified. */
  readonly profileId: string | null;
  readonly generation: number | null;
  /** null until `GET /settings` has answered, so nothing is requested early. */
  readonly mode: IconMode | null;
}

export const NO_ICONS: IconSettings = {
  profileId: null,
  generation: null,
  mode: "off",
};

/** The viewer requests images only with a game identified and a mode that reads files (spec §11.9). */
export function iconsEnabled(settings: IconSettings): boolean {
  return (
    settings.profileId !== null &&
    (settings.mode === "online" || settings.mode === "local")
  );
}

/** The `/icons/...` URL for a card sprite. Gen 1 never asks for a shiny sprite (spec §11.9). */
export function spriteUrl(
  settings: IconSettings,
  speciesId: number,
  shiny: boolean,
): string | null {
  if (!iconsEnabled(settings)) return null;
  const wantShiny = shiny && settings.generation !== 1;
  return `/icons/${settings.profileId}/pokemon/${speciesId}${wantShiny ? "/shiny" : ""}`;
}

/** The Gen 3 menu icon for the Boxes grid and opponent tiles, with no shiny variant. */
export function menuIconUrl(
  settings: IconSettings,
  speciesId: number,
): string | null {
  return iconsEnabled(settings)
    ? `/icons/${settings.profileId}/icon/${speciesId}`
    : null;
}

export function itemIconUrl(
  settings: IconSettings,
  itemId: number,
): string | null {
  return iconsEnabled(settings)
    ? `/icons/${settings.profileId}/item/${itemId}`
    : null;
}

/** `typeName` is the API's type enum value, URL-encoded. The viewer never builds a pack path. */
export function typeIconUrl(settings: IconSettings, type: Type): string | null {
  return iconsEnabled(settings)
    ? `/icons/${settings.profileId}/type/${encodeURIComponent(type)}`
    : null;
}

/**
 * The icon mode from a `GET /settings` body, or null when the body has no valid mode. Only the one
 * field is read, so a newer program that adds settings keeps working.
 */
export function parseIconMode(body: unknown): IconMode | null {
  if (typeof body !== "object" || body === null) return null;
  const icons = (body as { settings?: { icons?: { value?: unknown } } })
    .settings?.icons?.value;
  if (typeof icons !== "object" || icons === null) return null;
  const mode = (icons as { mode?: unknown }).mode;
  return mode === "online" || mode === "local" || mode === "off" ? mode : null;
}

/**
 * The URLs that answered with a non-2xx or failed to decode. A failed URL shows its fallback "until
 * the key changes or the page reloads" (spec §11.9), so the set lives for the page and a new URL, such
 * as another profile's, is tried again.
 */
export class IconFailures {
  private readonly failed = new Set<string>();
  private readonly listeners = new Set<() => void>();

  has = (url: string): boolean => this.failed.has(url);

  fail(url: string): void {
    if (this.failed.has(url)) return;
    this.failed.add(url);
    for (const listener of this.listeners) listener();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}
