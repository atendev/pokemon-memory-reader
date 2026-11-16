# Decision report for LGPL notices section, About line and relinking doc

Ticket 048, branch `t3/lgpl-notices-relinking-doc-1`. It continues the work from branch `t3/lgpl-notices-relinking-doc` at `5374bba`, picked up from the ticket's handoff. The ticket is a task, so no grilling ran. Every decision below followed amendment 042 or was made by the implementer. The council approved in round 3.

## Decisions

### 1. How the code decides a manifest entry is an LGPL component

- Question. Which entries get the LGPL notices section and About line?
- Options. Match on SPDX ids containing `LGPL`, match on a hard-coded list of names, or test whether the expression needs an LGPL term to pass the allowlist.
- Choice. `needsLgplTerm()` returns true only when the expression passes the runtime tier and fails the runtime tier with the LGPL ids removed. `LGPL-2.1-or-later OR MIT` and `LGPL-2.1-or-later OR MPL-2.0` don't count. This follows amendment 042 section 1.
- Made by. Implementer for the first version. The council changed the tier it tests against.
- Audit. In round 1 the claude seat (blocking) and the gemini seat (minor) both found the first version compared the permissive tier with permissive plus LGPL. Bun runtime entries are checked against the runtime tier, so `MPL-2.0 OR MIT` would have been flagged as LGPL. Fixed in round 2, with three new test cases.

### 2. Required LGPL fields

- Question. What does an LGPL entry have to carry?
- Choice. `displayName`, `copyright` and `mirror: { repo, tag }`. A missing field is a problem in `scripts/notices.ts`, which is the offline check amendment 042 section 7 asks for. WebKit and tinycc in `bun-runtime.json` gain the fields, with mirrors `atendev/WebKit` and `atendev/tinycc` at `pmr-bun-v1.4.2`. The fixture manifest gets the same fields for its `jsc` entry.
- Made by. Implementer.

### 3. Notices section

- Choice. `renderLgplSection()` is the first block of `renderNotices()`. For each component it gives the name, the copyright line, the statically linked statement, the mirror tag URL, pointers to the LGPL texts later in the file (2.0 and 2.1) and a pointer to `docs/lgpl-relinking.md`. Tests check the section comes first and names every component.
- Made by. Implementer, per amendment 042 section 5.

### 4. About page

- Question. Where does the About page get its component list?
- Options. Fetch the manifest at run time, or keep a list in the viewer and test it against the manifest.
- Choice. `viewer/src/lgpl.ts` holds the names and copyright lines, and a test in `scripts/notices.test.ts` fails when the list differs from the manifest's LGPL entries. The viewer bundle cannot read the manifest, and no route serves it. `About.tsx` is shown at the hash route `#/about` (decision 021).
- Made by. Implementer.
- Declined. The claude seat noted the list is a hand-kept copy and the amendment says the line is built from manifest entries. Declined as minor, because the test pins the two together.

### 5. Link to `/about/third-party-notices.txt`

- Choice. `About.tsx` links to it. The claude seat noted that nothing serves that path yet. The route is defined by amendment 021 and a later ticket serves it. Declined as minor.

### 6. Relinking doc

- Question. Which commands does `docs/lgpl-relinking.md` give for the WebKit build?
- Choice. `bun scripts/build.ts --profile=release-local --build-dir=build/release-local`. The doc says `release-local` is Bun's release profile with `webkit: "local"`, the same as `--webkit=local` on the release profile, and tells a tinycc-only change to use `--profile=release`. The `bun run build:local` script is a debug build, so the doc says not to use it.
- Evidence. `scripts/build/profiles.ts` at `bun-v1.4.2` defines `release-local` as `buildType: "Release"` with `webkit: "local"`. I read it through the GitHub API in this run.
- Audit. The gpt seat raised the missing `--webkit=local` as blocking in round 1 and the claude seat raised it as minor. Rebutted with the profile definition, and the doc sentence was added. Both seats dropped it.

### 7. Patches Bun's build applies

- Choice. The doc lists `patches/tinycc/tcc.h.patch` for tinycc and none for WebKit. It notes that Windows local builds patch ICU's `.vcxproj` files, which is ICU and not WebKit.
- Evidence. `scripts/build/deps/tinycc.ts:30` has `patches: ["patches/tinycc/tcc.h.patch"]`, and `scripts/build/deps/webkit.ts` at `bun-v1.4.2` has no `patches` field. Checked in this run. The claude seat called the WebKit claim unsupported in round 1 and dropped it after the rebuttal.

### 8. License basis sentence in the doc

- Choice. The doc says LGPL-2.1 section 6 requires the program's terms to allow modification and reverse engineering for debugging, that the GPL-3.0-or-later terms allow modification and put no limit on reverse engineering, and that no text in the repository adds one.
- Audit. The claude seat found the first wording credited the GPL with a right that comes from the LGPL (blocking, round 1). It then said the second wording overstated the grant for reverse engineering (minor, round 2). Both were fixed.

### 9. "Last verified" line

- Choice. The doc says "not yet verified" and says the steps come from reading Bun's scripts. Ticket 050 runs the relink on linux-x64 and records the date.
- Made by. Implementer, per amendment 042 section 6. Steps known to be broken must not ship, so the line stays honest until 050.

### 10. README, release body and RELEASING.md

- Choice. README gets one line linking the relink doc and the mirror tags. The release-body line belongs to ticket 049. No `RELEASING.md` exists, so its two lines (no added terms, Bun upgrade steps) are surfaced as a new ticket.
- Made by. Implementer.

## Audit

| Round | claude | gemini | gpt | Outcome |
| --- | --- | --- | --- | --- |
| 1 | 6 DISAPPROVE | 9 APPROVE | 7 DISAPPROVE | Two blocking, five minor from claude, one blocking from gpt, one minor from gemini |
| 2 | 8 APPROVE | not dispatched | 9 APPROVE | Fixes for decisions 1, 6 and 8 confirmed |
| 3 | 9 APPROVE | 10 APPROVE | 9 APPROVE | Council APPROVE |

Declined minor problems, all from the claude seat in round 1.

- The viewer list is a hard-coded copy of the manifest (decision 4).
- The About link target is not served yet (decision 5).
- Release assets, `SHA256SUMS` and toolchain pins are claims not evidenced in the diff. `.github/workflows/ci.yml:94` runs `scripts/smoke.ts`, the asset design is amendment 042, and the toolchain pins come from reading Bun's scripts, which the doc says.

## Checks

`bun run lint`, `bun run typecheck` and `bun run notices --check` pass. `bun test scripts/notices.test.ts viewer/src/about.test.tsx` passes (64 tests). The full `bun test` also passes, except the Lua 5.3 and 5.4 version test, which fails on this machine because it has Lua 5.5. `bun run notices` in generating mode still fails on the two `blockedUntilAmendment` entries (tickets 051 and 052), so the complete notices file was checked through the render tests only.

## Surfaced

- LGPL lines in `RELEASING.md` (task), blocked by the ticket that creates `RELEASING.md`.
