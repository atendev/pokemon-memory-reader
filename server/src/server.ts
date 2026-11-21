import { DEFAULT_HOST, DEFAULT_PORT } from "@pokemon-memory-reader/api/client";
import { DEFAULT_POLL_HZ } from "@pokemon-memory-reader/internal/config";
import type { HTMLBundle } from "bun";
import type { Adapter } from "./adapter/types";
import { type AboutInfo, createApp } from "./app/app";
import { createStreamHub } from "./app/stream";
import { type Clock, systemClock } from "./clock";
import type { Config } from "./config";
import type { IconService } from "./icons/service";
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
  /** Default 20, from the config's `pollHz`. */
  readonly pollHz?: number;
  /** Bridge source by name, served at `/bridges/<name>.lua`. */
  readonly bridges?: Readonly<Record<string, string>>;
  /** The viewer's HTML import. Served at `/`, with its scripts and styles. Without it `/` is a 404. */
  readonly viewer?: HTMLBundle;
  /** The settings this run uses. Without it there are no `/settings` routes. */
  readonly config?: Config;
  /** Without it there are no `/about` routes. */
  readonly about?: AboutInfo;
  /** The `/icons` lookup. Without it there is no `/icons` route. */
  readonly icons?: IconService;
  /** `--debug`: adds `/debug/read`. */
  readonly debug?: boolean;
  readonly clock?: Clock;
  readonly log?: Log;
}

export interface RunningServer {
  readonly host: string;
  readonly port: number;
  /** Applies a live `pollHz` change from the next tick. */
  setPollHz(hz: number): void;
  stop(): Promise<void>;
}

/** Wires the read loop to the HTTP app and starts listening. */
export function startServer(options: ServerOptions): RunningServer {
  const log = options.log ?? silentLog;
  const loop = createReadLoop({
    adapter: options.adapter,
    registry: options.registry,
    pollHz: options.pollHz ?? DEFAULT_POLL_HZ,
    clock: options.clock ?? systemClock,
    log,
  });
  const stream = createStreamHub({
    source: loop,
    clock: options.clock ?? systemClock,
    log,
  });
  const app = createApp({
    resources: loop,
    stream,
    bridges: options.bridges,
    log,
    config: options.config,
    about: options.about,
    icons: options.icons,
    ...(options.debug ? { rawRead: loop.rawRead } : {}),
    // The Host checks read the address the server really listens on, which port 0 only picks once it is up.
    listening: () => ({
      host: server.hostname ?? options.host ?? DEFAULT_HOST,
      port: server.port ?? options.port ?? DEFAULT_PORT,
    }),
  });
  const server = Bun.serve({
    hostname: options.host ?? DEFAULT_HOST,
    port: options.port ?? DEFAULT_PORT,
    ...(options.viewer ? { routes: { "/": options.viewer } } : {}),
    fetch: app.fetch,
  });
  return {
    host: server.hostname ?? DEFAULT_HOST,
    port: server.port ?? DEFAULT_PORT,
    setPollHz: loop.setPollHz,
    async stop() {
      stream.close();
      await server.stop(true);
      await loop.close();
    },
  };
}
