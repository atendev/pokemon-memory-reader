# Icon cache clear route: decision report

## Decisions

1. **Route and guard.** Choice: `POST /settings/icon-cache/clear` is a `write` row in `ROUTES`, registered through `internalRoute` inside the `icons` block of `createApp`. The write guard from amendment 021 runs unchanged, so a LAN peer, a bad Host, a foreign Origin and a non-JSON body all get `403 write_forbidden`, the same as `PUT /settings`. Made by: implementer.
2. **Cache clearing.** Choice: the handler calls `IconService.clearCache()` from ticket 086 and nothing else. That deletes every source folder and forgets the remembered misses, so the next `/icons` request fetches again. Made by: implementer.
3. **Success body.** Options: `{}`, or a settings body with the new cache size. Choice: `{}`, as `/manual-picks/forget` does. The viewer reads the size from `GET /settings`. Made by: implementer.
4. **I/O failure code.** Options: add a new error code, reuse `save_failed`, or let the app's `500 internal` answer. Choice: `save_failed` (500) with the message "The icon cache could not be cleared." Amendment 021 closes the enum at 18 codes and a test pins it, so a new code would amend a decided ticket. The viewer shows `message` whatever the code. Made by: implementer.
5. **Route absent without icons.** Choice: with no icon service there is no route, the same as `/icons/*`. Made by: implementer.

## Audit

Council with the Claude seat only. Gemini and GPT: not run (out of quota). Round 1: APPROVE, score 8, no blocking problems.

## Minor problems

- Declined: reusing `save_failed` stretches its meaning from a settings write to a cache clear. This is decision 4, made to keep the closed enum.
- Declined for this ticket: `clearCache` does not wait for a download already in flight, so a download that started before the clear can write its file back after it. This lives in the ticket 086 service, not in the route, and the worst effect is one icon served from cache rather than fetched. Surfaced as a follow-up ticket.

## Evidence

- `server/test/api/internal-routes.test.ts` gains tests for: the clear emptying the cache and the next request fetching again (one fetch before, a second after), an empty cache answering 200, all four guard refusals returning `403 write_forbidden`, an I/O failure returning `save_failed`, and the route being absent without an icon service. The route-table tests cover the new row, including the bad-Host 403 loop over every write route.
- Server `bun test`: 963 pass, 17 skip, 1 fail. The failure is the Lua 5.3/5.4 version check, since stock Lua is not installed here. `bun run --workspaces typecheck` and `bunx biome check server` are clean.
