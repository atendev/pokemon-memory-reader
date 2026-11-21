import type { Platform } from "@pokemon-memory-reader/internal/memory";
import { z } from "zod";
import { cfruAddresses } from "../format/cfru/profile";
import { gen1Addresses } from "../format/gen1/profile";
import { gen2Addresses } from "../format/gen2/profile";
import {
  gen3Addresses,
  gen3Bag,
  gen3Constants,
  gen3Player,
} from "../format/gen3/profile";
import { addressText, anyAddress } from "./address";

export const DATA_FORMATS = ["gen1", "gen2", "gen3", "cfru"] as const;
export type DataFormatId = (typeof DATA_FORMATS)[number];

/** Closed ISO 639-1 enum covering every official Gen 1-3 release (interfaces 004). */
export const LANGUAGES = ["ja", "en", "fr", "de", "it", "es", "ko"] as const;
/** The languages with shipped reference data (amendment 019 §3). */
export const SHIPPED_LANGUAGES = ["en"] as const;

export const ART_VERSIONS = [
  "red-blue",
  "red-green-japan",
  "yellow",
  "gold",
  "silver",
  "crystal",
  "ruby-sapphire",
  "emerald",
  "firered-leafgreen",
] as const;
export type ArtVersion = (typeof ART_VERSIONS)[number];

/** The platform each data format runs on. */
export const platformOf: Record<DataFormatId, Platform> = {
  gen1: "gb",
  gen2: "gb",
  gen3: "gba",
  cfru: "gba",
};

const hash = (length: number) =>
  z.string().regex(new RegExp(`^[0-9a-f]{${length}}$`));
const hexBytes = z.string().regex(/^([0-9a-f]{2})+$/);

const gbaHeader = z
  .object({
    gameCode: z.string().regex(/^[A-Z0-9]{4}$/),
    revision: z.int().min(0).max(255),
  })
  .strict();
const gbHeader = z
  .object({
    title: z.string(),
    maskRomVersion: z.int().min(0).max(255),
    globalChecksum: z.int().min(0).max(0xffff),
  })
  .strict();

const provenance = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("pret"),
      repo: z.string(),
      commit: z.string().regex(/^[0-9a-f]{40}$/),
      symbolFile: z.string(),
      signatureEvidence: z.enum(["owner", "chain", "unconfirmed"]).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("hack-sym"),
      hack: z.string(),
      version: z.string(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    })
    .strict(),
]);

const constants = z.record(z.string(), z.number());
/** The `player` block as a file states it. Each data format types its own keys in the full schema. */
const playerValues = z.union([z.number(), z.array(z.number())]);
/** Formats whose player decoder isn't built accept any keys. */
const untypedPlayer = z.record(z.string(), playerValues).default({});
/** Formats whose bag decoder isn't built accept any keys. */
const untypedBag = z.record(z.string(), playerValues).default({});
const features = z.object({ boxes: z.boolean().optional() }).strict();
const fixture = z.enum(["full", "smoke", "none"]);
const kind = z.enum(["official", "hack"]);

/** Everything that holds an address, built once with the text form and once per platform with the translated form. */
function tables<A extends z.ZodType, H extends z.ZodType>(addr: A, header: H) {
  const count = z.int().min(1).max(65535);
  const romTable = z.object({ base: addr, count }).strict();
  const inline = z
    .object({ kind: z.literal("inline"), length: z.int().min(1) })
    .strict();
  const pointer = z
    .object({ kind: z.literal("pointer"), maxLength: z.int().min(1) })
    .strict();
  const nameTable = <N extends z.ZodType>(name: N) =>
    z
      .object({
        base: addr,
        count,
        stride: z.int().min(1),
        nameOffset: z.int().min(0).default(0),
        name,
      })
      .strict();
  const inlineTable = z.union([nameTable(inline), z.literal("vanilla")]);
  const locationTable = z.union([
    nameTable(z.union([inline, pointer])),
    z.literal("vanilla"),
  ]);
  return {
    nameTables: z
      .object({
        species: inlineTable.optional(),
        moves: inlineTable.optional(),
        items: inlineTable.optional(),
        abilities: inlineTable.optional(),
        locations: locationTable.optional(),
      })
      .strict(),
    speciesData: z
      .object({
        info: z.union([romTable, z.literal("vanilla")]).optional(),
        dex: z.union([romTable, z.literal("vanilla")]).optional(),
        exp: z
          .union([
            z
              .object({ base: addr, maxLevel: z.int().min(1).max(255) })
              .strict(),
            z.literal("vanilla"),
          ])
          .optional(),
      })
      .strict(),
    moveData: z.union([romTable, z.literal("vanilla")]),
    trainerTables: z
      .object({
        trainers: z.object({ base: addr, count }).strict().optional(),
        classNames: z.object({ base: addr, count }).strict().optional(),
        money: z.object({ base: addr, count }).strict().optional(),
      })
      .strict(),
    identify: z
      .object({
        sha1: z.array(hash(40)).default([]),
        crc32: z.array(hash(8)).default([]),
        header: header.optional(),
        signature: z
          .array(z.object({ address: addr, bytes: hexBytes }).strict())
          .default([]),
      })
      .strict(),
  };
}

const fileTables = tables(addressText, z.union([gbaHeader, gbHeader]));

/** In a file, any key of a merged block may be null, which removes the inherited key (amendment 018 §2). */
function removable<T extends z.ZodRawShape>(
  shape: T,
): { [K in keyof T]: z.ZodOptional<z.ZodNullable<T[K]>> } {
  return Object.fromEntries(
    Object.entries(shape).map(([key, value]) => [
      key,
      (value as z.ZodType).nullable().optional(),
    ]),
  ) as unknown as { [K in keyof T]: z.ZodOptional<z.ZodNullable<T[K]>> };
}

/**
 * The file schema checks each profile file as written (amendment 018 §3). It stays in text form,
 * so z.toJSONSchema(profileFile) gives editors autocomplete. Blocks are loose records because
 * inherited fields may be missing, and null removes an inherited key.
 */
export const profileFile = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/),
    kind,
    name: z.string().min(1),
    extends: z.string().optional(),
    dataFormat: z.enum(DATA_FORMATS).optional(),
    language: z.enum(LANGUAGES).optional(),
    artVersion: z.enum(ART_VERSIONS).optional(),
    addresses: z.record(z.string(), addressText.nullable()).optional(),
    constants: z.record(z.string(), z.number().nullable()).optional(),
    player: z.record(z.string(), playerValues.nullable()).optional(),
    bag: z.record(z.string(), playerValues.nullable()).optional(),
    identify: fileTables.identify.optional(),
    nameTables: z
      .object(removable(fileTables.nameTables.shape))
      .strict()
      .nullable()
      .optional(),
    speciesData: z
      .object(removable(fileTables.speciesData.shape))
      .strict()
      .optional(),
    moveData: fileTables.moveData.optional(),
    trainerTables: z
      .object(removable(fileTables.trainerTables.shape))
      .strict()
      .optional(),
    features: features.optional(),
    fixture: fixture.optional(),
    provenance: provenance.optional(),
  })
  .strict();
export type ProfileFile = z.infer<typeof profileFile>;

function member<
  F extends DataFormatId,
  A extends z.ZodType,
  P extends z.ZodType,
  B extends z.ZodType,
  C extends z.ZodType,
>(format: F, addresses: A, player: P, bag: B, formatConstants: C) {
  const platform = platformOf[format];
  const t = tables(
    anyAddress(platform),
    platform === "gba" ? gbaHeader : gbHeader,
  );
  return z
    .object({
      id: z.string(),
      kind,
      name: z.string().min(1),
      dataFormat: z.literal(format),
      language: z.literal(SHIPPED_LANGUAGES, {
        error: (issue) =>
          `language ${JSON.stringify(issue.input)} has no shipped reference data (v2.0 ships "en")`,
      }),
      artVersion: z.enum(ART_VERSIONS),
      addresses,
      constants: formatConstants,
      player,
      bag,
      identify: t.identify.optional(),
      nameTables: t.nameTables.optional(),
      speciesData: t.speciesData.optional(),
      moveData: t.moveData.optional(),
      trainerTables: t.trainerTables.default({}),
      features: features.optional(),
      fixture: fixture.default("none"),
      provenance: provenance.optional(),
    })
    .strict();
}

/**
 * The full schema checks the resolved profile (amendment 018 §3) and translates every address
 * through internal/memory. A hack must state every name table, species table and move table.
 */
export const profileFull = z
  .discriminatedUnion("dataFormat", [
    member(
      "gen1",
      gen1Addresses,
      untypedPlayer,
      untypedBag,
      constants.default({}),
    ),
    member(
      "gen2",
      gen2Addresses,
      untypedPlayer,
      untypedBag,
      constants.default({}),
    ),
    member("gen3", gen3Addresses, gen3Player, gen3Bag, gen3Constants),
    member(
      "cfru",
      cfruAddresses,
      untypedPlayer,
      untypedBag,
      constants.default({}),
    ),
  ])
  .superRefine((profile, ctx) => {
    if (profile.kind !== "hack") return;
    const missing = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message, input: undefined });
    for (const key of [
      "species",
      "moves",
      "items",
      "abilities",
      "locations",
    ] as const) {
      if (profile.nameTables?.[key] === undefined) {
        missing(
          ["nameTables", key],
          `a hack profile must state nameTables.${key}`,
        );
      }
    }
    for (const key of ["info", "dex", "exp"] as const) {
      if (profile.speciesData?.[key] === undefined) {
        missing(
          ["speciesData", key],
          `a hack profile must state speciesData.${key}`,
        );
      }
    }
    if (profile.moveData === undefined)
      missing(["moveData"], "a hack profile must state moveData");
  })
  .transform((profile) => ({
    ...profile,
    identify: profile.identify ?? null,
    nameTables: profile.nameTables ?? null,
    speciesData: profile.speciesData ?? null,
    moveData: profile.moveData ?? null,
    features: { boxes: profile.features?.boxes ?? profile.kind === "official" },
    provenance: profile.provenance ?? null,
  }));

export type Profile<F extends DataFormatId = DataFormatId> = Extract<
  z.output<typeof profileFull>,
  { dataFormat: F }
>;
