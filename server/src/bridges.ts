import { buildBridge } from "../../bridges/src/build";
import { APP_VERSION } from "./version";

/** The bridges the program serves and installs, by the name in `/bridges/<name>.lua`. */
export const BRIDGE_NAMES = ["mgba"] as const;
export type BridgeName = (typeof BRIDGE_NAMES)[number];

/** Bridge source by name, or a function that reads the current sources. */
export type BridgeSources =
  | Readonly<Record<string, string>>
  | (() => Readonly<Record<string, string>>);

export interface BridgeEndpoint {
  readonly host: string;
  readonly port: number;
}

/** Generates every bridge with its endpoint filled in (spec §4.1, §4.11). */
export async function generateBridges(
  endpoints: Readonly<Record<BridgeName, BridgeEndpoint>>,
): Promise<Record<BridgeName, string>> {
  const entries = await Promise.all(
    BRIDGE_NAMES.map(
      async (name) =>
        [
          name,
          await buildBridge(name, { ...endpoints[name], build: APP_VERSION }),
        ] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<BridgeName, string>;
}
