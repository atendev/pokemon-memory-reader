import type {
  Pokemon,
  StatusResource,
} from "@pokemon-memory-reader/api/schemas";

export const PARTY_SLOTS = 6;

/** A null name shows `#<id>` (spec §11.1). */
export function refName(ref: { id: number; name: string | null }): string {
  return ref.name ?? `#${ref.id}`;
}

export function speciesName(mon: Pokemon): string {
  return refName(mon.species);
}

/** The card title: the nickname, else the species name, else `#<id>`. An egg has no species to show. */
export function cardTitle(mon: Pokemon): string {
  if (mon.isEgg) return "Egg";
  return mon.nickname ?? speciesName(mon);
}

/** The party in slot order, padded to six with nulls so empty slots keep their place. */
export function partySlots(pokemon: readonly Pokemon[]): (Pokemon | null)[] {
  return Array.from({ length: PARTY_SLOTS }, (_, i) => pokemon[i] ?? null);
}

export type HpTone = "high" | "mid" | "low" | "none";

/** The share of HP left as 0-100, or null when HP isn't known. */
export function hpPercent(mon: Pokemon): number | null {
  if (mon.hp === null || mon.maxHp === null || mon.maxHp <= 0) return null;
  return Math.max(0, Math.min(100, (mon.hp / mon.maxHp) * 100));
}

/** Green above half, amber above a fifth, red below that, grey when fainted or unknown (spec §11.8). */
export function hpTone(mon: Pokemon): HpTone {
  const percent = hpPercent(mon);
  if (percent === null || (mon.hp ?? 0) <= 0) return "none";
  if (percent > 50) return "high";
  if (percent > 20) return "mid";
  return "low";
}

/** A null field shows `—` (spec §11.1). */
export function orDash(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "—" : String(value);
}

const STATE_LABELS: Record<StatusResource["state"], string> = {
  disconnected: "Waiting for an emulator",
  no_game: "Emulator connected, no game loaded",
  unidentified: "Game not recognised",
  game: "Connected",
};

export function connectionLabel(status: StatusResource | null): string {
  return status === null
    ? "Cannot reach the program"
    : STATE_LABELS[status.state];
}
