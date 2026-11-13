# Decision report: What is the full Pokémon schema?

Ticket: [What is the full Pokémon schema?](../tickets/016-pokemon-schema.md) (grilling). Branch `t3/full-pokemon-schema-question`, cut from `wayfinder/v2-build-master` at 89bdad9. Date 2026-11-13.

The answer is [the Pokémon schema amendment](./016-pokemon-schema-amendment.md). It resolves spec §17 item 4 and leaves `spec.md` unedited, as the ticket asks.

## How the ticket ran

- The wayfinder-master parent ran the Jev audit, so this child skipped it, as the parent instructed. The parent also replaced the runner's commit question with "commit every time".
- The main thread interviewed the owner in five rounds through AskUserQuestion, with 4, 4, 4, 3 and 4 questions. The owner made every decision below. The main thread wrote each question's options and recommendation.
- Two research subagents on sonnet gathered facts. The API rate limit stopped both. [The CFRU file](./016-pokemon-schema-cfru.md) finished all five facts. [The Gen 1-2 file](./016-pokemon-schema-gen12.md) stopped after its second fact. The amendment's §7 lists every fact that rests on game knowledge or inference.
- The routed `why` skill ran inline, because only source control holds evidence here. Chat, observability, error tracking and analytics have no MCP in this environment, and the Claude Docs MCP has no search. The routed `blast-radius` skill also ran inline. Its results are below.
- One haiku auditor checked the amendment and the glossary change. The audit section below has its verdicts.

## Why the tickets disagreed on Gen 1 shiny

- Direct evidence. v1's Gen 1 reader computed `isShiny` from DVs (`isShinyGen1` in `readers/party/gen1partyreader.lua` at tag `v1-lua`), and v1's API defaulted it to `false` (`network/data_converter.lua`).
- Inferred. The API v2 contract ticket typed `shiny` as a plain boolean with no Gen 1 exception, which matches v1's behaviour. It made `gender` and `hiddenPower` null in Gen 1 without saying why `shiny` differed.
- Direct evidence. The icon loading ticket says Gen 1 has no shiny flag or shiny art. That statement is about sprites.
- Direct evidence. The decoder fixtures ticket mentions Gen 1-2 shininess only to explain why the anonymizer leaves it alone.

## Decisions

| # | Question | Options offered | Choice | Main thread's recommendation |
|---|---|---|---|---|
| 1 | Gen 1 `shiny` | null; Gen 2 DV rule; always false | Gen 2 DV rule, plain boolean | null |
| 2 | Type enum | closed with `mystery`; closed with `???`; closed with `unknown`; open | Closed, 19 values, `mystery` for ??? | Same |
| 3 | `nature` | closed enum; enum plus stat effects; `{ id, name }` reference | Closed lowercase enum | Same |
| 4 | `status` | enum with `toxic`; enum plus sleep turns; enum without `toxic` | Enum with `toxic`, `none` for no condition | Same |
| 5 | Egg fields | `isEgg` plus `eggCycles`; `isEgg` only; nullable `isEgg` | `isEgg` (false in Gen 1) plus `eggCycles`, with an egg's `friendship` and `nickname` null | Same |
| 6 | `ball` | item reference; closed ball enum; raw value | Item reference | Same |
| 7 | `pokerus` | state enum; state plus raw parts; raw parts | State enum | Same |
| 8 | `experience` | total only; total plus level bounds | Total only | Same |
| 9 | Whole field list | approve; flat OT keys; four fixed move slots | Approved: nested `ot`, filled move slots only, one `Move` shape | Same |
| 10 | Extra fields in v2.0 | none; met data; raw identity fields; both | Met data and raw identity fields | None |
| 11 | Hack move data | new `moveData` table; fold into `speciesData`; reference data only | New required `moveData` table | Same |
| 12 | CFRU blank type IDs in battlers | drop them; null `types`; two slots only | Drop them and append a real third type | Same |
| 13 | `met` shape | nested `met`; flat keys; raw game value | Nested `met` with closed `game` and `timeOfDay` enums | Same |
| 14 | Location names | official only; add a hack table now; IDs only | Add a hack `locations` table now | Official only |
| 15 | Raw identity fields | as previewed; language as enum; all raw | Personality and language raw, OT gender enum in `ot`, `ppUps` on each move | Same |
| 16 | Where the `pointer` name kind applies | `locations` only; any name table | `locations` only | Same |
| 17 | Is `locations` required? | required; optional | Required, like the other four name tables | Same |
| 18 | Special met-location IDs | `{ id, name: null }`; fixed names; null location | `{ id, name: null }` | Same |
| 19 | Anything else open? | nothing; something | Nothing else | Same |

The owner departed from the recommendation three times. In decision 1, Gen 1 keeps v1's DV-based shininess. Decision 10 brings met data and the raw identity fields into v2.0. Decision 14 adds a hack location-name table and a `pointer` name kind, which reverses part of spec §5.5's inline-only rule.

The main thread also made these choices:

- It recorded the amendment as an assets file the spec can cite, and the ticket's answer points to it. Earlier tickets on this map wrote the work product first and resolved the ticket afterwards, and this follows that pattern.
- It added "Move data" to `CONTEXT.md` and added types to "Species data", following the domain-modeling skill. "Move data" is a new profile key, status field and validation concept.
- Following the auditor, it marked each fact by source in the amendment: researched, inferred or game knowledge. It also dropped a base-PP bound the owner hadn't approved.

## Audit

- Round 1 returned 16 problems. The main thread fixed 14. They were sourcing labels, a Gen 2 egg `species.id` rule, a `types` rule that wrongly named Gen 3 battle mons, an unapproved base-PP bound, a missing closed enum, a cross-reference, the Korean language ID, the §6.5 wording, the §11.9 wording and the Radical Red outcome. It disputed two with evidence. The owner had approved previews showing the `met.game`, `met.timeOfDay` and `status.game.moveData` values, and the five rounds are on record in this report.
- Round 2 closed 11 problems, and the auditor withdrew the two the main thread disputed. Three stayed open. Some game-knowledge facts were still missing from §7, and the intro had to name the DPE sources. The Gen 2 `const_next` wording was off. A clause about Korean had no source. The main thread fixed all three.
- Round 3 closed the `const_next` wording and the Korean clause. One problem stayed open: §7 still left out some game-knowledge facts, and the intro claimed its list was complete. The main thread applied both fixes the auditor offered. The intro now says that any fact neither research file covers counts as game knowledge, and §7 names the remaining facts.
- Round 4: APPROVE. The auditor checked every inferred fact against the research files and found each one in §7. Its one non-blocking note was to say "game fact" in the intro so the rule doesn't cover design rules. The main thread applied that.

Final verdict: APPROVE after four rounds.

## Blast radius

**What it does.** The amendment defines the `Pokemon` and `Move` types and seven new closed enums. It adds two required hack-profile keys, `moveData` and `nameTables.locations`, a `pointer` name kind for locations, and new reference data. It also changes how Gen 2 decoders read box and party species lists.

**The one fact it's safe because of.** No tracked code defines or consumes a Pokémon schema yet. The ten TypeScript files under `api/`, `server/`, `internal/`, `viewer/` and `bridges/` are placeholders, an API client stub and a version constant. A search of them for `pokemon`, `species`, `shiny`, `nature` and `status` matched only the package name in an import path. That reached step 3, a search that finds nothing.

**Proof at step 4.** The main thread extracted the amendment's TypeScript block and added sample Gen 1 and Gen 3 egg values, an empty `Type[]` and exhaustive switches over `Type` and `Status`. It compiled the file with the repo's pinned TypeScript 7.0.2 (`tsc --ignoreConfig --noEmit --strict`), which exited 0. A negative check assigned `"unknown"` to `Type` and `"healthy"` to `Status`. Both failed with TS2322, so the enums are closed. A count found 19 type values and 25 natures.

**Risks.**

- Gen 2 eggs need the species-list byte, which spec §6.5 tells Gen 1-2 decoders to ignore. A decoder built from §6.5 alone would report a Gen 2 egg as a hatched mon. The amendment's §6 amends §6.5. Likelihood is high if the spec edit misses it, and the cost is wrong egg data in Gen 2.
- Sibling tickets in this batch decide shapes that must match. [What shapes do `player` and `bag` have?](../tickets/017-player-and-bag-shapes.md) should name the player's trainer fields to match `ot` (`name`, `id`, `secretId`, `gender`). [What else does the profile schema hold?](../tickets/018-profile-schema-remainder.md) has to carry `moveData` and `nameTables.locations`. [Where does reference data come from?](../tickets/019-reference-data-source.md) gains species types, move type and base PP, and location names. [How is the species-info layout confirmed?](../tickets/023-cfru-species-layout-and-signature.md) gets the CFRU type offsets from source, while the 0x1C stride stays inferred.
- The CFRU ball-to-item mapping depends on the ROM item table. If a hack's item table fails to load, every CFRU `ball` is null.
- Decision 14 makes locations the first `pointer` name table. Its strings are a second read phase, so the hack-profile loading code in spec §5.5 grows.

**Cleared.**

- The published API: nothing is published yet, and v2.0 hasn't shipped.
- The icon routes: `mystery` is URL- and filename-safe, and §11.9 already maps ??? to PokeAPI type 10001.
- The fixture anonymizer: it rewrites OT names and trainer IDs only. `personality` keeps Gen 3 shininess intact because the anonymizer preserves the trainer-ID XOR.

**Before you merge.** The spec edit that applies this amendment should carry the type check above into the API package as a real test. One test should compile the exhaustive switches. Another should fail when a closed enum gains a value, which spec §7.11 already requires.

## Surfaced

- "Does Radical Red store a nature apart from personality % 25?" is a research ticket with no blockers. The `nature` rule assumes no override, and the Radical Red profile has to confirm that before it ships.

## Open gaps

The amendment's §7 lists them: the unfinished Gen 1-2 research, the game-knowledge facts, the inferred CFRU and Gen 2 facts, Radical Red's nature storage and the 0x1C species-info stride.
