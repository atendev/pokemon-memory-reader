---
type: task
blocked_by: [044]
claimed_by: wayfinder-master v2-build-master-1794843940
claimed_at: 2026-11-16T15:46:14Z
---

# Runtime entry exception for domain-browser

## Question

Build what [Does the runtime tier accept `Artistic-2.0` for domain-browser, or is the dependency replaced?](./044-artistic-2-domain-browser.md) decided, per [amendment 044](../assets/027-third-party-license-allowlist.md#amendment-044-artistic-20-for-buns-domain-browser) items 3 and 4. Add the `RUNTIME_ENTRY_EXCEPTIONS` constant to `scripts/notices.ts` with its pinning test. It matches Bun manifest entries only, on exact `name@version`, and fails on stale exceptions. Print each matched exception's `note` under the entry's `Source:` line. Update the domain-browser manifest entry: drop `blockedUntilAmendment`, and set `source` to the npm tarball URL with the upstream tag in `notes`. The `v2.0.0-beta.1` prerelease waits on it.

## Acceptance

- `domain-browser@4.23.0` passes under `Artistic-2.0`. Another version, an npm closure entry or an override with the same `name@version` fails.
- A stale exception fails `notices --check`, and the generated notices print the exception note.
- Together with [Add the lax IDs to the permissive tier and clear bun_clap's flag](./051-lax-ids-permissive-tier.md), `bun run notices --check --strict` passes with no `blockedUntilAmendment` entries.

## Answer

`scripts/notices.ts` exports `RUNTIME_ENTRY_EXCEPTIONS` with one item, `domain-browser@4.23.0` under `Artistic-2.0` and amendment 044, pinned by a test. It matches Bun manifest entries only, on an exact `name@version`, and the rest of the entry's expression still has to pass. An npm closure entry, an override or another version with the same ID fails. A stale exception fails `notices --check`, and the generated notices print the exception's note under the entry's `Source:` line. The domain-browser manifest entry drops `blockedUntilAmendment`, uses the npm tarball URL as `source`, and names the upstream tag in `notes`. Audit approved in round 2 (claude 8, gemini 10, gpt 9), and CI is green on 9e50a55 (PR #31). [Report](../assets/052-runtime-entry-exception-domain-browser-report.md).

- `bun run notices --check --strict` still fails on `bun_clap@1.4.2` until [Add the lax IDs to the permissive tier and clear bun_clap's flag](./051-lax-ids-permissive-tier.md) merges. Both branches change the blocked-list assertions in `notices.test.ts` and `bun-runtime.test.ts`, so the merge has to leave them empty.
- The online source check for exception URLs (amendment 044 item 5) is still the follow-up task blocked by [ticket 049](./049-lgpl-release-check-assets.md).
