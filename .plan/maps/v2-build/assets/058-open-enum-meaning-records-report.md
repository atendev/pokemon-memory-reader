# Report: open-enum meaning records and append-only test

Ticket: [Open-enum meaning records and append-only test](../tickets/058-open-enum-meaning-records.md). It builds [amendment 035](./035-open-enum-value-removal.md). No grilling ran, because the amendment settled the design. The council approved in round 2 (claude 8, gemini 10, gpt 9).

## What changed

- `api/src/meanings.ts` is new. It holds one record per open enum: `ERROR_CODES`, `DATA_FORMATS`, `ADAPTER_IDS`, `BRIDGE_IDS`, `ADAPTER_PROBLEMS` and `TOPIC_NAMES`, gathered in `OPEN_ENUMS`. Each name maps to a one-line meaning and an optional `retiredIn`. The file imports nothing.
- `api/src/types.ts` derives the known unions from the record keys with `import type`. It exports `KnownErrorCode`, `ErrorCode` and the matching pairs for data format, adapter id, bridge id and adapter problem. `Topic` is `keyof typeof TOPIC_NAMES`. The fields `error.code`, `game.dataFormat`, `adapter.id`, `adapter.bridge.bridge` and `adapter.problem` now use the open types.
- `api/src/schemas.ts` validates those fields with `z.custom<T>` that accepts any string, so the schemas still parse unknown names and the sync pairs still hold. `TOPICS` is `Object.keys(TOPIC_NAMES)`.
- `api/src/open-enums.test.ts` is new. It checks that every record entry has a one-line meaning, unit-tests the append-only check on synthetic baselines, runs the check against `api/open-enums.baseline.json` and skips with a console warning while that file is absent, and checks the contract docs.
- `api/scripts/open-enums.ts` is new. It holds the comparison function, the docs renderer, and a CLI with `baseline` and `docs` commands.
- `docs/open-enums.md` is new. It lists the open enums by hand, holds the rendered records between two markers, and describes how to keep the records append-only.
- `server/test/api/open-enums.test.ts` is new. It checks that every error code, adapter id, adapter problem, bridge name, topic and data format the server can emit has a record. `helloStrict` in `messages.ts` is now exported for it.
- `schemas.test.ts` skips `custom` nodes in its closed-enum walk. `scripts/api-consumer-smoke.ts` also typechecks `ErrorCode` and `KnownErrorCode` from the packed tarball.

## Decisions

**D1. Where the records live.** Options: in `types.ts`, in `schemas.ts`, or in a new file. Chosen: `api/src/meanings.ts`, imported by type only from `types.ts`. `/types` stays free of runtime code and of `zod`, and `schemas.ts` reads the topic record at run time. Made by the implementer.

**D2. Whether the records are a public subpath.** Options: a fourth export `./meanings`, or internal. Chosen: internal. `package.test.ts` pins three subpaths, and the amendment doesn't ask for a runtime export. The server test reaches the file through the root tsconfig path mapping, like its other API imports. Made by the implementer.

**D3. How the schemas stay string-valued and typed open.** Options: `z.string()` with a cast, `z.custom<T>`, or a Zod refinement over a union. Chosen: `z.custom<T>` with a string check, so inference gives the open union exactly and the sync test's strict `Equal` holds. Made by the implementer.

**D4. `Topic` stays closed.** Options: make `Topic` open like the others, or keep it the known union. Chosen: the known union, because `ResourceMap`, `resourceSchemas` and the client signatures key on it. No schema carries an unknown topic yet. Made by the implementer. A claude seat note asked for a ticket mention. It is declined, and the type's comment records it.

**D5. Baseline and test form.** The baseline is a JSON file made by `bun api/scripts/open-enums.ts baseline`, and the test skips with a warning until it exists, as the amendment says. The comparison is a pure function tested on synthetic baselines, so the removal, rename, meaning-edit and `retiredIn` cases fail in this repo today. Made by the implementer. I also wrote a baseline by hand, edited a meaning, saw the failure, and removed the file.

**D6. Contract docs and the coverage check.** `docs/open-enums.md` has a hand-written list of enums and a generated block of records. The test requires the list to equal the record keys and the block to equal the render. The render uses bullets, not tables, because Biome reformats Markdown tables and would make the block drift. Made by the implementer.

**D7. `RELEASING.md` does not exist yet.** Options: create it here, or write the step in the docs page and surface a ticket. Chosen: the docs page carries the step, and a ticket is surfaced to move it into `RELEASING.md` once the file exists. Creating it here would collide with the ticket that owns it and its LGPL lines. Made by the implementer.

**D8. Meaning texts.** Error code meanings use the "When" column of spec §7.2 and the wording of amendment 020 for `no_data` and `invalid_topics`. Problem meanings follow spec §4.7. A phrase that would age ("boxes are not served yet") was cut, because meaning text is frozen once a stable release ships it. Made by the implementer.

## Audit

Round 1: claude 6 (disapprove), gemini 10, gpt 6 (disapprove).

- Claude's blocking problem was that the server emission test missed `bridgeId` and `topic`. Fixed in the main thread: the test now reads the bridge names from `helloStrict` and the topics from `resourceSchemas`. `not_found` and `invalid_topics` have no emitter in the server yet, and a comment says so.
- GPT's blocking problem was that `documentedEnums` scans the generated bullets. Rebutted with evidence: the records sit under a separate `## Records` heading, and running the function on the docs file returns exactly the six enum names. GPT dropped it in round 2.

Round 2: claude 8, gemini 10, gpt 9. Approved.

Declined minor problems, all raised by one seat (claude), for these reasons:

- `Topic` has no `(string & {})`: see D4.
- The `meanings` subpath is not listed in the README: see D2.
- `TOPICS` changed from a tuple to `readonly Topic[]`: `(typeof TOPICS)[number]` is still `Topic`, which `sync.test.ts` checks.
- The append-only test cannot fail against a real baseline until one exists: see D5.
- Deleting the baseline after `api-v2.0.0` turns the check into a skip: the amendment makes the skip depend on the file's absence, and the docs say review guards every edit to that file.
- The docs cite a `RELEASING.md` step before the file exists: see D7.

## Evidence

- `bun run typecheck` and `biome ci` pass. `bun test` gives 512 passes, 1 skip and 1 failure. The failure is the Lua 5.3 test, because this machine has no `lua5.3` binary, and it is unrelated to the diff.
- `publint` reports "All good". `attw --profile esm-only` is green. The packed-tarball consumer smoke passes under `nodenext` and `bundler`.
