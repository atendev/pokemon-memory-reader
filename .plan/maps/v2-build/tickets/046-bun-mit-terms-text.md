---
type: task
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794828615
claimed_at: 2026-11-16T11:30:15Z
---

# Add the MIT terms text to Bun's manifest entry

## Question

Build what [Is Bun's own `LICENSE.md` enough as its MIT text?](./045-bun-license-text.md) decided, per [its amendment](../assets/045-bun-license-text.md): keep Bun's `LICENSE.md` byte for byte and add `bun_1.4.2__MIT-terms.txt` with the SPDX MIT permission and warranty paragraphs, enforced in `bun-runtime.test.ts`. The `v2.0.0-beta.1` prerelease waits on it.

## Acceptance

- The Bun entry lists both texts, and the test fails if either is missing or changed.

## Answer

The `bun` entry in `scripts/notices/bun-runtime.json` lists `bun_1.4.2__LICENSE.md.txt` then the new `bun_1.4.2__MIT-terms.txt`, a two-line header and the SPDX MIT permission and warranty paragraphs (body SHA-256 `83330a27…640468`, no copyright line). Its `notes` field carries the pin-bump rule. Three cases in `bun-runtime.test.ts` keep the exception to the `bun` entry, pin the `LICENSE.md` hash and check the terms file's header and body hash. Mutation checks confirmed each fails when its text is edited or removed. Audit approved in round 1, and CI is green on 7c715da (PR #28). [Report](../assets/046-bun-mit-terms-text-report.md).

- The vendored `LICENSE.md` from ticket 041 ends in a newline that upstream's file lacks. The test pins the vendored copy, so the owner decides whether to strip it.
- The owner still confirms the MIT notice reading before `v2.0.0-beta.1`.
