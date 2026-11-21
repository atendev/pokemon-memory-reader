# Pointer-derived regions in the read loop: decision report

Ticket: [Pointer-derived regions in the read loop](../tickets/062-pointer-derived-regions.md) (task). Code: `server/src/loop/plan.ts`, `server/src/loop/read-loop.ts`, tests in `server/test/loop/`.

## Run

- The parent wayfinder-master session ran the Jev audit, so this child skipped it.
- The master's overrides replaced the commit gate and CI. The branch never merges, and CI runs on the merged batch.
- Council: the Claude seat only. The Gemini and GPT seats were skipped (out of quota). The Claude seat approved in round 3 of 5 with a score of 8.
- Local checks: `bun test server` passes 273 tests, with one unrelated failure (the Lua bridge test expects Lua 5.3 or 5.4 and this machine has 5.5). `tsc` and `biome ci` are clean.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|---|---|---|---|---|
| 1 | Where does the pointer logic live? | In the loop; in the planner as a job | The planner. `readBatch(parts, options)` returns a `ReadJob`, which `runJob` drives through the one request slot. The loop only supplies a cache and a platform. | Main thread | Approved |
| 2 | How does the box ticket ask for it? | A separate box function; the same job with its own cache | The same `readBatch`, with its own `PointerCache`. Caches are per request, so a box pointer move never touches the main batch. | Main thread | Approved |
| 3 | Where are known pointer values kept? | Per loop; per session | Per `Session`, so any game change or disconnect forgets them and the next cycle sends two requests. | Main thread | Approved |
| 4 | What does a word that was never read look like, against a word that read 0? | One "unset" state; two states | Two. A missing entry is unknown and triggers the two-request attach. A read of 0 is known and null, so the cycle stays at one request and the part fails with `null_pointer`. | Main thread | Approved |
| 5 | What happens to a part whose pointer moved? | Decode with the new bytes; drop for the cycle | Drop for the cycle (`pointer_moved`). The cache takes the new value, so the next cycle reads the new address. The loop keeps its last value, as it does for any skipped cycle. | Spec §8.5 | Approved |
| 6 | How does one part fail without failing others? | One result for the whole batch; a result per part | `slices(part)` returns `{ ok, slices }` or `{ ok: false, reason }` per part, with reasons `range_failed`, `null_pointer`, `pointer_moved` and `pointer_unread`. | Main thread | Approved |
| 7 | Do pointer targets merge with static ranges? | Merge everything; keep targets apart | A target merges only with other targets of the same pointer word. A bad pointer can aim outside its domain, and a failed range fails everything merged into it. Round 1 found this, and a mutation check shows the test catches it. | Claude seat, round 1 | Fixed |
| 8 | How do loop tests cover a pointer when only the static party topic exists? | Wait for the player ticket; inject a fake game | A `bind` dependency on `createReadLoop`, defaulting to `bindGame`. Tests inject a pointer-backed party. | Main thread | Approved |
| 9 | Does the phase-1 request read only unknown words? | Unknown words only; all words | All pointer words of the batch, as spec §8.5 says "pointer words only". | Spec §8.5 | Approved |

## Declined minor problems

- `game.platform === "other"` returns early in the cycle. Identification already refuses that platform, so a bound game never has it, and the guard only narrows the type. Raised by the Claude seat in rounds 1 and 3.
- The loop-level null-pointer test has one decoder, so on its own it cannot show "only". After demand lapses the GET is cold, so the null pointer is the cause of the `no_data`, not age expiry. The planner test "a null pointer fails only the parts that use it" covers the "only" part with two parts. Raised in round 3.

## Audit rounds

| Round | Claude seat | Problems | Outcome |
|---|---|---|---|
| 1 | DISAPPROVE, 7 | 1 blocking (target merge), 3 minor | Fixed the blocking one, the comment and the box test. Declined the platform guard. |
| 2 | DISAPPROVE, 7 | 1 blocking (the new test proved nothing) | Rewrote the test with separate parts and added a mutation check. |
| 3 | APPROVE, 8 | 2 minor | Declined, with the reasons above. |

Gemini and GPT seats skipped (out of quota).
