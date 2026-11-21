import type {
  ActiveBattle,
  LastBattle,
  OpponentMon,
  Trainer,
} from "@pokemon-memory-reader/api/schemas";
import { useState } from "react";

export const SHOW_UNREVEALED_KEY = "pmr.showUnrevealed";
export const SHOW_UNREVEALED_PARAM = "showUnrevealed";

type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem">;

/** The saved setting. Off unless saved on, so a missing, unreadable or unknown value hides the mons. */
export function readShowUnrevealed(storage: Reader | null): boolean {
  try {
    return storage?.getItem(SHOW_UNREVEALED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeShowUnrevealed(storage: Writer | null, show: boolean) {
  try {
    storage?.setItem(SHOW_UNREVEALED_KEY, show ? "1" : "0");
  } catch {}
}

function queryOf(text: string): string {
  const at = text.indexOf("?");
  return at === -1 ? "" : text.slice(at + 1);
}

/**
 * `?showUnrevealed=1` or `=0` for one page load (spec §11.4), read from the page's query or the
 * hash route's. Any other value, or none, is no override.
 */
export function showUnrevealedOverride(
  search: string,
  hash: string,
): boolean | null {
  for (const query of [search.replace(/^\?/, ""), queryOf(hash)]) {
    const value = new URLSearchParams(query).get(SHOW_UNREVEALED_PARAM);
    if (value === "1") return true;
    if (value === "0") return false;
  }
  return null;
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Whether unrevealed opponent mons show. The override wins for this page load and is never saved,
 * so an OBS browser source can't change what the owner's browser remembers.
 */
export function useShowUnrevealed(): {
  readonly show: boolean;
  readonly overridden: boolean;
  readonly set: (show: boolean) => void;
} {
  const [override] = useState(() =>
    typeof window === "undefined"
      ? null
      : showUnrevealedOverride(window.location.search, window.location.hash),
  );
  const [saved, setSaved] = useState(() =>
    readShowUnrevealed(browserStorage()),
  );
  return {
    show: override ?? saved,
    overridden: override !== null,
    set: (show) => {
      writeShowUnrevealed(browserStorage(), show);
      setSaved(show);
    },
  };
}

/**
 * The opponent mons that belong to the trainer at `index`. `OpponentMon.trainer` indexes
 * `opponent.trainers`. A mon with no trainer index belongs to the only trainer there is, since the
 * Gen 3 decoder leaves the index null until its trainer tables land.
 */
export function partyOf(
  party: readonly OpponentMon[],
  trainers: readonly Trainer[],
  index: number,
): OpponentMon[] {
  return party.filter(
    (mon) =>
      mon.trainer === index || (mon.trainer === null && trainers.length === 1),
  );
}

/** Pokémon left: the mons with HP above 0, revealed or not (spec §11.4). Null HP counts as unknown, not fainted. */
export function pokemonLeft(mons: readonly OpponentMon[]): number {
  return mons.filter((mon) => mon.hp === null || mon.hp > 0).length;
}

/** A trainer's card title: the name, else the class name, else "Trainer" (spec §11.4). */
export function trainerTitle(trainer: Trainer): string {
  return trainer.name ?? trainer.className ?? "Trainer";
}

export type Condition = { readonly key: string; readonly label: string };

/** Spikes layers read as a count, so one layer and three layers differ. */
function sideConditions(
  side: ActiveBattle["field"]["sides"]["player"],
  prefix: string,
): Condition[] {
  const out: Condition[] = [];
  if (side.reflect) out.push({ key: `${prefix}-reflect`, label: "Reflect" });
  if (side.lightScreen) {
    out.push({ key: `${prefix}-light-screen`, label: "Light Screen" });
  }
  if (side.safeguard) {
    out.push({ key: `${prefix}-safeguard`, label: "Safeguard" });
  }
  if (side.mist) out.push({ key: `${prefix}-mist`, label: "Mist" });
  if (side.spikes) {
    out.push({ key: `${prefix}-spikes`, label: `Spikes ×${side.spikes}` });
  }
  return out;
}

const WEATHER: Record<string, string> = {
  rain: "Rain",
  sun: "Harsh sunlight",
  sandstorm: "Sandstorm",
  hail: "Hail",
};

const TERRAIN: Record<string, string> = {
  electric: "Electric Terrain",
  grassy: "Grassy Terrain",
  misty: "Misty Terrain",
  psychic: "Psychic Terrain",
};

/** The active effects, as badges. `none`, `null`, false and 0 are hidden (spec §11.4). */
export function fieldBadges(field: ActiveBattle["field"]): {
  readonly shared: Condition[];
  readonly player: Condition[];
  readonly opponent: Condition[];
} {
  const shared: Condition[] = [];
  const weather = field.weather ? WEATHER[field.weather] : undefined;
  if (weather) shared.push({ key: "weather", label: weather });
  const terrain = field.terrain ? TERRAIN[field.terrain] : undefined;
  if (terrain) shared.push({ key: "terrain", label: terrain });
  return {
    shared,
    player: sideConditions(field.sides.player, "player"),
    opponent: sideConditions(field.sides.opponent, "opponent"),
  };
}

const OUTCOMES: Record<LastBattle["outcome"], string> = {
  won: "Won",
  lost: "Lost",
  drew: "Drew",
  ran: "Ran away",
  caught: "Caught",
  forfeited: "Forfeited",
  unknown: "Outcome unknown",
};

/** The one-line "Last battle" summary. It names trainers but never the opponent's party. */
export function lastBattleSummary(last: LastBattle): string {
  const against =
    last.kind === "wild"
      ? "wild encounter"
      : last.trainers.length > 0
        ? last.trainers.map(trainerTitle).join(" and ")
        : "trainer battle";
  return `${OUTCOMES[last.outcome]} · ${against} · ${last.format}`;
}
