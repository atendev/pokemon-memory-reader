import { DEFAULT_HOST, DEFAULT_PORT } from "@pokemon-memory-reader/api/client";
import type { Adapter } from "./adapter/types";
import { createApp } from "./app/app";
import { type Clock, systemClock } from "./clock";
import { type Log, silentLog } from "./log";
import { createReadLoop } from "./loop/read-loop";
import type { ProfileRegistry } from "./profile/registry";

export interface ServerOptions {
  readonly adapter: Adapter;
  readonly registry: ProfileRegistry;
  /** Default 127.0.0.1. */
  readonly host?: string;
  /** Default 7425. 0 picks a free port. */
  readonly port?: number;
  /** Default 20. */
  readonly pollHz?: number;
  readonly clock?: Clock;
  readonly log?: Log;
}

export interface RunningServer {
  readonly host: string;
  readonly port: number;
  stop(): Promise<void>;
}

/** Wires the read loop to the HTTP app and starts listening. Config, flags and the data folder arrive with the config ticket. */
export function startServer(options: ServerOptions): RunningServer {
  const log = options.log ?? silentLog;
  const loop = createReadLoop({
    adapter: options.adapter,
    registry: options.registry,
    pollHz: options.pollHz ?? 20,
    clock: options.clock ?? systemClock,
    log,
  });
  const app = createApp({ resources: loop, log });
  const server = Bun.serve({
    hostname: options.host ?? DEFAULT_HOST,
    port: options.port ?? DEFAULT_PORT,
    fetch: app.fetch,
  });
  return {
    host: server.hostname ?? DEFAULT_HOST,
    port: server.port ?? DEFAULT_PORT,
    async stop() {
      await server.stop(true);
      await loop.close();
    },
  };
}
