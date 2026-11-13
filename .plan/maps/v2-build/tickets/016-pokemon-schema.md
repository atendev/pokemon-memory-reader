---
type: grilling
blocked_by: []
assets: [../assets/016-pokemon-schema-amendment.md, ../assets/016-pokemon-schema-report.md, ../assets/016-pokemon-schema-cfru.md, ../assets/016-pokemon-schema-gen12.md]
claimed_by: wayfinder-master v2-build-master-1794555906
claimed_at: 2026-11-13T08:17:58Z
---

# What is the full Pokémon schema?

## Question

Spec §17 item 4. Settle every Pokémon field name and type (egg marker, ball, experience, friendship, Pokérus, `types`, move `pp`, `maxPp` and type, status condition, nature), the type enum including ??? and hack types, Gen 1 `shiny`, and where hack profiles get species types and move data.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

The full schema is [the Pokémon schema amendment](../assets/016-pokemon-schema-amendment.md). Spec §7.5, §6.3, §7.8 and the other sections it lists cite it as "amendment 016 §N". The owner decided it in a five-round grilling, and [the decision report](../assets/016-pokemon-schema-report.md) records each decision and the audit.

- Gen 1 `shiny` is a plain boolean computed with the Gen 2 DV rule, as v1 did.
- `Type` is a closed enum of 19 values, with `mystery` for ??? and `fairy` for CFRU. An unmapped type ID makes `types` null, and CFRU battlers drop blank type IDs.
- `nature` is a closed lowercase enum. `status` is a closed enum with `none` and `toxic`.
- Eggs carry `isEgg` and `eggCycles`, and an egg's `friendship` and `nickname` are null. `ball` is an item reference, `pokerus` is a state enum and `experience` is the total.
- Every move has `type`, `pp`, `maxPp` and `ppUps`. v2.0 also carries `met`, `personality`, `language` and the OT's gender.
- Hack profiles read species types from `speciesData.info`. They add a required `moveData` table and a required `locations` name table, and only `locations` may use a new `pointer` name kind.

The answers are the owner's. The facts come from the CFRU and Gen 1-2 research files, and the amendment's §7 lists the facts still to confirm.

Excluded: markings, contest stats and ribbons wait for v2.x. Whether Radical Red stores a nature override is unconfirmed and goes to its own research ticket. `spec.md` is unedited.
