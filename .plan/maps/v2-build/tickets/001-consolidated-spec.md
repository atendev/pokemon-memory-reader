---
type: task
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794555906
claimed_at: 2026-11-13T07:45:06Z
---

# Consolidated v2 spec

## Question

Write `.plan/maps/v2-rebuild/spec.md`: one implementation-ready spec that folds the 24 resolved v2-rebuild tickets and their assets into sections by subsystem. Build tickets cite these sections instead of rereading the tickets.

Work AFK. Fold every "Amended by" note into the section it changes. For example, [Expansion hack data format](../../v2-rebuild/tickets/023-expansion-hack-data-format.md) drops the `pointer` name kind, and [Hack species data](../../v2-rebuild/tickets/024-hack-species-data.md) removes the blanket `null` fallback. Each section links the tickets it comes from. Use the terms in `/CONTEXT.md`.

Suggested sections: repo layout and tooling; adapters and memory domains; bridge wire protocol and bridge delivery; game profiles, the generator and identification; data formats and decoders (Gen 1, Gen 2, Gen 3, CFRU) with reference data, name tables and species data; resources and the API v2 contract (REST, SSE, status, errors); the read loop and latency budget; config, the data folder and settings; the API package; the viewer and icons; fixtures and the coverage gate; release pipeline and CI; licensing.

## Acceptance

- Every decision in the v2-rebuild Decisions-so-far list maps to a section, and every section links its source tickets.
- A closing "Conflicts and gaps" list names every contradiction between tickets and every point the spec leaves undecided that a build slice needs. Each item is a candidate grilling ticket and is reported back as a surfaced ticket. Do not resolve them in the spec.
- No new decisions appear in the spec.

## Answer

[`../../v2-rebuild/spec.md`](../../v2-rebuild/spec.md) is the consolidated spec. It folds the 24 resolved v2-rebuild tickets and every "Amended by" note into 14 numbered subsystem sections. Build tickets cite them as "spec §N.M". It adds implementation spikes with their decided fallbacks (§15), a decision index that maps all 24 Decisions-so-far lines to sections (§16), and a closing Conflicts and gaps list (§17).

- Each section opens with links to its source tickets. Research assets are linked, and only the facts a builder needs are folded in, such as RetroArch's core memory maps.
- The spec adds no decisions. Where tickets disagree and a section must show a value, it shows the deciding ticket's text, marks the point and links to §17.
- §17 holds 15 open items, each a candidate grilling ticket with a "Needed by" line: profile address notation, ROM keys and re-identification, `battle.modes` openness, the full Pokémon schema, `player` and `bag` shapes, profile schema details, the reference data source, unset status and error details, viewer control routes, signatures for unowned revisions, species-info layout and the CFRU signature, prereleases with main untouched, text mismatches, RetroArch probing and oversize batches, and the license allowlist.
- A haiku auditor approved in round 5 of 5. The [decision report](../assets/001-consolidated-spec-report.md) records each choice.

Excluded: folding whole research assets, resolving any conflict inside the spec, and folding the build map's own decisions into v2-rebuild sections. The build map's Emulator Lua runtimes decision is cited from §4.9 and §13.2.
