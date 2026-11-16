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

## Answer

`THIRD-PARTY-NOTICES.txt` opens with an LGPL section, built by `renderLgplSection()` for every Bun runtime manifest entry that only passes the runtime tier because of an LGPL term (`needsLgplTerm()`). WebKit and tinycc gain `displayName`, `copyright` and `mirror` fields, and a missing field is a problem in `scripts/notices.ts`. The About page, at the hash route `#/about`, shows the JavaScriptCore and tinycc copyright lines from `viewer/src/lgpl.ts`, and a test fails when that list differs from the manifest's LGPL entries. `docs/lgpl-relinking.md` gives the source locations, pinned toolchain, the `release-local` build, `--compile-executable-path` and the patch list, and says it is not yet verified (ticket 050). README has one line pointing to it. Tests cover the section coming first and the About lines. The council approved in round 3. Report: [048 report](../assets/048-lgpl-notices-about-relinking-report.md).

Left out. The `RELEASING.md` lines (no added terms, Bun upgrade steps) wait for a ticket that creates that file, and the release-body line is ticket 049. The About link target is served by a later ticket.
