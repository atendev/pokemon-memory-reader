---
type: task
blocked_by: [040]
claimed_by: wayfinder-master v2-build-master-1794843940
claimed_at: 2026-11-16T15:46:14Z
---

# LGPL notices section, About line and relinking doc

## Question

Per [the 042 amendment](../assets/042-bun-lgpl-terms.md): `THIRD-PARTY-NOTICES.txt` opens with an LGPL section, the About page shows the JavaScriptCore and tinycc copyright lines, and `docs/lgpl-relinking.md` explains rebuilding Bun and using `--compile-executable-path`.

## Acceptance

- Tests on `scripts/notices.ts` output check the LGPL section comes first, and a viewer test checks the About lines.

## Handoff

Branch `t3/lgpl-notices-relinking-doc`, tag `wfm-v2-build-048-1794843940`. Audit round count so far: 0 (no council dispatched). Implementation is done and passes locally. The last SHA is the `wip:` commit on this branch.

Done:
- `scripts/notices.ts`: `LgplInfo`, `NoticeEntry.lgpl`, `needsLgplTerm()` (fails permissive tier, passes with LGPL-2.0/2.1-or-later), missing `displayName`/`copyright`/`mirror.repo`/`mirror.tag` is a problem, `renderLgplSection()`, and `renderNotices()` puts the section first.
- `scripts/notices/bun-runtime.json`: WebKit and tinycc gain `displayName`, `copyright`, `mirror` (`atendev/WebKit`, `atendev/tinycc`, tag `pmr-bun-v1.4.2`). Fixture manifest `jsc` gains the same.
- `viewer/src/lgpl.ts`, `About.tsx`, `about.test.tsx`, hash route `#/about` in `App.tsx` (`useHash` in `useResource.ts`), `.nav-link` style.
- `scripts/notices.test.ts`: new "LGPL components" describe, including a test that the viewer list equals the manifest's LGPL entries.
- `docs/lgpl-relinking.md` (from Bun `bun-v1.4.2` scripts: LLVM 21.1.8, Rust nightly-2026-07-20, Node 25+, `release-local` profile, tinycc patch, no WebKit patch). "Last verified: not yet verified". README line added.
- Local: `bun run lint`, `bun run typecheck`, `bun run notices --check` pass. `bun test` passes except the Lua 5.3/5.4 version test, which fails only because this machine has Lua 5.5.

Left, in order:
1. Write the full diff to a file in the checkout and run `council-audit` (call `orchestrator_capabilities` first). Fix problems, up to five rounds.
2. Write `.plan/maps/v2-build/assets/048-lgpl-notices-about-relinking-report.md`, run unslop, commit.
3. Push without forcing, open a PR against `wayfinder/v2-build-master`, link it, return PUSHED.
4. After CI, add the resolution to this ticket, delete this section, return DONE.

Declined or deferred (for the report): no `RELEASING.md` exists, so its LGPL lines (no added terms, Bun upgrade steps) are surfaced as a new ticket. The release-body line belongs to ticket 049. `bun run notices` in generating mode still fails on the two `blockedUntilAmendment` entries (tickets 051, 052), so the full file was checked through the render tests only.

Surface on DONE: "LGPL lines in RELEASING.md | task | blocked by the ticket that creates RELEASING.md".

Read first: `scripts/notices.ts` (`needsLgplTerm`, `lgplInfo`, `renderLgplSection`), `scripts/notices.test.ts` ("LGPL components"), `docs/lgpl-relinking.md`, `viewer/src/About.tsx`.
