# Decision report: What else does the profile schema hold?

Ticket: [018](../tickets/018-profile-schema-remainder.md), a grilling ticket for spec §17 item 6. The main thread interviewed the owner in this thread over three rounds of questions and one confirmation. The amendment is in [018-profile-schema-remainder.md](./018-profile-schema-remainder.md).

The main thread asked every question and gave every recommendation. The owner made every decision. A haiku auditor checked the write-up.

## Round 1

| Question | Options | Choice | Decided by |
|---|---|---|---|
| What feeds `status.game.name`? | A required `name` that is never inherited; an optional `name` that falls back to the profile ID; the ROM header title | A required `name`, never inherited (recommended) | Owner |
| Which fields does `extends` inherit? | Everything except identity fields; a whitelist only; everything | Everything except `id`, `kind`, `name`, `identify`, `fixture`, provenance and `features` (recommended) | Owner |
| What key and shape hold the trainer ROM tables? | `trainerTables` with `{ base, count }` entries; `trainerTables` with addresses only; symbols in `addresses` | `trainerTables: { trainers?, classNames?, money? }`, each `{ base, count }` (recommended) | Owner |
| How does a hack with an unverified box layout turn `features.boxes` off? | A field plus a fixture test; derived from fixtures only; a field with no test | Optional `features.boxes`, defaulting by `kind`, plus a test for built-in hacks (recommended) | Owner |

## Round 2

| Question | Options | Choice | Decided by |
|---|---|---|---|
| Which parent does a child inherit from when the user replaced it? | The replacement; built-in parents only | The replacement (recommended) | Owner |
| Do table blocks merge per key? | Per key for `nameTables`, `speciesData` and `trainerTables`; replaced whole | Per key, one level deep (recommended) | Owner |
| When is the schema checked? | A file schema plus a resolved-profile schema; the resolved profile only | Both schemas, with JSON Schema exported from the file schema (recommended) | Owner |

The owner then confirmed the summary of rounds 1 and 2.

## Audit round 1

The auditor returned 17 problems and no APPROVE. Fourteen were wording fixes or clarifications that follow from decisions already made, and the main thread fixed them. Examples: the trainer `count` bindings, a definition of "box fixture", the `artVersion` rationale, cycle error text, the explicit §7.4 and §12.8 override for user profiles, the required fields on root profiles, and the Excluded wording. Four findings needed new decisions, so they went to the owner as round 3.

## Round 3

| Question | Options | Choice | Decided by |
|---|---|---|---|
| Can a child remove an inherited key? | `null` removes it; no removal | `null` removes an optional key (recommended) | Owner |
| What loads when a user replacement fails validation? | Skip it and keep the built-in; drop the ID | Skip it, log the path, keep the built-in (recommended) | Owner |
| Can an official profile extend a hack? | Forbid it; allow it | Forbid a hack anywhere in an official profile's chain (recommended) | Owner |
| Is `fixture` required on user profiles? | Optional, meaning `"none"`; required everywhere | Optional on user profiles, required on built-in profiles (recommended) | Owner |

## Audit rounds 2 to 5

All of these are main-thread wording fixes. None needed an owner decision.

- **Round 2.** The auditor marked all 17 round 1 findings resolved and raised six new points. A three-step load order now covers a user replacement whose chain loops back to it. Replacements resolve first, the program skips a broken one, and everything else resolves after that. A profile with no `identify` loads only by manual pick. The removable keys are named. "Box fixture" now means a promoted `.expected.json` golden (§12.5). The spec update list gained its missing entries. The main thread checked the cross-references against spec.md.
- **Round 3.** The no-`identify` sentence now names signature matching too. The amendment states the rules for nulling `nameTables` on official and hack profiles, and cites `scripts/find-rom-tables` as §5.5.
- **Round 4.** The main thread dropped the per-key claim about official `nameTables`, because the spec makes only the whole block optional. Item 4 no longer says the script finds trainer-table values, since §5.5 has it print only name and species fragments.
- **Round 5.** APPROVE.

## Audit verdict

APPROVE in round 5 of 5, from one haiku auditor kept for every round.
