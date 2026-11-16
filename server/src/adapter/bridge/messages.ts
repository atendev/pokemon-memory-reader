import type { Domain, Platform } from "@pokemon-memory-reader/internal/memory";
import { z } from "zod";
import { DOMAIN_CODES, ERROR_CODES, PROTOCOL } from "./constants";

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Spec §4.3. */
export interface HelloBody {
  readonly bridge: "mgba" | "bizhawk";
  readonly protocol: number;
  readonly build: string;
  readonly emulator: { readonly name: string; readonly version: string | null };
}

/** The body is `null` with no ROM loaded. */
export interface GameBody {
  readonly platform: Platform | "other";
  readonly romName: string | null;
  readonly crc32: string | null;
  readonly sha1: string | null;
  readonly domains: Readonly<Partial<Record<Domain, number>>>;
}

export interface ErrorBody {
  readonly code: ErrorCode;
  readonly message: string;
}

export function encodeJsonBody(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

/** Throws on bytes that aren't UTF-8 JSON. */
export function decodeJsonBody(body: Uint8Array): unknown {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
}

/** Step 1 of the hello check (spec §4.7): enough to tell a protocol difference from a bad hello. */
const helloStep1 = z.object({ bridge: z.string(), protocol: z.number().int() });

const helloStrict = z.object({
  bridge: z.enum(["mgba", "bizhawk"]),
  protocol: z.literal(PROTOCOL),
  build: z.string(),
  emulator: z.object({ name: z.string(), version: z.string().nullable() }),
});

const gameStrict = z
  .object({
    platform: z.enum(["gb", "gba", "other"]),
    romName: z.string().nullable(),
    crc32: z.string().nullable(),
    sha1: z.string().nullable(),
    domains: z.record(z.string(), z.number().int().nonnegative()),
  })
  .nullable();

const errorStrict = z.object({ code: z.string(), message: z.string() });

export type HelloCheck =
  | { readonly kind: "ok"; readonly hello: HelloBody }
  /** Only `bridge` and `protocol` are trusted, as spec §4.7 says. */
  | {
      readonly kind: "protocol_mismatch";
      readonly bridge: string;
      readonly protocol: number;
    }
  | { readonly kind: "unknown_bridge" };

/** The two-step hello check of spec §4.7. A protocol difference always wins over step 2. */
export function checkHello(value: unknown): HelloCheck {
  const step1 = helloStep1.safeParse(value);
  if (!step1.success) return { kind: "unknown_bridge" };
  if (step1.data.protocol !== PROTOCOL) {
    return {
      kind: "protocol_mismatch",
      bridge: step1.data.bridge,
      protocol: step1.data.protocol,
    };
  }
  const strict = helloStrict.safeParse(value);
  if (!strict.success) return { kind: "unknown_bridge" };
  return { kind: "ok", hello: strict.data };
}

/** `undefined` means the body failed validation (a `bridge_error`). `null` is a valid "no ROM". Unknown domain names are dropped. */
export function parseGame(value: unknown): GameBody | null | undefined {
  const parsed = gameStrict.safeParse(value);
  if (!parsed.success) return undefined;
  if (parsed.data === null) return null;
  const domains: Partial<Record<Domain, number>> = {};
  for (const [name, size] of Object.entries(parsed.data.domains)) {
    if (Object.hasOwn(DOMAIN_CODES, name)) domains[name as Domain] = size;
  }
  return { ...parsed.data, domains };
}

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set(ERROR_CODES);

/** A body that fails validation, or an unknown code, counts as `internal` (spec §4.6, §4.7). */
export function parseError(value: unknown): ErrorBody {
  const parsed = errorStrict.safeParse(value);
  if (!parsed.success) return { code: "internal", message: "" };
  const code = KNOWN_ERROR_CODES.has(parsed.data.code)
    ? (parsed.data.code as ErrorCode)
    : "internal";
  return { code, message: parsed.data.message };
}
