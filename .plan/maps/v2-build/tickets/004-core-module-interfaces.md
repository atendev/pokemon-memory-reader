---
type: grilling
blocked_by: [001, 002, 013, 016]
claimed_by: wayfinder-master v2-build-master-1794582779
claimed_at: 2026-11-13T15:12:59Z
---

# Core module interfaces

## Question

What are the TypeScript types and module boundaries every build slice will code against? Use the `architect` and `codebase-design` skills alongside grilling and domain-modeling.

Sketch signatures, not implementations, for:

- the `Adapter` interface: probing, connection lifecycle, the batched multi-range read in memory domains, ROM access, and the hello and game events;
- the `SliceAdapter` used by fixtures;
- the game profile Zod schema's module and the profile registry;
- the `Decoder` contract per data format, plus the shared byte-reading helpers, and how a resource declares the reads it needs so the read loop can batch them;
- reference data modules;
- the resource registry linking decoders to the API package's schemas;
- where the read loop, identification and the Hono app sit in `server/`.

Record the result as a code sketch in `assets/` that later tickets copy from. The tracer tickets should fill in this shape, not invent it.

## Answer

The answer is [the interfaces doc](../assets/004-core-module-interfaces.md) and [the code sketch](../assets/004-core-module-interfaces.sketch.ts). Build tickets cite them as "interfaces 004" and copy each section into the file it names. A ticket that needs a different signature reopens the sketch and doesn't change it inside a build slice. The owner decided the shape in three grilling rounds, a final check and one follow-up on 2026-11-13 and 2026-11-14. [The decision report](../assets/004-core-module-interfaces-report.md) lists each decision.

- Modules sit by concern in `server/src`. The read loop owns the one request slot and drives identification, ROM-table loads and each cycle as a `ReadJob`. The Hono app sees only its `Resources` facade.
- Each configured emulator has one long-lived adapter with `probe`, `hold` and `live` modes, which a selector sets. The read loop and fixture tests use the read-side `Adapter`. It reports a state snapshot with a `gameEpoch` and returns batched reads with a result per range.
- Decoders declare named regions and get back exactly those slices as `Bytes`, plus one per-game lookup for names, species data and move data. They return ok or fail results and never see the adapter.
- A resource registry keyed by every API topic links decoder parts to `ResourceMap`, and one battle tracker adds `battleId`, `revealed` and `lastBattle`.
- Each data format owns its profile address and constant blocks. `dataFormat` is `gen1`, `gen2`, `gen3` or `cfru`. `language` is a closed set of ISO 639-1 codes that covers every official release.
- The codec and strict wire schemas sit in `server/src/adapter/bridge/`, and `Domain` lives beside the address map in `internal/`. A shared memory adapter provides the SliceAdapter and the `--from-dump` adapter.
- Reference data is keyed by data format and language, with location names chosen by `artVersion` (ticket 019). Profiles are checked against the bridge caps at load (ticket 026).
- CONTEXT.md gains Region, and Slice now covers live reads.

Why: one owner of the request slot keeps the ordering rules of spec §8.2 and §8.3 in one module, and jobs and decoders stay pure and testable on synthetic buffers. Named regions and the `satisfies` registry make an undeclared read or a missing topic fail typecheck.

Excluded: a separate session module, folders by data format, a stateless probe, decoders reading through a memory view, decoders choosing their own name sources, per-format battle state, and one central profile schema with string-keyed addresses. Manual-pick keys and the header timer stay with ticket 014, the unset status fields with ticket 020, and the viewer's routes with ticket 021.

Checks: the sketch typechecks under the repo's strict tsconfig, and four expected type errors fire. The haiku audit approved in round 5. CI run 43580587732 passed on ef0e213.
