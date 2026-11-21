import { BRIDGE_CAPS } from "../adapter/bridge/constants";
import { declaredRegions } from "../format/registry";
import { type BatchCaps, checkRequestCaps } from "./caps";
import { type Profile, profileFile, profileFull } from "./schema";

export type RomHeader =
  | {
      readonly platform: "gba";
      readonly title: string;
      readonly gameCode: string;
      readonly revision: number;
    }
  | {
      readonly platform: "gb";
      readonly title: string;
      readonly maskRomVersion: number;
      readonly globalChecksum: number;
    };

export interface ProfileProblem {
  readonly source: "builtin" | "user";
  readonly path: string;
  readonly message: string;
}

export interface ProfileRegistry {
  get(id: string): Profile | undefined;
  all(): readonly Profile[];
  byHash(hashes: {
    readonly crc32: string | null;
    readonly sha1: string | null;
  }): readonly Profile[];
  byHeader(header: RomHeader): readonly Profile[];
}

export interface LoadInput {
  readonly builtin: readonly unknown[];
  readonly user: ReadonlyArray<{
    readonly path: string;
    readonly json: unknown;
  }>;
  /** The bridge caps every profile's reads must fit. Tests lower them; the default is the real bridges'. */
  readonly caps?: BatchCaps;
}

type Json = Record<string, unknown>;
type Resolved =
  | { ok: true; raw: Json; kinds: string[] }
  | { ok: false; error: string };

/** Fields a child never inherits (amendment 018 §2). */
const OWN_FIELDS = [
  "id",
  "kind",
  "name",
  "identify",
  "fixture",
  "provenance",
  "features",
] as const;
/** Blocks that merge one level deep, where a null key removes the inherited key. */
const MERGED_BLOCKS = [
  "addresses",
  "constants",
  "player",
  "nameTables",
  "speciesData",
  "trainerTables",
] as const;

interface Source {
  readonly source: "builtin" | "user";
  readonly path: string;
  readonly file: Json & { id: string; kind: string; extends?: string };
}

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function merge(parent: Json, child: Json): Json {
  const out: Json = {};
  for (const [key, value] of Object.entries(parent)) {
    if (!(OWN_FIELDS as readonly string[]).includes(key)) out[key] = value;
  }
  for (const [key, value] of Object.entries(child)) {
    if (key === "extends") continue;
    if ((MERGED_BLOCKS as readonly string[]).includes(key)) {
      if (value === null) {
        delete out[key];
        continue;
      }
      const inherited = isRecord(out[key]) ? out[key] : {};
      const block: Json = { ...inherited };
      for (const [name, entry] of Object.entries(value as Json)) {
        if (entry === null) delete block[name];
        else block[name] = entry;
      }
      out[key] = block;
    } else {
      out[key] = value;
    }
  }
  return out;
}

function resolve(
  file: Source["file"],
  byId: ReadonlyMap<string, Source>,
  chain: string[],
): Resolved {
  if (file.extends === undefined) {
    return { ok: true, raw: { ...file }, kinds: [file.kind] };
  }
  const trail = [...chain, file.id];
  if (trail.includes(file.extends)) {
    return {
      ok: false,
      error: `extends cycle: ${[...trail, file.extends].join(" → ")}`,
    };
  }
  const parent = byId.get(file.extends);
  if (!parent)
    return {
      ok: false,
      error: `parent profile "${file.extends}" does not exist`,
    };
  const resolvedParent = resolve(parent.file, byId, trail);
  if (!resolvedParent.ok) return resolvedParent;
  return {
    ok: true,
    raw: {
      ...merge(resolvedParent.raw, file),
      id: file.id,
      kind: file.kind,
      name: file.name,
    },
    kinds: [file.kind, ...resolvedParent.kinds],
  };
}

function finish(
  file: Source["file"],
  byId: ReadonlyMap<string, Source>,
  caps: BatchCaps,
): { ok: true; profile: Profile } | { ok: false; error: string } {
  const resolved = resolve(file, byId, []);
  if (!resolved.ok) return resolved;
  if (file.kind === "official" && resolved.kinds.includes("hack")) {
    return { ok: false, error: "an official profile can't extend a hack" };
  }
  const parsed = profileFull.safeParse(resolved.raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join(".") || "(profile)"}: ${i.message}`,
    );
    return { ok: false, error: issues.join("; ") };
  }
  const declared = declaredRegions(parsed.data);
  const tooBig =
    checkRequestCaps("main batch", declared.main, caps) ??
    checkRequestCaps("box request", declared.boxes, caps);
  if (tooBig !== null) return { ok: false, error: tooBig };
  return { ok: true, profile: parsed.data };
}

function checkFile(
  source: "builtin" | "user",
  path: string,
  json: unknown,
  problems: ProfileProblem[],
): Source | null {
  const parsed = profileFile.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join(".") || "(file)"}: ${i.message}`,
    );
    problems.push({ source, path, message: issues.join("; ") });
    return null;
  }
  if (source === "builtin" && !(isRecord(json) && "fixture" in json)) {
    problems.push({
      source,
      path,
      message: "a built-in profile must state its fixture",
    });
    return null;
  }
  return { source, path, file: parsed.data as Source["file"] };
}

function overlay(
  ...layers: ReadonlyArray<readonly Source[]>
): Map<string, Source> {
  const map = new Map<string, Source>();
  for (const layer of layers)
    for (const entry of layer) map.set(entry.file.id, entry);
  return map;
}

/**
 * Loads once into an immutable registry in amendment 018's three steps. Each resolved profile's
 * decoder reads must fit the bridge caps (amendment 026 §6). A user replacement that
 * fails for any reason is skipped and the built-in keeps its ID. Problems never throw.
 */
export function loadProfiles(input: LoadInput): {
  readonly registry: ProfileRegistry;
  readonly problems: readonly ProfileProblem[];
} {
  const problems: ProfileProblem[] = [];
  const caps = input.caps ?? BRIDGE_CAPS;
  const builtin = input.builtin.flatMap((json, index) => {
    const id =
      isRecord(json) && typeof json.id === "string" ? json.id : `#${index}`;
    const checked = checkFile("builtin", `builtin:${id}`, json, problems);
    return checked ? [checked] : [];
  });
  const user = input.user.flatMap(({ path, json }) => {
    const checked = checkFile("user", path, json, problems);
    return checked ? [checked] : [];
  });
  const builtinIds = new Set(builtin.map((entry) => entry.file.id));
  for (const layer of [builtin, user]) {
    const seen = new Set<string>();
    for (const entry of layer) {
      if (seen.has(entry.file.id))
        problems.push({
          source: entry.source,
          path: entry.path,
          message: `duplicate profile ID "${entry.file.id}", this file overrides the earlier one`,
        });
      seen.add(entry.file.id);
    }
  }

  // Step 1: each replacement resolves with every built-in and user profile in place.
  const everything = overlay(builtin, user);
  const validReplacements: Source[] = [];
  for (const entry of user.filter((e) => builtinIds.has(e.file.id))) {
    const result = finish(entry.file, everything, caps);
    if (result.ok) validReplacements.push(entry);
    else
      problems.push({
        source: "user",
        path: entry.path,
        message: `skipped, built-in kept: ${result.error}`,
      });
  }

  // Step 2: the final ID set.
  const finalSet = overlay(
    builtin,
    validReplacements,
    user.filter((e) => !builtinIds.has(e.file.id)),
  );

  // Step 3: every profile resolves against that set.
  const profiles: Profile[] = [];
  for (const entry of finalSet.values()) {
    const result = finish(entry.file, finalSet, caps);
    if (result.ok) profiles.push(result.profile);
    else
      problems.push({
        source: entry.source,
        path: entry.path,
        message: result.error,
      });
  }

  const byId = new Map(profiles.map((p) => [p.id, p]));
  const registry: ProfileRegistry = {
    get: (id) => byId.get(id),
    all: () => profiles,
    byHash: ({ crc32, sha1 }) =>
      profiles.filter(
        (p) =>
          (sha1 !== null && p.identify?.sha1.includes(sha1.toLowerCase())) ||
          (crc32 !== null && p.identify?.crc32.includes(crc32.toLowerCase())),
      ),
    byHeader: (header) =>
      profiles.filter((p) => {
        const h = p.identify?.header;
        if (!h) return false;
        if (header.platform === "gba") {
          return (
            "gameCode" in h &&
            h.gameCode === header.gameCode &&
            h.revision === header.revision
          );
        }
        return (
          "title" in h &&
          h.title === header.title &&
          h.maskRomVersion === header.maskRomVersion &&
          h.globalChecksum === header.globalChecksum
        );
      }),
  };
  return { registry, problems };
}
