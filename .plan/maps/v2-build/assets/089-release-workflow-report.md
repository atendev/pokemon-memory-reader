# Decision report for `release.yml` and per-OS archives

Ticket 089. Branch `t3/release-yml-per-os-archives-1`, continued from the `wip:` commit `7f98dcb`. The council ran with the Claude seat only, because the Gemini and GPT seats are out of quota. Auto mode is on, so the main thread made each decision itself.

## Decisions

1. **Which ticket owns the ref check script?**
   - Options: wait for a separate ticket, or write `scripts/check-release-ref.ts` here.
   - Choice: write it here. No earlier ticket built it, and the workflow cannot run without it.
   - Made by: main thread. Council: not contested.

2. **How does a feature branch prove the dry run?**
   - Options: `workflow_dispatch` only, or also a `pull_request` trigger.
   - Choice: both. GitHub offers `workflow_dispatch` only for a workflow file on the default branch, so the `pull_request` trigger, filtered to the files that shape a release, covers a feature branch (amendment 024 item 8). A tag push is the only trigger that creates a draft.
   - Made by: main thread. Council: not contested.

3. **Which runners build and smoke-test each target?**
   - Choice: an ubuntu runner builds the Windows and Linux targets. A macOS arm runner builds and ad-hoc signs both macOS targets. Each archive is smoke-tested on a native runner (`windows-latest`, `windows-11-arm`, `ubuntu-latest`, `ubuntu-24.04-arm`, `macos-latest`). `darwin-x64` runs under Rosetta 2 on the arm runner.
   - Made by: main thread, following spec §13.1.

4. **Archive formats.**
   - Choice: zip for Windows and macOS, tar.gz for Linux so the executable bit survives. Both writers are deterministic. The zip writer is hand-written and keeps the exec bit. The tar uses GNU tar with a fixed order, owner and time.
   - Made by: main thread.

5. **What is "signature evidence" in the body?**
   - Options: the generator's `SIGNATURE-EVIDENCE.md`, or the `codesign --verify` output from the macOS build.
   - Choice: `SIGNATURE-EVIDENCE.md`, appended by `scripts/release-body.ts` after the ref check. Ticket 039's accepted answer defines it that way.
   - Raised by: the Claude seat in round 1 as a blocking problem. Main thread rebutted it with the 039 answer and the script. The seat dropped it in round 2.

6. **Fix for the failing matrix test.** Biome reformats the inline matrix rows into block style, which broke string matches. The test now reads both matrices through `Bun.YAML.parse` and compares them with the `TARGETS` table. Made by: implementer.

7. **Fix for a duplicate checksum line.** The Bun and tinycc source archives are `.tar.gz`, so the `sums` step listed them again after `lgpl-sources.ts build` had already listed them, and `appendSums` would have thrown. `releaseFiles` now skips names already in the file, and a test covers it. Raised by: the Claude seat as a minor problem. Main thread confirmed it as a real defect and fixed it.

8. **Wider `pull_request` path filter.** Added `scripts/lgpl-sources.ts`, `scripts/smoke.ts`, `scripts/notices.ts`, `server/src/bridges/**` and `server/src/main.ts`. Raised by: the Claude seat. Fixed.

## Audit

Council with the Claude seat only. Gemini and GPT: not run.

| Round | Claude verdict | Score | Notes |
| --- | --- | --- | --- |
| 1 | DISAPPROVE | 6 | One blocking problem (decision 5), five minor. |
| 2 | APPROVE | 8 | Two minor problems. |

Local checks on the final state: `bun run lint` and `bun run typecheck` pass. `bun test` passes except `the Lua core runs under Lua 5.3 or 5.4`, which fails because this machine has Lua 5.5. That failure is not part of this change.

## Minor problems declined

- Dry-run artifacts hold no end-to-end run. The ticket forbids starting CI here, so the master runs the dry run on the merged batch. A test asserts the workflow structure.
- The dry-run `SHA256SUMS` lists the LGPL source archives, but the dry run does not attach them. They are large and matter only to a real release, and the workflow comment says so.
- `scripts/release-archive.test.ts` runs GNU `tar`, so it fails under bsdtar on a macOS dev machine. The archive build runs only on ubuntu runners.
- The new `releaseFiles` test does not cover the `sums` command wiring. The wiring is three lines and CI exercises it.
- A rerun against an existing `SHA256SUMS` keeps the old hash for an already listed name. CI writes the file fresh each run.

## Left open for the master

- The coverage guard's tier 2 and no-fixture list is not pasted into the draft body, because the guard does not exist yet.
- `README.md` SmartScreen text and `CHANGELOG.md` do not exist, so the body falls back to a dry-run placeholder and `scripts/release-notes.md`.
- `windows-11-arm` with `setup-bun`, and the Rosetta step, are unverified until a run.
- `codesign --force` was added to the spec's `codesign --sign -`, so a rebuilt binary can be re-signed.
