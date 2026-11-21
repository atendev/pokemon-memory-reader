import type { Type } from "@pokemon-memory-reader/api/schemas";
import { TYPES } from "@pokemon-memory-reader/api/schemas";

export type IconKey =
  | {
      readonly kind: "pokemon";
      readonly profileId: string;
      readonly id: number;
      readonly shiny: boolean;
    }
  | { readonly kind: "icon"; readonly profileId: string; readonly id: number }
  | { readonly kind: "item"; readonly profileId: string; readonly id: number }
  | {
      readonly kind: "type";
      readonly profileId: string;
      readonly typeName: Type;
    };

const PROFILE_ID = /^[A-Za-z0-9._-]+$/;
const DECIMAL_ID = /^(?:0|[1-9][0-9]{0,4})$/;
const MAX_ID = 65535;

const decimalId = (text: string): number | null => {
  if (!DECIMAL_ID.test(text)) return null;
  const id = Number(text);
  return id <= MAX_ID ? id : null;
};

/**
 * Parses the part of a request path under `/icons/` into a key, or null for anything the
 * grammar rejects (spec §11.9, "Key grammar"). The profile segment is checked raw, so an encoded
 * `..` never gets through, and only `typeName` is URL-decoded.
 */
export function parseIconPath(pathname: string): IconKey | null {
  if (!pathname.startsWith("/icons/")) return null;
  const parts = pathname.slice("/icons/".length).split("/");
  const [profileId, kind, value, extra, ...rest] = parts;
  if (profileId === undefined || kind === undefined || value === undefined)
    return null;
  if (rest.length > 0) return null;
  if (!PROFILE_ID.test(profileId) || profileId === "." || profileId === "..")
    return null;
  if (kind === "pokemon") {
    const id = decimalId(value);
    if (id === null) return null;
    if (extra === undefined) return { kind, profileId, id, shiny: false };
    return extra === "shiny" ? { kind, profileId, id, shiny: true } : null;
  }
  if (extra !== undefined) return null;
  if (kind === "icon" || kind === "item") {
    const id = decimalId(value);
    return id === null ? null : { kind, profileId, id };
  }
  if (kind === "type") {
    let typeName: string;
    try {
      typeName = decodeURIComponent(value);
    } catch {
      return null;
    }
    return (TYPES as readonly string[]).includes(typeName)
      ? { kind, profileId, typeName: typeName as Type }
      : null;
  }
  return null;
}
