import type {
  Badge,
  MapLocation,
  PlayTime,
  Pocket,
} from "@pokemon-memory-reader/api/schemas";
import { refName } from "./display";

/** Money prints with the Poké Dollar sign and thousands separators, in one fixed locale so the page reads the same everywhere. */
export function formatMoney(money: number): string {
  return `₽${money.toLocaleString("en-US")}`;
}

/** Trainer and secret IDs print as the five digits the game shows, so 7 is `00007`. */
export function formatId(id: number): string {
  return String(id).padStart(5, "0");
}

/**
 * Play time as `hours:mm:ss`. Hours are unbounded because a hack can change the cap
 * (amendment 017 §2), and frames stay out because they only count to the next second.
 */
export function formatPlayTime(time: PlayTime): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${time.hours}:${two(time.minutes)}:${two(time.seconds)}`;
}

/** The area name: the map section or landmark, `#<id>` when the game has the section but no name for it, and null when the map has no section at all. */
export function areaName(location: MapLocation): string | null {
  return location.section === null ? null : refName(location.section);
}

/** The raw map, as `Map 0:9`. Gen 1 has one map ID and no group, so it prints `Map 9`. */
export function mapLabel(location: MapLocation): string {
  return location.mapGroup === null
    ? `Map ${location.mapNumber}`
    : `Map ${location.mapGroup}:${location.mapNumber}`;
}

/** A badge's name, or `Badge <n>` counted from 1 when a hack profile gives it none. */
export function badgeName(badge: Badge): string {
  return badge.name ?? `Badge ${badge.id + 1}`;
}

export const BADGES_PER_ROW = 8;

/** Badges split into rows of eight, so a Gen 2 player's sixteen make two rows. */
export function badgeRows(badges: readonly Badge[]): Badge[][] {
  const rows: Badge[][] = [];
  for (let at = 0; at < badges.length; at += BADGES_PER_ROW) {
    rows.push(badges.slice(at, at + BADGES_PER_ROW));
  }
  return rows;
}

/** Gen 2 orders its sixteen badges Johto first and then Kanto (amendment 017 §3). Other counts have one region, so no row label. */
export function badgeRowLabel(total: number, row: number): string | null {
  if (total !== BADGES_PER_ROW * 2) return null;
  return row === 0 ? "Johto" : "Kanto";
}

export function obtainedCount(badges: readonly Badge[]): number {
  return badges.filter((badge) => badge.obtained).length;
}

const POCKET_LABELS: Record<Pocket["id"], string> = {
  items: "Items",
  keyItems: "Key items",
  balls: "Balls",
  tmhm: "TMs & HMs",
  berries: "Berries",
};

/** A pocket's heading. The pocket set is a closed enum, but a newer program could add one, so an unknown ID prints as itself. */
export function pocketLabel(id: string): string {
  return (POCKET_LABELS as Record<string, string>)[id] ?? id;
}

export type PocketFill = "empty" | "full" | "open";

/** A pocket is full when every slot holds a stack, which is the case the screen flags. */
export function pocketFill(pocket: Pocket): PocketFill {
  if (pocket.items.length === 0) return "empty";
  return pocket.capacity > 0 && pocket.items.length >= pocket.capacity
    ? "full"
    : "open";
}
