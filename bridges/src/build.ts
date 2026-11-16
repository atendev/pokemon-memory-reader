import { isIP } from "node:net";
import { resolve } from "node:path";

export interface BridgeSettings {
  /** An IPv4 or IPv6 literal. The bridge binds to exactly this address (spec §4.1). */
  readonly host: string;
  readonly port: number;
  /** The app version the bridge came from. It appears in the hello. */
  readonly build: string;
}

const SOURCE = resolve(import.meta.dir);

const WILDCARDS = new Set(["0.0.0.0", "::", "0:0:0:0:0:0:0:0"]);

/** Throws on settings that would not survive being written into Lua source. */
export function checkSettings(settings: BridgeSettings): void {
  const { host, port, build } = settings;
  if (isIP(host) === 0 || WILDCARDS.has(host)) {
    throw new Error(
      `bridge host must be an IPv4 or IPv6 literal, not a name or a wildcard: ${host}`,
    );
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`bridge port must be an integer from 1 to 65535: ${port}`);
  }
  if (!/^[0-9A-Za-z.+-]+$/.test(build)) {
    throw new Error(
      `bridge build text has characters a version never has: ${build}`,
    );
  }
}

/** Joins the protocol core and one emulator shim into a single Lua file (spec §4.9). */
export async function buildBridge(
  name: "mgba",
  settings: BridgeSettings,
): Promise<string> {
  checkSettings(settings);
  const core = await Bun.file(`${SOURCE}/core.lua`).text();
  const shim = await Bun.file(`${SOURCE}/${name}-shim.lua`).text();
  const filled = shim
    .replace("@HOST@", settings.host)
    .replace("@PORT@", String(settings.port))
    .replace("@BUILD@", settings.build);
  // The core sits in a function so its locals don't count against the shim's 200-local limit.
  return [
    `-- ${name}.lua, generated from the Pokemon Memory Reader ${settings.build} sources. Do not edit.`,
    "local core = (function()",
    core,
    "end)()",
    filled,
    "",
  ].join("\n");
}
