import type { Domain, Platform } from "@pokemon-memory-reader/internal/memory";
import type { ERROR_CODES } from "./constants";

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Spec §4.3. The strict Zod schemas for these bodies come with the bridge adapter. */
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
