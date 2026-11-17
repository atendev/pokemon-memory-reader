---
type: grilling
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794843940
claimed_at: 2026-11-16T16:21:08Z
---

# May an open enum lose a value within `/api/v2`?

## Question

[Is `battle.modes` an open enum?](./015-battle-modes-enum.md) made `battle.modes` an open enum that only ever gains values. Decide whether that append-only rule holds for every open enum in `/api/v2`, or whether some open enum may drop or rename a value without a major version, and if so under which release rule. See [the 015 amendment](../assets/015-battle-modes-enum.md).

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

No. Every open enum in `/api/v2` is append-only: error `code`, `dataFormat`, adapter `id`, topic names, `status.adapter.problem`, `status.adapter.bridge.bridge` and `battle.modes`. A name that has shipped in a stable release is never removed from the known union or the docs, never renamed, and never given another meaning. Removal and renaming wait for `/api/v3`. Names that have only shipped in prereleases may still change before their stable release.

The server may stop emitting a name, which retires it, only when the thing the name stands for no longer exists in the program. Topics are never retired. A retired name stays listed with `retiredIn` and is never reused. Adding a name is a minor release of the app and the package. Retiring one is an app minor with a "Retired" changelog entry, plus a package minor that sets `retiredIn`. A meaning record per enum and one append-only test against a committed stable baseline enforce the rule.

Excluded: per-enum removal in a minor release, removal after a deprecation period, rename aliases, retirement with only a changelog note, and Bun snapshots or git tags as the baseline.

Decided in auto mode. [Amendment](../assets/035-open-enum-value-removal.md), [decision report](../assets/035-open-enum-value-removal-report.md). Council APPROVE in round 4 (claude 8, gemini 10, gpt 9). CI green on 01628c7.
