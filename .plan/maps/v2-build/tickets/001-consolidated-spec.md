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
