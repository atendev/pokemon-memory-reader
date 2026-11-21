# Ticket 118: jsDelivr 403 fallback for icons

Auto mode, single Claude seat. Gemini and GPT: not run (out of quota).

## What changed

- `server/src/icons/source.ts`: the default source gains `fallbackBase`, the same pinned PokeAPI/sprites commit on raw GitHub. A mirror has `fallbackBase: null`. New `fallbackUrl(source, path)`.
- `server/src/icons/service.ts`: `download` asks the second URL when the first answers 403, before the miss is remembered. Any other status follows the existing rules.
- `scripts/check-icon-map.ts`: the check uses the same fallback on a 403.
- `server/test/icons/service.test.ts`: four new tests, and the existing 403 test now expects three calls.

## Decisions

1. **Fallback or retry?** Options: retry jsDelivr, or add a second source. Choice: second source (raw GitHub at the same SHA). The ticket says a newer pin and `@master` fail the same way, so a retry of the same host would not help. Made by the main thread.
2. **Which status triggers the fallback?** Options: any 4xx, or only 403. Choice: only 403. A 404 means the file is absent at that commit and the second host would say the same, so it stays a remembered miss under ticket 086's rule. Main thread.
3. **What if the second source also fails?** A 403 or other 4xx on both is a remembered miss. A 429, a 5xx or a network error on either request backs the whole source off for 60 s, as in ticket 086. Main thread.
4. **Mirrors.** A user's `baseUrl` mirror has no second source, so a 403 from it stays a remembered miss. Main thread.
5. **No provider.** `service.get` returns before `fetchUpstream` when `mode` is `off` or `local`, so the fallback cannot send a request. A test covers both modes. Main thread.
6. **`check-icon-map`.** Options: list the two paths as known blocked, or use the fallback. Choice: use the fallback, so the check exercises the route's logic. The two paths both return 200 from raw GitHub at the pinned SHA.

## Evidence

- `bun test server/test/icons`: 61 pass.
- `bun run typecheck` and Biome: clean.
- `bun run check-icon-map` against live jsDelivr: 5058 paths, every one resolves. jsDelivr answered 403 for `icons/149.png` at the start of the run and 200 later, so the 403s are intermittent. The fallback handles both cases.

## Audit

Council round 1, Claude seat (haiku): APPROVE, score 8. Gemini and GPT: not run.

Declined minor problem: a 429, 5xx or network error from raw GitHub backs off the jsDelivr primary too, because backoff is keyed by source and raw GitHub is part of the default source. Reason: ticket 086 keys backoff by source, and one backoff avoids sending more requests at a pair of hosts that are already failing. A test pins this.
