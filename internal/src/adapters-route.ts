import { z } from "zod";

export const ADAPTER_IDS = ["mgba", "retroarch", "bizhawk"] as const;
export const adapterId = z.enum(ADAPTER_IDS);

/** What one probe found (amendment 021, item 5). */
export const PROBE_RESULTS = [
  "live",
  "usable",
  "busy",
  "refused",
  "no_reply",
  "problem",
  "not_probed",
] as const;
export const probeResult = z.enum(PROBE_RESULTS);
export type ProbeResult = z.infer<typeof probeResult>;

const hello = z.object({
  bridge: z.string(),
  protocol: z.number().int(),
  build: z.string().nullable(),
  emulator: z
    .object({ name: z.string(), version: z.string().nullable() })
    .nullable(),
});

/** `GET /adapters`, and the body `POST /adapters/probe` returns (amendment 021, item 5). Priority order. */
export const adaptersBody = z.object({
  mode: z.enum(["auto", "pinned"]),
  live: adapterId.nullable(),
  adapters: z.array(
    z.object({
      id: adapterId,
      endpoint: z.object({ host: z.string(), port: z.number().int() }),
      live: z.boolean(),
      /** The adapter's bridge script was installed for an earlier endpoint and no script has connected to the current one since. Always false for an adapter with no script. */
      scriptStale: z.boolean(),
      probe: z.object({
        result: probeResult,
        bridge: hello.nullable(),
        problem: z
          .enum(["unknown_bridge", "protocol_mismatch", "bridge_error"])
          .nullable(),
        checkedAt: z.string().nullable(),
      }),
    }),
  ),
});
export type AdaptersBody = z.infer<typeof adaptersBody>;

/** `POST /adapters/switch` (amendment 021, item 7). */
export const switchRequest = z.object({ id: adapterId });
export const switchResponse = z.object({ live: adapterId });
export type SwitchResponse = z.infer<typeof switchResponse>;
