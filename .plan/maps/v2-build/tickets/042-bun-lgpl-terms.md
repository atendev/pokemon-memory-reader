---
type: grilling
blocked_by: [041]
claimed_by: wayfinder-master v2-build-master-1794807670
claimed_at: 2026-11-16T06:40:24Z
---

# How do releases meet the LGPL terms for Bun's statically linked JavaScriptCore and tinycc?

## Question

The compiled executable links Bun's JavaScriptCore and tinycc statically, and both are LGPL. [Bun runtime notices manifest](./041-bun-runtime-notices-manifest.md) lists them. Decide what each release ships or links so it meets the LGPL terms, such as source offers, relinking material or object files. The `v2.0.0-beta.1` prerelease waits on this.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

[Amendment 042](../assets/042-bun-lgpl-terms.md) settles it, and spec §13.4 and §13.5 cite it. It is an engineering reading of LGPL-2.1 §6, not legal advice. Decided in auto mode.

- **Route.** §6(d), with no written offer and no §3 conversion to the GPL. The rule covers any Bun runtime manifest entry that needs an LGPL term to pass the allowlist. Today those are WebKit and tinycc. It applies to every published executable, prereleases included.
- **Materials.** Every release attaches source archives of Bun, tinycc and WebKit (WebKit in parts under 2 GiB if needed), fetched from upstream at the pinned versions by `release.yml` (revised 2026-11-17: no owner forks or protected tags). The app's own tag source completes the set. The work that uses the Library is given as source. The project doesn't build Bun or publish object files.
- **Notices.** `THIRD-PARTY-NOTICES.txt` opens with an LGPL section. The About page shows a line built from new manifest fields (`displayName`, `copyright`, `upstream`). README and release bodies link the relink steps.
- **Relinking.** `docs/lgpl-relinking.md` at each tag covers rebuilding Bun with the modified library and then `bun build --compile --compile-executable-path <bun>` on the app source. Two owner runs on linux-x64 verify it before beta.1.
- **Enforcement.** An offline check in PR CI, an online check on the draft release and on Bun-pin PRs, and a CI re-host job.
- **Excluded.** Forks and protected tags (dropped 2026-11-17), a written offer, building Bun ourselves, mirroring Bun's non-LGPL deps, the toolchain or npm deps (all recorded as accepted risks), and testing relinks on targets other than linux-x64.
- **Unblocks.** `v2.0.0-beta.1` waits on four new tasks and ticket 045.

Report: [042-bun-lgpl-terms-report.md](../assets/042-bun-lgpl-terms-report.md).

CI green on 94c2f77 (PR #27). Audit approved in round 4.
