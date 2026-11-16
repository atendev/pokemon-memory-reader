# 042 decision report: LGPL terms for Bun's statically linked libraries

Grilling ticket, decided in auto mode. The main thread wrote the questions, a sonnet grilling subagent answered them over four rounds, and a haiku auditor checked the amendment. Output: [amendment 042](./042-bun-lgpl-terms.md). Evidence: [relink path research](./042-bun-relink-path-research.md) and [source archive sizes research](./042-source-archive-sizes-research.md).

## Decisions

| # | Question | Options | Choice | Made by |
| --- | --- | --- | --- | --- |
| Q1 | Which LGPL-2.1 §6 option? | (a) materials in each archive, (b) shared library, (c) written offer, (d) access from the same place | (d), with no written offer | grilling subagent accepted main thread |
| Q2 | Relinkable form of the work? | source, object files, both | source: the app tag plus the Bun tag. The project doesn't build Bun itself | grilling subagent accepted |
| Q3 | Name the two libraries or key the rule to the license? | names, license expression | any manifest entry that needs an LGPL term to pass the allowlist | grilling subagent accepted, made the trigger precise |
| Q4 | Where does the §6 notice live? | notices top section, separate file, release body | notices top section, plus README, release body and an About line with copyright lines | grilling subagent accepted, added the About line |
| Q5 | Do prereleases follow the rule? | yes, no | yes, every published executable | grilling subagent accepted |
| Q6 | Script check or checklist? | script, checklist | script gate, with a RELEASING backstop | grilling subagent accepted |
| Q7 | Lawyer sign-off? | gate, no gate | no gate. The amendment is an engineering reading | grilling subagent accepted |
| Q8 | Convert to GPL under §3? | yes, no | no | grilling subagent accepted |
| Q9 | Where do the materials sit? | upstream links, release assets, owner forks | first owner forks with `pmr-bun-v<ver>` tags. After audit round 1: source archives as assets on every release, with forks kept for durability and git access. WebKit is split into parts under 2 GiB if needed | grilling subagent, revised in round 4 after the auditor |
| Q10 | Retention? | tag ruleset, recheck every past release | tags protected by a ruleset, kept while any citing release is published | grilling subagent accepted |
| Q11 | Mirror Bun's other deps? | LGPL plus Bun only, everything | LGPL plus Bun only. Vanished deps, the toolchain and npm deps are accepted risks | grilling subagent accepted. The toolchain exception was dropped after the audit |
| Q12 | LGPL 2.0 versus 2.1? | | 2.1 reading project-wide. A 2.0-only WebKit file is a known limit | grilling subagent, narrowed after the audit |
| Q13 | Modification and reverse-engineering terms? | | GPL-3 permits both, subject to ticket 045 for Bun's own code. No added terms | grilling subagent. The 045 caveat came from round 4 |
| Q14 | About wording? | | built from manifest `displayName` and `copyright` | grilling subagent added the fields |
| Q15 | Manifest completeness ticket? | new ticket, none | none. The census sample is a recorded limit | grilling subagent accepted. The main thread checked that the manifest lists Bun's build deps |
| Q16 | Relink steps? | | `docs/lgpl-relinking.md` per tag. Rebuild Bun, then compile with `--compile-executable-path`. Re-sign on macOS | grilling subagent accepted |
| Q17 | Verification? | CI app-side job, owner end-to-end run, CI full build | CI re-host job plus two owner runs on linux-x64. First gated the RC. After the audit, gates beta.1 | grilling subagent, revised in round 4 |
| Q18 | Where does the check run? | | offline in PR CI. Online on the draft release and on PRs that touch the Bun pin | grilling subagent accepted |
| Q19 | Who makes the forks? | agent, owner | owner runs an agent-written `wizard.sh` that uses the API | grilling subagent accepted |
| Q20 | Ticket split | | four tasks. beta.1 waits on all four | grilling subagent accepted |

## Audit

- Round 1 returned 12 problems. Two were blockers: the "same place" claim rested on forks in other repos, and beta.1 would have shipped unverified relink steps. Three were omissions: the toolchain exception misread, app npm deps, and the tinycc patch. Seven were evidence gaps, one of which was that Bun's code was wrongly called MIT. Items 1 and 2 went back to the grilling subagent as round 4, and the main thread fixed the rest.
- Round 2 returned seven problems: the toolchain gap needed stating plainly, ticket 045 needed to block beta.1, a stale "MIT", the LGPL-2.0 text, an unsourced npm claim, an asserted patch claim, and the clone wording. The main thread fixed all seven.
- Round 3 returned one problem: §5 and §9 didn't carry the LGPL-2.0 text. Fixed.
- Round 4: APPROVE. The auditor didn't open the 027 and 041 sources or spec §13.5, so it took those citations as stated.

## Left open

- The size of a one-commit WebKit archive. The mirror task measures it.
- Whether a release-profile `--webkit=local` build and the tinycc pin edit work. The verification task runs both.
- Bun's own license text, which ticket 045 settles.
