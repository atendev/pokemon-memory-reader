# Connection screen details: decision report

Audit: Claude seat only (Gemini and GPT: not run). Round 1 approved, score 8, four minor problems declined.

## Decisions

1. **How the viewer learns the program's protocol number.**
   - Options: add `protocol` to `GET /about`; add it to `/adapters`; add it to `status`; hardcode it in the viewer.
   - Choice: `/about` gets `protocol`, filled from the server's `PROTOCOL` constant. The viewer already reads `/about`, the number is a build fact like the version, and it keeps the shared `status` resource unchanged. A hardcoded copy could drift from the server. By the main thread (implementer). The audit raised no objection.

2. **Where the older/newer comparison shows.**
   - Choice: in the headline text when the active adapter reports `protocol_mismatch`, and in each adapter row whose probe found one. A bridge lower than the program says "older" and a higher one says "newer". When the program's number isn't loaded yet, or the numbers match, the old wrong-version text stays. By the main thread.

3. **What the data-folder card does for a LAN reader.** `paths` is null for a non-loopback peer, so the card says to open the viewer on the host machine and shows no copy button. Matches the Paths section in Settings. By the main thread.

4. **Copy button.** A small `CopyButton` over a `copyText` helper that takes the clipboard as an argument. It reports `Copied` or a failure, since a page served over plain HTTP from another machine may not write to the clipboard. By the main thread.

5. **When the details load.** The connection screen polls `/about`, `/settings` and `/adapters` only while a game route shows it. Nothing renders when the program is unreachable, because those reads would fail too. By the main thread.

6. **Ticket 095, the update banner.** Ticket 085 built the banner globally in `App`, so it already shows on the connection screen. 095 needs no build here.

## Declined minor problems (Claude seat)

- Test passes `undefined` and relies on the runtime having no clipboard: the default parameter makes that the intended path, and the test says so.
- `aria-label` hides the "Copied" text and has no live region: the label names the action. A live region is a polish item, not part of this ticket.
- Polling starts while `status` is still loading: it lasts about one poll, then stops once a game is identified. Harmless.
- Test fixture cast with `as never`: matches the existing test style in `settings.test.tsx`.

## Checks

`bun test` passes 1593 with 18 skipped and one failure that predates this change: the Lua 5.3 test, since Lua 5.3 isn't installed on this machine (CI runs it). Typecheck on all workspaces, `biome ci`, and the compiled-executable tests (13 of 13, with the `/about` protocol checked) pass.
