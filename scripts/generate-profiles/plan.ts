import { buildProfile, renderIndex, renderProfile } from "./build";
import type { HeldBackDefinition, ProfileDefinition } from "./definition";
import {
  type LedgerEntry,
  ledgerProblems,
  rateSignatureEvidence,
  renderEvidenceNotes,
} from "./evidence";
import { resolveHashes } from "./hashes";
import { describeHoldBack } from "./holdback";
import { checkSpeciesInfoStride } from "./stride";
import type { SymbolInfo } from "./sym";

type NoIntro = ReadonlyMap<string, ReadonlySet<string>>;

/** The name of the generated release-notes section, next to the profiles. The release gate reads it. */
export const NOTES_FILE = "SIGNATURE-EVIDENCE.md";

export interface GeneratorInput {
  readonly built: ReadonlyArray<{
    readonly definition: ProfileDefinition;
    readonly pretSha1s: readonly string[];
    readonly noIntro: NoIntro;
    readonly symbols: ReadonlyMap<string, SymbolInfo>;
    /** Local symbols by name, for the signature anchors. Absent when no definition has an anchor. */
    readonly locals?: ReadonlyMap<string, readonly SymbolInfo[]>;
  }>;
  readonly held: ReadonlyArray<{
    readonly held: HeldBackDefinition;
    readonly pretSha1s: readonly string[];
    readonly noIntro: NoIntro;
  }>;
  readonly ledger: readonly LedgerEntry[];
}

/**
 * Everything `generate:profiles` writes, as a pure function of what it fetched. A held-back revision
 * adds a message and no file. A built revision whose chain is broken still fails the run.
 */
export function planGeneration(input: GeneratorInput): {
  files: Map<string, string>;
  messages: string[];
} {
  const messages = input.held.map(
    (h) => describeHoldBack(h.held, h.pretSha1s, h.noIntro).message,
  );
  for (const { definition, symbols } of input.built) {
    checkSpeciesInfoStride(
      definition.source.repo,
      symbols,
      definition.speciesInfo,
    );
  }
  const resolved = input.built.map((b) => ({
    ...b,
    hashes: resolveHashes(b.pretSha1s, b.noIntro, {
      pret: `${b.definition.source.repo} ${b.definition.sha1.file}`,
      noIntro: b.definition.noIntro.file,
    }),
  }));
  const rated = resolved.map((r) => ({
    id: r.definition.id,
    repo: r.definition.source.repo,
    sha1: r.hashes.sha1,
  }));
  const problems = ledgerProblems(rated, input.ledger);
  if (problems.length > 0) throw new Error(problems.join("\n"));
  const levels = rateSignatureEvidence(rated, input.ledger);

  const files = new Map<string, string>();
  const noted = [];
  for (const { definition, hashes, symbols, locals } of resolved) {
    const level = levels.get(definition.id);
    if (!level) throw new Error(`no evidence level for ${definition.id}`);
    files.set(
      `${definition.id}.json`,
      renderProfile(buildProfile(definition, symbols, hashes, level, locals)),
    );
    noted.push({ id: definition.id, name: definition.name, level });
  }
  files.set("index.ts", renderIndex(resolved.map((r) => r.definition.id)));
  files.set(NOTES_FILE, renderEvidenceNotes(noted));
  return { files, messages };
}
