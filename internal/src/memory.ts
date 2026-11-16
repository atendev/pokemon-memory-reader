export const PLATFORMS = ["gb", "gba"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const DOMAINS = [
  "rom",
  "ewram",
  "iwram",
  "wram",
  "hram",
  "sram",
] as const;
export type Domain = (typeof DOMAINS)[number];
export type GbaDomain = "rom" | "ewram" | "iwram";
export type GbDomain = "rom" | "wram" | "hram" | "sram";

export interface MemoryAddress {
  readonly domain: Domain;
  readonly offset: number;
}

export interface PointerAddress {
  readonly at: MemoryAddress;
  readonly width: 2 | 4;
  readonly bank: number | null;
  readonly offset: number;
}

export type ProfileAddress = MemoryAddress | PointerAddress;

export type ProfileAddressText =
  | string
  | {
      readonly ptr: string;
      readonly offset: string;
      readonly bank?: string | undefined;
    };

export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

const GBA_RANGES: ReadonlyArray<{
  domain: GbaDomain;
  start: number;
  end: number;
}> = [
  { domain: "ewram", start: 0x02000000, end: 0x0203ffff },
  { domain: "iwram", start: 0x03000000, end: 0x03007fff },
  { domain: "rom", start: 0x08000000, end: 0x09ffffff },
];

function mapGba(bus: number): MemoryAddress | null {
  for (const range of GBA_RANGES) {
    if (bus >= range.start && bus <= range.end) {
      return { domain: range.domain, offset: bus - range.start };
    }
  }
  return null;
}

function mapGb(bank: number, address: number): MemoryAddress | null {
  if (address <= 0x3fff) {
    return bank === 0 ? { domain: "rom", offset: address } : null;
  }
  if (address <= 0x7fff) {
    return bank >= 1
      ? { domain: "rom", offset: bank * 0x4000 + address - 0x4000 }
      : null;
  }
  if (address >= 0xa000 && address <= 0xbfff) {
    return { domain: "sram", offset: bank * 0x2000 + address - 0xa000 };
  }
  if (address >= 0xc000 && address <= 0xcfff) {
    return bank === 0 ? { domain: "wram", offset: address - 0xc000 } : null;
  }
  if (address >= 0xd000 && address <= 0xdfff) {
    if (bank > 7) return null;
    return {
      domain: "wram",
      offset: (bank === 0 ? 1 : bank) * 0x1000 + address - 0xd000,
    };
  }
  if (address >= 0xff80 && address <= 0xfffe) {
    return bank === 0 ? { domain: "hram", offset: address - 0xff80 } : null;
  }
  return null;
}

function fail(text: string, why: string): { ok: false; error: string } {
  return { ok: false, error: `${why}: ${JSON.stringify(text)}` };
}

/** Bus notation to domain and offset (amendment §17.1). Only canonical ranges map. */
export function parseAddress(
  platform: Platform,
  text: string,
): Parsed<MemoryAddress> {
  if (platform === "gba") {
    if (!/^0x[0-9a-fA-F]{1,8}$/.test(text))
      return fail(text, "not a GBA bus address");
    const mapped = mapGba(Number.parseInt(text.slice(2), 16));
    return mapped
      ? { ok: true, value: mapped }
      : fail(text, "GBA address outside every mapped range");
  }
  const match = /^([0-9a-fA-F]{2}):([0-9a-fA-F]{4})$/.exec(text);
  if (!match) return fail(text, "not a GB bank:address");
  const mapped = mapGb(
    Number.parseInt(match[1] ?? "", 16),
    Number.parseInt(match[2] ?? "", 16),
  );
  return mapped
    ? { ok: true, value: mapped }
    : fail(text, "GB address unmapped or bank not allowed there");
}

/** Maps a pointer value read from memory. 0 and unmapped values give null (amendment §17.1 item 7). */
export function mapPointerValue(
  platform: Platform,
  value: number,
  bank: number | null,
): MemoryAddress | null {
  if (!Number.isInteger(value) || value <= 0) return null;
  if (platform === "gba") return value > 0xffffffff ? null : mapGba(value);
  if (
    value > 0xffff ||
    bank === null ||
    !Number.isInteger(bank) ||
    bank < 0 ||
    bank > 0xff
  ) {
    return null;
  }
  return mapGb(bank, value);
}

function parseOffset(text: string): Parsed<number> {
  if (!/^0x[0-9a-fA-F]{1,8}$/.test(text))
    return fail(text, "offset is not a hex string");
  return { ok: true, value: Number.parseInt(text.slice(2), 16) };
}

/** A static address string or a pointer entry to its loaded form (amendment §17.1 items 5 and 6). */
export function parseProfileAddress(
  platform: Platform,
  entry: ProfileAddressText,
): Parsed<ProfileAddress> {
  if (typeof entry === "string") return parseAddress(platform, entry);
  const at = parseAddress(platform, entry.ptr);
  if (!at.ok) return at;
  const offset = parseOffset(entry.offset);
  if (!offset.ok) return offset;
  let bank: number | null = null;
  if (platform === "gb") {
    if (entry.bank === undefined || !/^[0-9a-fA-F]{2}$/.test(entry.bank)) {
      return fail(
        entry.bank ?? "",
        "a GB pointer entry needs a two-digit hex bank",
      );
    }
    bank = Number.parseInt(entry.bank, 16);
  } else if (entry.bank !== undefined) {
    return fail(entry.bank, "bank is not allowed on a GBA pointer entry");
  }
  return {
    ok: true,
    value: {
      at: at.value,
      width: platform === "gba" ? 4 : 2,
      bank,
      offset: offset.value,
    },
  };
}

export function isPointerAddress(
  address: ProfileAddress,
): address is PointerAddress {
  return "at" in address;
}
