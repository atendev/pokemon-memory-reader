import type {
  MemoryAddress,
  PointerAddress,
  ProfileAddress,
} from "@pokemon-memory-reader/internal/memory";
import { isPointerAddress } from "@pokemon-memory-reader/internal/memory";
import type { Bytes } from "./bytes";

/** What a decoder declares: a static range, or a range at a pointer's target. */
export type Region =
  | {
      readonly kind: "static";
      readonly at: MemoryAddress;
      readonly length: number;
    }
  | {
      readonly kind: "pointer";
      readonly at: PointerAddress;
      readonly length: number;
    };

export function region(at: ProfileAddress, length: number): Region {
  return isPointerAddress(at)
    ? { kind: "pointer", at, length }
    : { kind: "static", at, length };
}

/** A decoder part's named regions. Names tie each declaration to the bytes decode() gets. */
export type Regions = Readonly<Record<string, Region>>;
/** The bytes of each named region as read: a slice per name. */
export type Slices<R extends Regions> = { readonly [K in keyof R]: Bytes };
