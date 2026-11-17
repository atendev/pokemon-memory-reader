import { describe, expect, test } from "bun:test";
import { OPEN_ENUMS } from "@pokemon-memory-reader/api/meanings";
import { resourceSchemas } from "@pokemon-memory-reader/api/schemas";
import { helloStrict } from "../../src/adapter/bridge/messages";
import type { AdapterId, AdapterProblem } from "../../src/adapter/types";
import type { UnavailableCode } from "../../src/loop/read-loop";
import { DATA_FORMATS } from "../../src/profile/schema";

// Amendment 035: every value the server can emit has a meaning record in the API package. The
// codes the server doesn't produce yet (`not_found`, `invalid_topics`) get their line when the
// boxes route and the event stream land. Each typed object below must list every member of the
// server's union (`satisfies Record<…, true>` fails
// `bun run typecheck` on a missing or extra key), and the tests check each key against the record.
const emitted = {
  errorCode: {
    disconnected: true,
    no_game: true,
    unidentified: true,
    unsupported: true,
    no_data: true,
  } satisfies Record<UnavailableCode, true>,
  adapterId: {
    mgba: true,
    retroarch: true,
    bizhawk: true,
  } satisfies Record<AdapterId, true>,
  adapterProblem: {
    unknown_bridge: true,
    protocol_mismatch: true,
    busy: true,
    bridge_error: true,
  } satisfies Record<AdapterProblem, true>,
  bridgeId: Object.fromEntries(
    helloStrict.shape.bridge.options.map((id) => [id, true]),
  ),
  topic: Object.fromEntries(
    Object.keys(resourceSchemas).map((topic) => [topic, true]),
  ),
  dataFormat: Object.fromEntries(DATA_FORMATS.map((id) => [id, true])),
};

describe("every value the server emits has a meaning record", () => {
  for (const [enumName, values] of Object.entries(emitted)) {
    test(enumName, () => {
      const record = OPEN_ENUMS[enumName as keyof typeof emitted];
      for (const value of Object.keys(values)) {
        expect(Object.keys(record), `${enumName}.${value}`).toContain(value);
      }
    });
  }
});
