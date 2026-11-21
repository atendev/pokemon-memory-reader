import type { Type } from "@pokemon-memory-reader/api/schemas";
import {
  createContext,
  type ReactNode,
  useContext,
  useSyncExternalStore,
} from "react";
import {
  type IconFailures,
  type IconSettings,
  itemIconUrl,
  menuIconUrl,
  NO_ICONS,
  spriteUrl,
  typeIconUrl,
} from "./icons";

interface IconContextValue {
  readonly settings: IconSettings;
  readonly failures: IconFailures;
}

const IconContext = createContext<IconContextValue | null>(null);

/** Gives the art below it the loaded game's icon settings. Without one, nothing requests an image. */
export function IconsProvider({
  settings,
  failures,
  children,
}: IconContextValue & { children: ReactNode }) {
  return (
    <IconContext.Provider value={{ settings, failures }}>
      {children}
    </IconContext.Provider>
  );
}

/** A URL to try, or null when the viewer should show the fallback. */
function useIconUrl(pick: (settings: IconSettings) => string | null): {
  url: string | null;
  fail: () => void;
} {
  const context = useContext(IconContext);
  const settings = context?.settings ?? NO_ICONS;
  const url = pick(settings);
  const failures = context?.failures;
  const failed = useSyncExternalStore(
    failures?.subscribe ?? NOOP_SUBSCRIBE,
    () => (url !== null && failures?.has(url)) ?? false,
    () => (url !== null && failures?.has(url)) ?? false,
  );
  return {
    url: failed ? null : url,
    fail: () => {
      if (url !== null) failures?.fail(url);
    },
  };
}

const NOOP_SUBSCRIBE = () => () => {};

/** A sprite box is a fixed size, so the page doesn't move when the image arrives or is missing. */
export const SPRITE_SIZE = 64;
export const MENU_ICON_SIZE = 40;

interface SpeciesArtProps {
  id: number;
  /** null shows `#<id>` in the fallback tile. */
  name: string | null;
  /** The primary type tints the fallback tile. */
  type?: Type | null;
  shiny?: boolean;
  /** Eggs have no species art, so they show the tile and make no request. */
  egg?: boolean;
  /** `sprite` is the card front sprite, `menu` the Gen 3 menu icon. */
  variant: "sprite" | "menu";
}

/** A Pokémon's art at a fixed size, or a tinted tile with the name's first letter (spec §11.9). */
export function SpeciesArt({
  id,
  name,
  type = null,
  shiny = false,
  egg = false,
  variant,
}: SpeciesArtProps) {
  const size = variant === "sprite" ? SPRITE_SIZE : MENU_ICON_SIZE;
  const { url, fail } = useIconUrl((settings) =>
    egg
      ? null
      : variant === "sprite"
        ? spriteUrl(settings, id, shiny)
        : menuIconUrl(settings, id),
  );
  const className = `art art-${variant}`;
  if (url !== null) {
    return (
      <span className={className} style={{ width: size, height: size }}>
        <img
          src={url}
          width={size}
          height={size}
          alt=""
          decoding="async"
          onError={fail}
        />
      </span>
    );
  }
  const label = egg ? "E" : name === null ? `#${id}` : name.slice(0, 1);
  return (
    <span
      className={`${className} art-tile${type === null ? "" : ` type-${type}`}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

/** An item or ball: its icon beside the name, or the name alone when there is no icon. */
export function ItemArt({ id, name }: { id: number; name: string | null }) {
  const { url, fail } = useIconUrl((settings) => itemIconUrl(settings, id));
  const text = name ?? `#${id}`;
  if (url === null) return <>{text}</>;
  return (
    <span className="art-item">
      <img
        className="art-item-icon"
        src={url}
        width={24}
        height={24}
        alt=""
        decoding="async"
        onError={fail}
      />
      {text}
    </span>
  );
}

/** A type: its icon beside the name, or a dot in the type's colour. */
export function TypeArt({ type }: { type: Type }) {
  const { url, fail } = useIconUrl((settings) => typeIconUrl(settings, type));
  return (
    <span className="type">
      {url === null ? (
        <span className={`type-dot type-${type}`} aria-hidden="true" />
      ) : (
        <img
          className="art-type"
          src={url}
          width={32}
          height={14}
          alt=""
          decoding="async"
          onError={fail}
        />
      )}
      {type}
    </span>
  );
}
