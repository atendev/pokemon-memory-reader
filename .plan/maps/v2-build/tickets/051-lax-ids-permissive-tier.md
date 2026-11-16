---
type: task
blocked_by: [043]
claimed_by: wayfinder-master v2-build-master-1794843940
claimed_at: 2026-11-16T15:46:14Z
---

# Add the lax IDs to the permissive tier and clear bun_clap's flag

## Question

Build what [Does the runtime tier accept `Unlicense` for bun_clap, or is the dependency replaced?](./043-unlicense-bun-clap.md) decided, per [amendment 043](../assets/043-unlicense-bun-clap.md) item 6. Add `Unlicense`, `CC0-1.0`, `MIT-0`, `BSL-1.0` and `Unicode-DFS-2016` to `PERMISSIVE_TIER` in `scripts/notices.ts` and its pinned test. Take the first four out of the "excluded IDs fail in both tiers" test. Move the failing-example fixtures (`unlicense-pkg` and the runtime fixture's `odd-clap`) to an ID that is still excluded, such as `WTFPL`. Clear `bun_clap`'s `blockedUntilAmendment` flag and note in `scripts/notices/bun-runtime.json`, and update the blocked list in `bun-runtime.test.ts`. The `v2.0.0-beta.1` prerelease waits on it.

## Acceptance

- The tier test pins the five new IDs, and fixtures under them pass in both tiers.
- `bun_clap` passes `bun run notices --check --strict`, which then flags only entries other tickets still hold.

---

`PERMISSIVE_TIER` in `scripts/notices.ts` now has `Unlicense`, `CC0-1.0`, `MIT-0`, `BSL-1.0` and `Unicode-DFS-2016`, and the runtime tier includes them. The tier test pins all thirteen IDs, and a new `lax` npm fixture passes with one package per new ID. [Report](../assets/051-lax-ids-permissive-tier-report.md).

- `bun_clap` has no `blockedUntilAmendment` flag and passes the runtime tier. `bun run notices --check --strict` now flags only `domain-browser@4.23.0`, which [ticket 052](./052-runtime-entry-exception-domain-browser.md) holds.
- The failing-example fixtures use `WTFPL`: `unlicense-pkg` became `wtfpl-pkg` in the disallowed fixture, and the runtime fixture's `odd-clap` keeps its name.
- Council approved in round 1 (claude 8, gemini 10, gpt 10). CI is green.
