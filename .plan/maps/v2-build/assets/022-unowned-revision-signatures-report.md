# Decision report: What happens to signatures for revisions the owner doesn't own?

Ticket: [022-unowned-revision-signatures](../tickets/022-unowned-revision-signatures.md). Amendment: [022-unowned-revision-signatures](./022-unowned-revision-signatures.md). Facts: [022 facts](./022-unowned-revision-signatures-facts.md). Type: grilling.

## How it ran

The owner picked Auto mode for this ticket before it started, so no question went to the owner. The main thread wrote each question with options and a recommendation, and a sonnet grilling subagent answered it. That took two rounds. A haiku auditor checked the amendment. It raised six problems and one minor point in round 1 and approved in round 2. No research subagent ran. The main thread checked one fact itself through `gh api`. pokeruby's GF header has no pointer to the species, item or move tables.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|---|---|---|---|---|
| 1 | Do official Gen 3 revisions the owner doesn't own ship in v2.0? | (a) hold back (b) ship with the generated signature (c) ship with no signature | (b). A wrong signature costs a log line, or a manual pick on emulators that give no hash. | Main thread recommended, grilling subagent accepted | Approved |
| 2 | What confirms a signature without the owner's ROM for that revision? | (a) nothing (b) build-equivalence chain (c) per-revision ROM check only | (b). pret SHA-1 equals No-Intro SHA-1, and one owned revision per pret repo confirms the header field mapping. The subagent named the level `chain`, and it shows in docs only. | Main thread recommended, grilling subagent accepted and named the level | Approved |
| 3 | An unowned revision whose chain breaks (Sapphire German 1.0)? | (a) hold back (b) ship marked unverified (c) ship with no signature | (a), with a re-entry rule. | Grilling subagent, re-entry rule added by it | Approved round 2 after fixes |
| 3a | How does a held-back revision re-enter? | owner check; repaired chain; a written diff of symbol addresses | An owner check (the signature check plus the §12.6 smoke fixture, with the No-Intro SHA-1 in `identify.sha1`), or pret's SHA-1 coming to equal No-Intro's. The diff option was dropped because no evidence level could record it. | Main thread, after audit round 1 | Approved round 2 |
| 4 | A pret repo with no owned revision? | (a) ship as unconfirmed (b) hold the whole repo (c) ship with no signature | (a), plus a default-suite unit test that pins the generator's field mapping. | Main thread recommended, grilling subagent accepted and added the test | Approved |
| 5 | Ruby/Sapphire headers lack the three table pointers. Decide their words here? | (a) new ticket (b) decide now (c) no signature | (a). Until it resolves, their profiles declare no signature. pokeruby counts as its own repo for the mapping. | Main thread recommended, grilling subagent accepted | Approved |
| 6 | Where is the evidence level recorded? | (a) ledger plus a generator-written `provenance.signatureEvidence` (b) a hand-edited field (c) docs only | (a). `test:local --record` appends to the ledger, and a default-suite test checks agreement. | Main thread recommended, grilling subagent accepted | Approved |
| 7 | Runtime behaviour for `chain` and `unconfirmed`? | (a) none (b) a log line each session | (a). The API and `status.game.signature` stay unchanged. | Main thread recommended, grilling subagent accepted | Approved round 2 (citation fixed) |
| 8 | Release gate for the RC and `v2.0.0`? | (a) a default-suite test (b) `test:local` only | (a). It checks evidence levels, the absence of held-back profiles, and the release notes list. | Main thread recommended, grilling subagent accepted | Approved |
| 9 | An owned revision fails its signature check? | (a) block the whole repo (b) block that profile only (c) ship it without a signature | (a), except an owned broken-chain revision, which stays held back alone. | Grilling subagent; exception added by the main thread after audit round 1 | Approved round 2 |
| 10 | How is a profile held back? | (a) the generator skips it through a committed skip list (b) excluded at build time | (a). The docs say a user profile carries no built-in evidence level. | Main thread recommended, grilling subagent accepted | Approved |
| 11 | Scope? | (a) official Gen 3 only (b) include hack signatures | (a). Gen 3 revisions with no pret build are outside v2.0 under §1. | Main thread recommended, grilling subagent accepted; §1 point added after audit round 1 | Approved round 2 |

## Audit round 1 fixes

- The `owner` level now keys on the retail No-Intro SHA-1, so a broken-chain revision can reach it.
- The written-diff repair option is gone.
- The scope states that every built-in official Gen 3 profile has a pret build (§1).
- The `fixture: "none"` warning and the Gen 1-2 `null` signature now cite §5.2 and §5.4.
- The example offset is `0x1BC`, the ROM offset in the facts file, not the struct offset `0xBC`.
- An owned broken-chain failure no longer blocks its whole repo.

## Surfaced

- "Which bytes form the Ruby/Sapphire signature?" (grilling). Needed by the Ruby/Sapphire profiles.
- "Signature evidence ledger, generator field and release gate" (task). Builds amendment items 4, 5 and 8. Blocked by Generate hash lists from pret and No-Intro.

## Gates skipped

- No question went to the owner, because Auto mode was chosen up front.
- Step 5's commit question was skipped, as the master's brief instructs. The master merges.
