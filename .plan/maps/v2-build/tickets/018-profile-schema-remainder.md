---
type: grilling
blocked_by: []
assets: [../assets/018-profile-schema-remainder.md, ../assets/018-profile-schema-remainder-report.md]
claimed_by: wayfinder-master v2-build-master-1794555906
claimed_at: 2026-11-13T08:17:58Z
---

# What else does the profile schema hold?

## Question

Spec §17 item 6. Decide the field behind `status.game.name`, which fields `extends` inherits besides `kind`, the keys for the optional trainer ROM tables, and how a hack profile with an unverified storage layout turns `features.boxes` off.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

The owner decided this in a grilling interview on 2026-11-13. The full amendment, which spec §5.1, §5.2, §7.4, §7.8 and §12.8 will cite, is in [018-profile-schema-remainder.md](../assets/018-profile-schema-remainder.md).

- Every profile requires its own free-text `name`, which feeds `status.game.name`. It is never inherited.
- `extends` inherits everything except `id`, `kind`, `name`, `identify`, `fixture`, provenance and `features`. Addresses, constants, `nameTables`, `speciesData` and `trainerTables` merge one level deep, and a `null` key removes an optional inherited key. Chains are allowed, and an official profile can't have a hack in its chain. Parents resolve after user replacements apply. The program skips a broken replacement and keeps the built-in.
- There are two Zod schemas: a file schema, which also produces the exported JSON Schema, and a full schema for the resolved profile. `fixture` is optional on user profiles, where omission means `"none"`.
- `trainerTables: { trainers?, classNames?, money? }`, each `{ base, count }`. An ID at or beyond `count` nulls the dependent fields.
- `features: { boxes?: boolean }` defaults to true on official profiles and false on hacks. A test fails when a built-in hack sets it true without a box fixture. User hack profiles may opt in.

Why: identity and coverage stay with the ROM revision they describe, while layout data is shared. Excluded: an optional or header-derived name, whitelist inheritance, inheriting everything, trainer tables with no count, and a boxes flag derived only from fixtures.
