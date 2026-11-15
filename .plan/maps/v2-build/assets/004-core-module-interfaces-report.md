# Decision report: Core module interfaces

Ticket: [Core module interfaces](../tickets/004-core-module-interfaces.md). The answer is [the interfaces doc](./004-core-module-interfaces.md) and [the code sketch](./004-core-module-interfaces.sketch.ts), cited as "interfaces 004".

This was a grilling ticket. The owner answered three rounds of questions, a final check and one follow-up from the audit, in this thread on 2026-11-13 and 2026-11-14. The design sub-agent wrote the sketch and checked that it typechecks. A haiku auditor reviewed it.

## Decisions

### 1. Where do the core modules sit, and who owns the one request slot?

- Options: folders by concern with the read loop owning the slot (recommended); folders by concern with a separate session module and a FIFO adapter queue; folders by data format.
- Choice: by concern. The read loop owns the slot and drives identification, ROM-table loads and cycles as `ReadJob`s. The Hono app sees only `Resources`.
- Made by: the owner, round 1. The audit approved the whole change in round 5 (see Checks).

### 2. How do probing and the live connection relate?

- Options: one long-lived adapter per emulator with modes set by a selector (recommended), or a stateless `probe()` that hands its socket to a separate live adapter.
- Choice: one adapter, with modes. The read loop and tests depend on `Adapter`, and the selector on `ManagedAdapter`.
- Made by: the owner, round 1. The third mode, `hold`, is decision 13.

### 3. How does a decoder declare and receive its bytes?

- Options: named regions in and a value out (recommended), or declared regions plus a guarded memory view.
- Choice: named regions. `decode` gets a `Bytes` per declared name and the `DecodeContext`, never the adapter.
- Made by: the owner, round 1.

### 4. How do decoders get names, species data and move data?

- Options: one per-game lookup (recommended), or separate reference data and ROM tables per decoder.
- Choice: one lookup, built by the `gameLookups` job. It also feeds `status.game.names`, `speciesData` and `moveData`.
- Made by: the owner, round 1.

### 5. How does an adapter report hello, game, problem and connection changes?

- Options: a state snapshot with subscribe and a `gameEpoch` counter (recommended), or a typed event emitter.
- Choice: state snapshot.
- Made by: the owner, round 2.

### 6. How does the resource registry link decoders to the API package, and where do program-tracked battle fields live?

- Options: a registry keyed by every topic with `satisfies`, plus a format-agnostic tracker (recommended), or decoders that keep their own state.
- Choice: registry plus tracker. One `battleTracker` adds `battleId`, `revealed` and `lastBattle` for every format.
- Made by: the owner, round 2.

### 7. What shape do the byte helpers take?

- Options: a `Bytes` class over a `DataView` (recommended), plain functions, or a declarative struct reader.
- Choice: `Bytes`. Out-of-range reads throw as layout bugs, and layouts stay as `as const` offset tables.
- Made by: the owner, round 2.

### 8. Where do the per-format profile pieces live?

- Options: each format owns its `addresses` and `constants` Zod blocks (recommended), or one central schema with string-keyed addresses.
- Choice: each format owns its blocks, and `profile/schema.ts` composes the full schema as a union on `dataFormat`.
- Made by: the owner, round 2.

### 9. Which strings name data formats and languages?

- Options: `gen1`, `gen2`, `gen3`, `cfru` with ISO 639-1 codes (recommended); the same ids with language words; or a closed enum of only the shipped languages.
- Choice: `"gen1" | "gen2" | "gen3" | "cfru"` and `"ja" | "en" | "fr" | "de" | "it" | "es" | "ko"`, a closed set covering every official Gen 1-3 release.
- Made by: the owner, round 3.

### 10. What do the code and glossary call ranges, regions and slices?

- Options: range, region and slice (recommended), or "declared read" with "region" kept avoided.
- Choice: range, region and slice. CONTEXT.md gains Region, "Region" leaves the memory-domain avoid list, and Slice now covers live reads too.
- Made by: the owner, round 3.

### 11. Where do the wire codec and the cross-language tests sit?

- Options: codec and tests in `server/` (recommended); codec in `server/` with tests in `bridges/`; or the codec in `internal/`, which would amend spec §2.
- Choice: `server/src/adapter/bridge/` holds the codec and strict messages. `Domain` names live in `internal/` beside the address map, and tests run the Lua core from `bridges/` by path.
- Made by: the owner, round 3.

### 12. Where does the SliceAdapter live, and how do fixture tests run?

- Options: a shared memory adapter module with a `runFixture` harness (recommended), or a test-only SliceAdapter with a separate dump adapter.
- Choice: `server/src/adapter/memory.ts` exports `createSliceAdapter` and `createDumpAdapter`. `runFixture` takes the profile from the fixture metadata and treats ROM tables as missing.
- Made by: the owner, round 3.

### 13. How does the selector keep a protocol_mismatch connection idle?

- Options: a third mode, `hold` (recommended), or two modes plus a keep-open flag.
- Choice: `hold`. In probe mode the adapter closes after the hello unless the selector sets `live` or `hold` inside its subscribe listener.
- Made by: the owner, a follow-up question after audit round 1. The owner's answer, verbatim: "Third mode "hold" (Recommended)".

### 14. Remaining defaults

- Proposed by the main thread and confirmed by the owner in the final check: per-range read outcomes, ok/fail decode results, an injected clock, optional decoder parts, an immutable profile registry, identification as a planner plus a pure `identify()`, a pure `buildStatus`, and dev scripts in root `scripts/`.
- In the final check on 2026-11-14, the owner changed one default and said they had decided it in ticket 019. Reference data is keyed by data format and language, not generation, and location names come from one table per game family chosen by `artVersion`.
- The owner pointed to ticket 026, which already decides the batch rule. Profiles are bounded at load against the bridge caps, the loop never splits a batch, and the RetroArch adapter cuts at descriptor boundaries and 16 KiB. The sketch follows it.

### 15. Audit fixes

- Round 1 returned 15 objections. The main thread fixed 12 in the sketch and the doc. These were a pure `identify()`, adapter-list and switch methods on `Resources`, a generic `Profile<F>` derived from Zod, the bridge merge gap in `BRIDGE_CAPS` with pointer regions counted at full length, a narrowable `box()` result, full tracker state, the `resourceSchemas` link, labelled Gen 1-2 and constants placeholders, `provenance`, the open-enum comment, a static `bits` helper and the decode wording.
- The `hold` objection went to the owner (decision 13). The missing report link resolves with this file.
- Round 2 reopened eight. The main thread added pick writes to `ManualPicks` and `Resources`, the synchronous-listener rule, a per-topic `resourceSchemas` type, a `Result` from `decodeMons`, `provenance` in the file schema and a separate open `ApiErrorCode`. CONTEXT.md now keys reference data by data format and language, and says art version picks the location-name family, per the owner's final check on 2026-11-14. If ticket 019's branch words those lines differently, the master keeps 019's text.
- Recorded, not changed: CONTEXT.md lists "topic" as a word to avoid for Resource, while spec §7.1 and §10 call a resource's name on the SSE stream a topic (`TOPICS`, `?topics=`). The sketch follows the spec, and the owner should settle the glossary entry.

## Checks

- **Typecheck.** `out/sketch-check/` typechecks the sketch with a usage file under the root tsconfig (TypeScript 7.0.2, strict, `noUncheckedIndexedAccess`), and `tsc` exits 0. Four `@ts-expect-error` lines fire: an undeclared region name, a registry missing a topic, party on the box request, and battle without its tracker. That proves the fact the design depends on. Named regions and the registry's `satisfies` mapping catch those mistakes at typecheck.
- **Not checked.** zod is not installed yet, so the Zod blocks in the interfaces doc are unchecked. Tickets 005, 006 and 012 typecheck them when they add zod.
- **Blast radius.** No production code changed, and CI checks nothing under `.plan/`, because Biome ignores it and each workspace tsconfig includes only `src`. Tickets 005, 006, 008 and 012 copy from the sketch, and 007, 009 and 010 build on it.
- **Audit.** The haiku auditor approved in round 5 of 5. Round 1 raised 15 objections, and rounds 2, 3 and 4 left 8, 6 and 3 open. The main thread fixed each, apart from the open-question notes in decision 15.

## Process notes

- The parent session ran the Jev audit. This thread skipped it, as instructed.
- The architect skill's arena runners and the `how` and `interrogate` skills are not installed. The main thread compared whole-shape alternatives itself and put each choice to the owner.
- The `why` skill's investigators were skipped. The rationale for every constraint is in the repo's `.plan/` spec and resolved tickets. This project has no matching MCP for a tracker, chat, docs, observability, errors or analytics.
- The master's instructions replace the runner's commit gate. This thread commits without asking, and the master merges.
