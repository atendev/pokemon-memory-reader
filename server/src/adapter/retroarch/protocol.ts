import type { Domain, Platform } from "@pokemon-memory-reader/internal/memory";
import type { Range } from "../types";

/** RetroArch's UDP reply limit for one READ_CORE_MEMORY (amendment 026, point 5). */
export const MAX_CHUNK = 16384;

export type StatusReply =
  | { readonly kind: "contentless" }
  | {
      readonly kind: "content";
      readonly paused: boolean;
      /** The system id up to the first comma. `UNKNOWN` (master's stand-in for a missing one) is null. */
      readonly systemId: string | null;
      /** The file name without its extension. `UNKNOWN` is null. */
      readonly contentName: string | null;
      /** 8 lowercase hex digits. `crc32=0` (RetroArch skipped the hash) is null (amendment 014). */
      readonly crc32: string | null;
    }
  /** Master's `GET_STATUS ERROR`: the runloop state was null. It changes nothing (amendment 014, item 6). */
  | { readonly kind: "error" };

/**
 * Reads a `GET_STATUS` reply (amendments 026 point 1 and 014 item 6): the status word, then the
 * system id up to the first comma, then the content name, with a trailing `,crc32=<hex>`
 * removed. Names may hold commas, so the name runs to the end of the line. null is not a valid
 * reply, including a `GET_STATUS ` line that doesn't parse.
 */
export function parseStatus(text: string): StatusReply | null {
  const line = text.replace(/[\r\n]+$/, "");
  if (line === "GET_STATUS CONTENTLESS") return { kind: "contentless" };
  if (line === "GET_STATUS ERROR") return { kind: "error" };
  const match = /^GET_STATUS (PLAYING|PAUSED) ([^,]*),(.*)$/s.exec(line);
  if (!match) return null;
  const [, word, system = "", rest = ""] = match;
  let name = rest;
  let crc32: string | null = null;
  const tail = /,crc32=([0-9a-fA-F]{1,8})$/.exec(rest);
  if (tail) {
    name = rest.slice(0, tail.index);
    const value = Number.parseInt(tail[1] ?? "0", 16);
    crc32 = value === 0 ? null : value.toString(16).padStart(8, "0");
  }
  return {
    kind: "content",
    paused: word === "PAUSED",
    systemId: system === "" || system === "UNKNOWN" ? null : system,
    contentName: name === "" || name === "UNKNOWN" ? null : name,
    crc32,
  };
}

/**
 * The platform a system id stands for, or "other" when the program doesn't read it. The ids are
 * RetroArch's `systemid` from the core's info file, and the adapter spike confirms them (spec §15).
 */
export function platformOf(systemId: string | null): Platform | "other" {
  switch (systemId?.toLowerCase()) {
    case "gba":
    case "game_boy_advance":
      return "gba";
    case "gb":
    case "gbc":
    case "game_boy":
    case "game_boy_color":
    case "gameboy":
      return "gb";
    default:
      return "other";
  }
}

/** Memory the program can reach per platform, as `GameInfo.domains` reports it. */
export const DOMAIN_SIZES: Record<
  Platform,
  Readonly<Partial<Record<Domain, number>>>
> = {
  // ROM is the 32 MiB cartridge window. A core that maps none, such as gpSP, answers with an
  // error, and the header read fails (amendment 026, point 3).
  gba: { rom: 0x2000000, ewram: 0x40000, iwram: 0x8000 },
  gb: { rom: 0x8000, wram: 0x2000, hram: 0x7f, sram: 0x2000 },
};

/** System bus address of each domain's offset 0 (spec §3.4). */
const BASES: Record<Platform, Readonly<Partial<Record<Domain, number>>>> = {
  gba: { rom: 0x08000000, ewram: 0x02000000, iwram: 0x03000000 },
  gb: { rom: 0x0000, wram: 0xc000, hram: 0xff80, sram: 0xa000 },
};

/**
 * Offsets where the core's memory descriptors change inside one domain. A datagram never spans
 * one (amendment 026, point 5). Gambatte maps GB WRAM as two descriptors, at 0xC000 and 0xD000.
 * The adapter spike records the rest of each core's descriptors (spec §15).
 */
const DESCRIPTOR_CUTS: Record<
  Platform,
  Readonly<Partial<Record<Domain, readonly number[]>>>
> = {
  gba: {},
  gb: { wram: [0x1000] },
};

/** One `READ_CORE_MEMORY` datagram. */
export interface Chunk {
  readonly address: number;
  readonly length: number;
}

/** Where a piece of one caller range comes from. */
export interface Piece {
  readonly chunk: number;
  /** Offset inside the caller's range. */
  readonly at: number;
}

export interface Plan {
  /** One per distinct (address, length), in first-use order. */
  readonly chunks: readonly Chunk[];
  /** Per caller range, its pieces in order. null when the range can't map to a bus address. */
  readonly pieces: ReadonlyArray<
    readonly (Piece & { readonly length: number })[] | null
  >;
}

/**
 * Cuts every range at known descriptor boundaries, then into chunks of at most 16384 bytes
 * (amendment 026, point 5). `valid` says which ranges passed the caller's bounds check.
 */
export function planChunks(
  platform: Platform,
  ranges: readonly Range[],
  valid: readonly boolean[],
): Plan {
  const chunks: Chunk[] = [];
  const index = new Map<string, number>();
  const pieces: Plan["pieces"][number][] = [];
  ranges.forEach((range, i) => {
    const base = BASES[platform][range.domain];
    if (!valid[i] || base === undefined) {
      pieces.push(null);
      return;
    }
    const cuts = (DESCRIPTOR_CUTS[platform][range.domain] ?? []).filter(
      (cut) => cut > range.offset && cut < range.offset + range.length,
    );
    const edges = [range.offset, ...cuts, range.offset + range.length];
    const own: (Piece & { length: number })[] = [];
    for (let e = 0; e + 1 < edges.length; e++) {
      const start = edges[e] ?? 0;
      const end = edges[e + 1] ?? 0;
      for (let at = start; at < end; at += MAX_CHUNK) {
        const length = Math.min(MAX_CHUNK, end - at);
        const key = `${base + at}:${length}`;
        let chunk = index.get(key);
        if (chunk === undefined) {
          chunk = chunks.length;
          chunks.push({ address: base + at, length });
          index.set(key, chunk);
        }
        own.push({ chunk, at: at - range.offset, length });
      }
    }
    pieces.push(own);
  });
  return { chunks, pieces };
}

export function readCommand(chunk: Chunk): string {
  return `READ_CORE_MEMORY ${chunk.address.toString(16)} ${chunk.length}`;
}

export type ReadReply =
  | {
      readonly kind: "data";
      readonly address: number;
      readonly bytes: Uint8Array;
    }
  /** RetroArch's failure reply, such as `READ_CORE_MEMORY <addr> -1`. */
  | { readonly kind: "error"; readonly address: number };

/** null when the text isn't a READ_CORE_MEMORY reply. */
export function parseRead(text: string): ReadReply | null {
  const tokens = text.trim().split(/\s+/);
  if (tokens[0] !== "READ_CORE_MEMORY" || tokens.length < 2) return null;
  const address = /^[0-9a-fA-F]+$/.test(tokens[1] ?? "")
    ? Number.parseInt(tokens[1] ?? "", 16)
    : Number.NaN;
  if (Number.isNaN(address)) return null;
  const rest = tokens.slice(2);
  if (!rest.every((token) => /^[0-9a-fA-F]{2}$/.test(token)))
    return { kind: "error", address };
  return {
    kind: "data",
    address,
    bytes: Uint8Array.from(rest, (token) => Number.parseInt(token, 16)),
  };
}
