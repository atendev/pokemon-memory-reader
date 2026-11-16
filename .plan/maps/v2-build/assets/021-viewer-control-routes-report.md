# Decision report: Which routes serve the viewer's controls and info?

Ticket: [021](../tickets/021-viewer-control-routes.md). Output: [amendment 021](./021-viewer-control-routes.md). Decided in auto mode. The main thread wrote the questions, options and recommendations. A sonnet grilling subagent answered them in two rounds (27 questions), and a haiku auditor checked the amendment in three rounds. The final verdict is APPROVE (round 3).

## Grilling decisions

In the "Who" column, "Main" means the main thread recommended the choice and the grilling subagent accepted it. "Grill" means the grilling subagent added the choice as a constraint. Where no option was offered, the Options column shows "-".

| # | Question | Options | Choice | Who |
|---|---|---|---|---|
| Q1 | Namespace | root-level internal routes; new `/app/*` prefix with `/settings` moved; inside `/api/v2` | Root-level internal routes beside `/settings` and `/debug`, with contracts in `internal/` | Main |
| Q2 | Viewer URLs | hash routes; path routes with an SPA fallback | Hash routes. Every root-level path stays reserved for the server. | Main, plus a Grill constraint |
| Q3 | Adapter list | cached `GET /adapters`; GET runs a probe; public SSE topic | Cached `GET /adapters` with a 7-value `result`. A GET never probes, and a probe never touches the live endpoint or blocks the read loop. | Main, plus Grill constraints |
| Q4 | List freshness | poll every 2 s on the screens that show it; internal SSE | Poll every 2 s on those screens only | Main |
| Q5 | Switch | runtime-only `POST /adapters/switch`; switch writes a pin; both | Runtime-only, with no config write. A pin stays in `PUT /settings`. | Main |
| Q6 | Write guards | one shared guard; per-route guards | One shared guard with the four §9.5 checks, and a JSON body on every write | Main, plus a Grill constraint |
| Q7 | Error shape | `{ error }` without status; the public `{ error, status }` | `{ error: { code, message } }`, which also defines the `/settings` codes | Main, plus Grill codes |
| Q8 | CORS | none; `*` | No CORS on internal routes | Main |
| Q9 | Pick routes | server-derived key; REST by key; under `/settings` | `GET /manual-picks`, `POST /manual-picks`, `POST /manual-picks/forget`. The server derives the key. | Main |
| Q10 | Candidates | same platform; header matches only; all profiles | Same platform, header matches first, with `baseEligible` from the load path's function | Main, plus a Grill constraint |
| Q11 | When picks are allowed | `unidentified` or a manual match only; also override automatic matches | Only `unidentified` or a manual match. Forget re-identifies as one read-loop change. | Main, plus Grill codes |
| Q12 | Pick save failure | apply and report `saved: false`; refuse with 500 | Apply for the session, with `saved` and a `reason` | Main, plus a Grill constraint |
| Q13 | Version and notices | `GET /about` plus the notices file; fold into `/settings` | `GET /about` and `GET /about/third-party-notices.txt` (served with nosniff) | Main |
| Q14 | Update banner | `GET /update`; fold into `/about`; public topic | `GET /update` from cached state, with no GitHub call | Main |
| Q15 | Raw read | bus address; domain and offset; octet-stream | `GET /debug/read?address=&length=` using the 013 parser (GB `01:D163`), length 1-4096 | Main, plus Grill changes |
| Q16 | Debug guard | loopback peer and Host check; loopback peer only | Loopback peer and the Host check against the loopback names only, for `/debug/metrics` too | Main, plus a Grill constraint |
| Q17 | Settings fields | endpoints, `updateCheck` and `pollHz`; endpoints only; none | All three. The reload note shows for mGBA and BizHawk only. | Main |
| Q18 | Paths | add `paths` to `GET /settings`; put them on `/about` | `paths` on `GET /settings`, null for non-loopback peers | Main, plus a Grill constraint |
| R2-1 | Switch connect | new connection first; close the old one first; 202 | Connect and check while the old adapter stays live, then swap or return `adapter_connect_failed`. A second call gets `switch_in_progress`. | Main, plus a Grill constraint |
| R2-2 | Re-probe cadence | 007 backoff plus `POST /adapters/probe`; fixed 10 s; none while live | 007 backoff plus a guarded probe-now route that leaves the backoff alone. Overlapping probes share one run. | Main, plus Grill constraints |
| R2-3 | Icon paths on LAN | move them into `paths`; keep them public | Move them into `paths`. This fixes an inconsistency in the subagent's own Q18 answer. | Main |
| R2-4 | Codes | closed enum; open enum | Closed enum, with `switch_in_progress` and `invalid_request` added | Main, plus a Grill constraint |
| R2-5 | OBS overrides | both query forms; hash only; page only | Both forms, and the hash query wins on conflict | Main |
| R2-6 | Pick freshness | fetch on `status` changes; poll | Fetch on `status` changes and after the viewer's own writes | Main, plus a Grill constraint |
| R2-7 | Route table | Zod modules plus a route-table test; schemas only | Both, and the table test sends a bad Host to every guarded route | Main, plus a Grill constraint |
| R2-8 | Pinned list | others `not_probed`; probe the others for display | Others show `not_probed`, and probe-now returns `adapter_pinned` | Main |
| R2-9 | Gaps | - | Listing or forgetting other ROMs' picks waits for v2.x. Banner dismissal lives in localStorage. | Grill |

## Audit decisions

| Round | Objection | Fix | Who |
|---|---|---|---|
| 1 | The pick response `key` can't be non-null when `reason` is `no_key` | `key: string \| null`, null exactly on `no_key` | Auditor, fixed by Main |
| 1 | §11.4 already documents the page-query OBS form | Keep the page form and add the hash form as a §11.4 amendment | Auditor, fixed by Main |
| 1 | The raw-read queueing has no mechanism, and query errors have no code | The raw read runs between ticks in the one slot, `read_busy` is added, and `invalid_request` covers query errors | Auditor, fixed by Main |
| 1 | Two cases are missing: a probe during a switch, and a switch to the live adapter | A probe during a switch gets `switch_in_progress`, and a switch to the live adapter is a 200 no-op | Auditor, fixed by Main |
| 1 | No code covers a pick in other states | `pick_not_allowed` covers them, and the refusal order is stated | Auditor, fixed by Main |
| 1 | `probe.bridge` and `probe.problem` must be nullable | Both are nullable, and the text says when each is set | Auditor, fixed by Main |
| 1 | Embedding the notices file is a new build step | The build step is stated and listed under §13.5 | Auditor, fixed by Main |
| 1 | The debug routes don't exist without `--debug` | The route-table test runs with `--debug` | Auditor, fixed by Main |
| 2 | The live-adapter no-op conflicts with the pinned refusal | The no-op applies only while not pinned | Auditor, fixed by Main |
| 2 | `read_busy` doesn't cover a raw read that is already running | It now covers "queued or running", and the delay is bounded by the read timeout | Auditor, fixed by Main |
| 3 | - | APPROVE | Auditor |

## Gates

- The runner's confirmation gates were skipped under auto mode. The parent master's brief replaces the commit gate with "commit every time".
- No code changed. The ticket adds an amendment and this report. `spec.md` was left unedited, as the ticket asks.
