# Decision report: Expansion hack data format

Ticket: [Expansion hack data format](../tickets/023-expansion-hack-data-format.md), a grilling ticket on the v2-rebuild map. Branch `t3/expansion-hack-data-format`. The main thread ran the interview with the user through AskUserQuestion, with the grilling and domain-modeling skills. A sonnet subagent gathered the facts into [the research asset](./023-expansion-hack-data-format.md). A haiku subagent audited the resolution.

## Workflow notes

- The repo has no `workflow.md`, `AGENTS.md` or project `CLAUDE.md`, so the wayfinder-runner rules applied, as changed by the master's brief.
- Skipped gates: the Jev audit, which the parent session ran, and the step 5 commit question, which the master's brief replaced with "commit every time". Nothing merges to `main` from this branch.
- CI: the repo has no `.github/workflows`, no remote `wayfinder/*` branch, and one PR in its history, so the branch was pushed without a PR.
- After round 2 stopped the run, the master relayed the owner's answers to the two open user decisions and asked for one more audit round, then a commit either way. With no CI, the Answer is now in the ticket.

## Facts the questions rested on

From the research asset, which cites a source for each:

- Expansion ROMs from 1.7.0 carry an `RHHEXP` block with the expansion version, and from 1.8.0 table counts too. The block holds no RAM address, stride or field offset. Builds before 1.13.0 can lose it to `--gc-sections`.
- The mon struct keeps vanilla's 80 and 100 bytes, encryption, 24 substruct orders and checksum. Its bitfields differ from vanilla in every expansion release, with a large change in 1.8.0 and a small one in 1.9.0. They stay the same from 1.9.0 through 1.17.2.
- Battle state changed layout or encoding in 1.8.0, 1.9.0, 1.11.0, 1.13.0, 1.16.0 and 1.17.0.
- Neither expansion nor any hack checked publishes `.sym` or `.map` files.
- Run & Bun, by third-party evidence, predates the block and has its own bits. Emerald Imperium and Lazarus have no public source. Emerald Rogue, Elite Redux and Inclement Emerald have public source, each with its own mon layout.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|---|---|---|---|---|
| 1 | Does v2.0 decode expansion hacks? | Defer, detect and refuse; give named hacks their own data formats; one expansion format for the 1.9.0+ mon layout; layouts declared in profiles | Defer, detect and refuse (main thread's recommendation) | User | No APPROVE in round 3, wording items only |
| 2 | How do official Gen 3 profiles guard the no-hash header fallback? | Vanilla signature; check only for `RHHEXP`; keep the current rule | Vanilla signature (recommended) | User | No APPROVE in round 3, wording items only |
| 3 | Which profiles may a ROM with the block load? | Only expansion formats; any, with a warning; any, with no check | Only expansion formats, so none in v2.0 (recommended) | User | No APPROVE in round 3, wording items only |
| 4 | Does the API report the expansion version? | `status.rom.expansion`; log only | `status.rom.expansion: { version, tagged } \| null` (recommended) | User | No APPROVE in round 3, wording items only |
| 5 | What happens on a manual pick of an official profile after a failed signature, with no block? | Allow with a warning; allow silently; refuse | Allow with a warning (recommended) | User | No APPROVE in round 3, wording items only |
| 6 | Keep the `pointer` name kind from ROM hack name tables? | Drop it; keep it unused | Drop it (recommended) | User | No APPROVE in round 3, wording items only |
| 7 | How do vanilla-layout decomp hacks get RAM addresses? | Generator reads a hack's `.sym`; also an address finder; hand entry only | Generator reads a hack's `.sym` (recommended) | User | No APPROVE in round 3, wording items only |
| 8 | How does status carry the signature result? | `status.game.signature` enum; an open `warnings` list | `status.game.signature` (recommended) | User | No APPROVE in round 3, wording items only |
| 9 | Does the eight-point summary match the user's understanding? | Yes; change something | Yes | User | n/a |
| 10 | Where does the program look for the block? | A fixed offset; a scan | Scan `0x08000100`-`0x08000400` in 2-byte steps, because the derived offset (`0x204`) and third-party reports (`0x1FC`, `0x200`) disagree | Main thread | No APPROVE in round 3, wording items only |
| 11 | What does an unreadable signature mean for identification? | Failed; skipped | Failed, as in the confirmed summary, since a wrong profile decodes garbage | Main thread | No APPROVE in round 3, wording items only |
| 12 | What does `status.game.signature` report when the adapter can't read ROM? | `"mismatch"`; a new `"unchecked"`; `null` | `"unchecked"`, so the viewer can warn as the confirmed summary requires without claiming the tables moved | Implementer, after audit objections 1 and 9 | No APPROVE in round 3, wording items only |
| 13 | Is the signature checked after an exact hash match? | Yes, only reported; no | Checked on every match path, and only reported after a hash match | Implementer, after audit objection 9 | No APPROVE in round 3, wording items only |
| 14 | How far does the refusal reach? | Every expansion hack; ROMs where the scan finds the block | ROMs where the scan finds the block. Without ROM reads the program can't detect it, and the pick loads with `"unchecked"` | Implementer, after audit objection 1 | No APPROVE in round 3, wording items only |
| 15 | Does the decoder registry get an "accepts expansion" flag? | A new flag; no flag | No flag. In v2.0 no data format accepts expansion hacks, and a later expansion format is the only kind such a ROM may load | Implementer, after audit objection 7 | No APPROVE in round 3, wording items only |
| 16 | Are `.map` files accepted beside `.sym`? | Accept both; `.sym` only | `.sym` only, since anyone who can build the hack can run `make syms` | Implementer, after audit objection 8 | No APPROVE in round 3, wording items only |
| 17 | Where do expansion strides and field offsets come from? | Decide now; leave to the later map | The later map decides, along with one format or several. v2.0 formats keep layouts in decoder code | Implementer, after audit objections 8 and 14 | No APPROVE in round 3, wording items only |
| 18 | How are the signature values checked? | Trust pret symbols; also test against ROMs | The generator writes them from pret symbols, and `test:local` runs against the owner's retail and hack ROMs confirm them before they ship | Implementer, after audit objections 2 and 3 | No APPROVE in round 3, wording items only |
| 19 | What do `gender`, `ability`, boxed `level` and `species.dex` return for hack profiles? | Decide here; a new ticket | A new ticket, Hack species data, which also covers CFRU | Main thread, with audit objection 10 | No APPROVE in round 3, wording items only |
| 20 | What does the glossary call these ROMs? | Expansion hack; RHH hack; expansion build | "Expansion hack", avoiding "RHH hack" and "expansion build". The entry defines the term only | Main thread, revised after audit objections 7 and 13 | No APPROVE in round 3, wording items only |
| 21 | Do header plus signature matches keep auto-loading? (round 2 objection 1) | Keep auto-loading; make them wait for a manual pick | Keep auto-loading. The viewer shows a small note when `status.game.match` is `"header"`, and the answer names layout-changing hacks that keep the retail header and table pointers as a known gap | User, through the master | No APPROVE in round 3, wording items only |
| 22 | What do species-data fields show on hack profiles before Hack species data resolves? (round 2 objection 4) | A `null` fallback; hold hack profiles | `null` for `gender`, `ability` and `species.dex` and for a boxed mon's `level`, listed as an API v2 contract amendment. The new ticket decides when the fallback goes | User, through the master | No APPROVE in round 3, wording items only |
| 23 | Does a battler's `ability` fall back to `null` too? | Yes; no | No. It comes from battle memory, not species data | Implementer | No APPROVE in round 3, wording items only |
| 24 | What does a signature mismatch after an exact hash match show? (round 2 objection 10) | The table warning; a profile error | The program logs a profile error, and the viewer shows table warnings only when `match` is `"manual"` | Implementer | No APPROVE in round 3, wording items only |

## Audit

Round 1 returned 14 problems. The draft said "never" for ROMs whose block the program can't read. It claimed without evidence that the signature catches hacks and that pret values equal retail bytes. It placed the block for 1.7.0 and 1.7.1 too, and classified Run & Bun, Rogue and Inclement loosely. It left `status.game.signature` undefined after a hash match or an unreadable read, invented a registry flag, and skipped strides, offsets and `.map` files. It said nothing on species-data values, overstated battle churn, and put implementation detail in the glossary entry. Decisions 12-20 record the fixes.

Round 2 returned 15 problems and no APPROVE, so the run stopped under the master's two-round rule. Nothing is committed. Two problems need the user:

1. A hack that changes struct layouts but keeps the retail title, game code and the three table pointers passes the vanilla signature, so the official profile auto-loads with no warning. Decide whether a header-plus-signature match stays unconfirmed with no auto-load, or whether the answer admits the signature can miss.
2. In-reach hacks (CFRU and vanilla-layout ones) have no v2.0 value for `gender`, `ability`, a boxed mon's `level` and `species.dex` until Hack species data resolves. Decide on a fallback such as `null`, which amends the API v2 contract, or hold those hacks until that ticket resolves.

One needs a small design call:

3. After an exact hash match, a signature mismatch means the profile's expected words are wrong, not that the tables moved, so the viewer needs a different message for it.

The rest are citation and wording fixes:

4. The CFRU species-word repoint should cite the header table in the 010 research asset (`gBaseStats 080001BC`, confirmed), since the 010 decision line names only "some header pointers". "Expansion hacks relink the whole ROM" should be labeled an inference.
5. Scope's "no v2.0 data format reads these hacks" should become "v2.0 has no profile or detection for these hacks", because a manual pick of an official profile still reads them.
6. "pret builds match the retail ROMs byte for byte" needs a source, such as the SHA-1 that pret's README gives for the built ROM, or `test:local` named as the gate. "`make syms` writes pret's format" needs a check or should go.
7. The battle churn list omits 1.15.0 (`BATTLE_TYPE` bits) and the 1.14.0 and 1.15.0 enum changes.
8. Volatiles changed in 9 of the 21 tag steps from 1.13.0 to 1.17.2, not in "most releases". The research asset's summary line says "most releases after" and needs the same fix.
9. Run & Bun's lineage should read "appears to be an early expansion hack (unverified)".
10. The dev script and `test:local` need exact citations (the Gen 1-2 bullet of Game identification, the "Running tests" bullet of Decoder test fixtures) or entries in Amends.
11. `"unchecked"` should also cover a readable ROM whose signature word can't be read.
12. The answer should say name-table strides are profile data and struct strides are decoder code.
13. `rom.expansion: null` should mean "no block in the scan range".
14. Glossary: Identification's "header-only (unconfirmed)" needs an amendment, the avoid term "expansion build" clashes with the research asset's usage, and the second sentence should describe the hack, not the project.
15. The ticket has no `## Answer` yet. That is by design, since the master's brief records it after CI.


Round 3 checked the owner's two decisions and the 13 other fixes. It returned seven items and a note, with no APPROVE. The main thread applied items 1-6 after the round, without a re-audit, because each is a wording fix. The header-match note now covers profiles without a signature. Amends names the four fallback fields. The opening states the signature's condition instead of "most other hacks". Detection and Scope point to the header-match gap. The fallback applies to Pokémon in a party or box, and the CFRU citation names the repoint lists and the pointer.

Open item 7: `test:local` can confirm a signature only for revisions the owner owns, and the answer gives no release rule for the rest, such as marking them unverified or holding them. Item 8 asks someone to check citations outside the audited diff. The main thread had read both. The Gen 1-2 bullet of Game identification names the dev script, and the "Running tests" bullet of Decoder test fixtures defines `test:local`.

## For the master

- Decisions line: `- [Expansion hack data format](./tickets/023-expansion-hack-data-format.md): v2.0 ships no data format or profile for expansion hacks and refuses ROMs whose `RHHEXP` block it finds, reports `status.rom.expansion`, guards official Gen 3 profiles with a vanilla signature (`status.game.signature`, a viewer note on header matches, a warning on manual picks after a mismatch), drops the `pointer` name kind, lets the generator read a hack build's `.sym`, and gives hack profiles a `null` species-data fallback until Hack species data resolves.`
- Notes, Games line: "plus Gen 3 ROM hacks (CFRU-based and decomp-based)" becomes "plus Gen 3 ROM hacks that are CFRU-based or keep the official Gen 3 layouts".
- Out of scope: "pokeemerald-expansion hacks and other hacks with their own mon layout, such as Run & Bun, Emerald Imperium, Elite Redux, Inclement Emerald and Emerald Rogue, at v2.0. A later map starts from `assets/023-expansion-hack-data-format.md`."
- "Amended by" notes belong on Game identification, API v2 contract, ROM hack name tables, Game profile source and format, and Decoder test fixtures.
- Surfaced ticket, Hack species data (grilling, blocked by Expansion hack data format):

  > Where do hack profiles get the per-species data that computed fields need, and when does the `null` fallback go?
  >
  > [Expansion hack data format](./023-expansion-hack-data-format.md) gives `kind: "hack"` profiles `null` for `gender`, `ability` and `species.dex`, and for a boxed mon's `level`, because no decision gives them gender ratio, ability slots, growth rate or National Dex numbers. Official profiles use shipped reference data, and CFRU repoints the species data table behind header word `0x080001BC`. Decide whether hack profiles read species data from ROM the way they read name tables, what layout they declare, what these fields return when the table is missing, fails validation or the adapter can't read ROM, and how the `null` fallback is removed.

## Resolution

The resolution is the `## Answer` section of [the ticket](../tickets/023-expansion-hack-data-format.md).
