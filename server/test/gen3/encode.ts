import { STORAGE } from "../../src/format/gen3/structs";
import gen3En from "../../src/reference/data/gen3-en.json";

/** Order of the four substructures per `personality % 24`, as (growth, attacks, EVs, misc) positions. Written from pokeemerald `sSubstructOrders`. */
export const POSITIONS: ReadonlyArray<
  readonly [number, number, number, number]
> = [
  [0, 1, 2, 3],
  [0, 1, 3, 2],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
  [0, 2, 3, 1],
  [0, 3, 2, 1],
  [1, 0, 2, 3],
  [1, 0, 3, 2],
  [2, 0, 1, 3],
  [3, 0, 1, 2],
  [2, 0, 3, 1],
  [3, 0, 2, 1],
  [1, 2, 0, 3],
  [1, 3, 0, 2],
  [2, 1, 0, 3],
  [3, 1, 0, 2],
  [2, 3, 0, 1],
  [3, 2, 0, 1],
  [1, 2, 3, 0],
  [1, 3, 2, 0],
  [2, 1, 3, 0],
  [3, 1, 2, 0],
  [2, 3, 1, 0],
  [3, 2, 1, 0],
];

export interface MonSpec {
  personality: number;
  tid?: number;
  sid?: number;
  nickname?: string;
  otName?: string;
  /** 1 Japanese, 2 English. */
  language?: number;
  species: number;
  heldItem?: number;
  experience?: number;
  ppBonuses?: number;
  friendship?: number;
  moves?: readonly [number, number, number, number];
  pp?: readonly [number, number, number, number];
  evs?: {
    hp: number;
    atk: number;
    def: number;
    spe: number;
    spa: number;
    spd: number;
  };
  pokerus?: number;
  metLocation?: number;
  metLevel?: number;
  metGame?: number;
  ball?: number;
  otFemale?: boolean;
  ivs?: {
    hp: number;
    atk: number;
    def: number;
    spe: number;
    spa: number;
    spd: number;
  };
  isEgg?: boolean;
  /** Overrides the set the OT name is encoded with. */
  otSet?: "latin" | "kana";
  abilityNum?: number;
  status?: number;
  level?: number;
  hp?: number;
  maxHp?: number;
  atk?: number;
  def?: number;
  spe?: number;
  spa?: number;
  spd?: number;
  flags?: number;
  /** Added to the stored checksum, to corrupt it. */
  checksumOffset?: number;
}

/** Inverse of the charmap for one set. The first byte wins when two bytes share a glyph. */
function reverse(set: "latin" | "kana"): Map<string, number> {
  const map = new Map<string, number>();
  gen3En.charmap[set].forEach((glyph, byte) => {
    if (glyph !== null && byte !== 0xff && !map.has(glyph))
      map.set(glyph, byte);
  });
  return map;
}

export function encodeText(
  text: string,
  length: number,
  set: "latin" | "kana" = "latin",
): Uint8Array {
  const out = new Uint8Array(length).fill(0xff);
  const bytes = reverse(set);
  [...text].forEach((glyph, i) => {
    const byte = bytes.get(glyph);
    if (byte === undefined) throw new Error(`no byte for ${glyph}`);
    out[i] = byte;
  });
  return out;
}

/** Builds one 100-byte party Pokémon, encrypted and shuffled the way the game stores it. */
export function encodeMon(spec: MonSpec): Uint8Array {
  const out = new Uint8Array(100);
  const view = new DataView(out.buffer);
  const language = spec.language ?? 2;
  const set = language === 1 ? "kana" : "latin";
  const otId = (((spec.sid ?? 0) << 16) | (spec.tid ?? 0)) >>> 0;
  view.setUint32(0x00, spec.personality >>> 0, true);
  view.setUint32(0x04, otId, true);
  out.set(encodeText(spec.nickname ?? "", 10, set), 0x08);
  out[0x12] = language;
  out[0x13] = spec.flags ?? 0x02;
  // A hatching egg stores its OT in the game's language, not Japanese.
  out.set(
    encodeText(
      spec.otName ?? "ASH",
      7,
      spec.otSet ?? (spec.isEgg ? "latin" : set),
    ),
    0x14,
  );

  const growth = new DataView(new ArrayBuffer(12));
  growth.setUint16(0, spec.species, true);
  growth.setUint16(2, spec.heldItem ?? 0, true);
  growth.setUint32(4, spec.experience ?? 0, true);
  growth.setUint8(8, spec.ppBonuses ?? 0);
  growth.setUint8(9, spec.friendship ?? 70);

  const attacks = new DataView(new ArrayBuffer(12));
  for (const [i, id] of (spec.moves ?? [0, 0, 0, 0]).entries()) {
    attacks.setUint16(i * 2, id, true);
  }
  for (const [i, pp] of (spec.pp ?? [0, 0, 0, 0]).entries()) {
    attacks.setUint8(8 + i, pp);
  }

  const evs = new DataView(new ArrayBuffer(12));
  const e = spec.evs ?? { hp: 0, atk: 0, def: 0, spe: 0, spa: 0, spd: 0 };
  for (const [i, v] of [e.hp, e.atk, e.def, e.spe, e.spa, e.spd].entries()) {
    evs.setUint8(i, v);
  }

  const misc = new DataView(new ArrayBuffer(12));
  misc.setUint8(0, spec.pokerus ?? 0);
  misc.setUint8(1, spec.metLocation ?? 0);
  misc.setUint16(
    2,
    ((spec.metLevel ?? 5) & 0x7f) |
      (((spec.metGame ?? 3) & 0xf) << 7) |
      (((spec.ball ?? 4) & 0xf) << 11) |
      ((spec.otFemale ? 1 : 0) << 15),
    true,
  );
  const iv = spec.ivs ?? { hp: 0, atk: 0, def: 0, spe: 0, spa: 0, spd: 0 };
  misc.setUint32(
    4,
    (iv.hp |
      (iv.atk << 5) |
      (iv.def << 10) |
      (iv.spe << 15) |
      (iv.spa << 20) |
      (iv.spd << 25) |
      ((spec.isEgg ? 1 : 0) << 30) |
      ((spec.abilityNum ?? 0) << 31)) >>>
      0,
    true,
  );

  const kinds = [growth, attacks, evs, misc];
  const positions = POSITIONS[spec.personality % 24] as readonly number[];
  const plain = new Uint8Array(48);
  for (const [i, kind] of kinds.entries()) {
    plain.set(new Uint8Array(kind.buffer), (positions[i] as number) * 12);
  }
  const plainView = new DataView(plain.buffer);
  let sum = 0;
  for (let i = 0; i < 48; i += 2) sum += plainView.getUint16(i, true);
  view.setUint16(
    0x1c,
    ((sum & 0xffff) + (spec.checksumOffset ?? 0)) & 0xffff,
    true,
  );

  const key = (otId ^ spec.personality) >>> 0;
  for (let i = 0; i < 48; i += 4) {
    view.setUint32(0x20 + i, (plainView.getUint32(i, true) ^ key) >>> 0, true);
  }

  view.setUint32(0x50, spec.status ?? 0, true);
  view.setUint8(0x54, spec.level ?? 5);
  view.setUint16(0x56, spec.hp ?? 20, true);
  view.setUint16(0x58, spec.maxHp ?? 20, true);
  view.setUint16(0x5a, spec.atk ?? 11, true);
  view.setUint16(0x5c, spec.def ?? 12, true);
  view.setUint16(0x5e, spec.spe ?? 13, true);
  view.setUint16(0x60, spec.spa ?? 14, true);
  view.setUint16(0x62, spec.spd ?? 15, true);
  return out;
}

/** The bytes of a party slice: the mons back to back, padded with zeroed slots to six. */
export function partyBytes(mons: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(600);
  for (const [i, mon] of mons.entries()) out.set(mon, i * 100);
  return out;
}

export interface StorageSpec {
  currentBox?: number;
  /** Mons by box, then slot. A slot not listed stays zeroed, which is how the game stores an empty one. */
  slots?: Readonly<Record<number, Readonly<Record<number, Uint8Array>>>>;
  names?: Readonly<Record<number, string>>;
  wallpapers?: Readonly<Record<number, number>>;
}

/** The bytes of one `PokemonStorage`: `currentBox`, 14 boxes of 30 boxed mons, then names and wallpapers. */
export function storageBytes(spec: StorageSpec = {}): Uint8Array {
  const out = new Uint8Array(STORAGE.size);
  out[STORAGE.currentBox] = spec.currentBox ?? 0;
  for (const [box, slots] of Object.entries(spec.slots ?? {})) {
    for (const [slot, mon] of Object.entries(slots)) {
      const offset =
        STORAGE.boxes + (Number(box) * STORAGE.slotCount + Number(slot)) * 80;
      out.set(mon.subarray(0, 80), offset);
    }
  }
  for (let box = 0; box < STORAGE.boxCount; box++) {
    out.set(
      encodeText(spec.names?.[box] ?? `BOX${box + 1}`, STORAGE.nameStride),
      STORAGE.names + box * STORAGE.nameStride,
    );
    out[STORAGE.wallpapers + box] = spec.wallpapers?.[box] ?? box % 16;
  }
  return out;
}
