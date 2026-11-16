import type { Domain } from "@pokemon-memory-reader/internal/memory";
import { encodeMon, type MonSpec, partyBytes } from "../gen3/encode";

export const TREECKO: MonSpec = {
  personality: 0x00000108,
  tid: 12345,
  sid: 6789,
  nickname: "LEAFY",
  otName: "BRENDAN",
  species: 277,
  experience: 135,
  friendship: 70,
  moves: [33, 52, 0, 0],
  pp: [35, 25, 0, 0],
  metLocation: 9,
  metLevel: 5,
  metGame: 3,
  ball: 4,
  ivs: { hp: 31, atk: 30, def: 29, spe: 28, spa: 27, spd: 26 },
  level: 5,
  hp: 19,
  maxHp: 20,
};

const EWRAM_PARTY_COUNT = 0x244e9;
const EWRAM_PARTY = 0x244ec;

/** Synthetic Emerald US 1.0 memory: the cartridge header and the player's party. No ROM bytes beyond the header. */
export function emeraldMemory(
  mons: readonly MonSpec[],
): Record<Domain, Uint8Array> {
  const rom = new Uint8Array(0x400);
  rom.set(new TextEncoder().encode("POKEMON EMER"), 0xa0);
  rom.set(new TextEncoder().encode("BPEE"), 0xac);
  rom[0xbc] = 0;
  const ewram = new Uint8Array(0x40000);
  ewram[EWRAM_PARTY_COUNT] = mons.length;
  ewram.set(partyBytes(mons.map(encodeMon)), EWRAM_PARTY);
  return {
    rom,
    ewram,
    iwram: new Uint8Array(0x8000),
    wram: new Uint8Array(0),
    hram: new Uint8Array(0),
    sram: new Uint8Array(0),
  };
}

/** The bytes a read of these ranges returns, concatenated in request order. */
export function serve(
  memory: Record<Domain, Uint8Array>,
  ranges: readonly { domain: Domain; offset: number; length: number }[],
): Uint8Array {
  const parts = ranges.map((r) =>
    memory[r.domain].subarray(r.offset, r.offset + r.length),
  );
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
