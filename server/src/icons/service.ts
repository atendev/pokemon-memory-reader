import { createHash } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Settings } from "@pokemon-memory-reader/internal/config";
import { type Clock, systemClock } from "../clock";
import type { DataPaths } from "../data-folder";
import { type Log, silentLog } from "../log";
import type { ProfileRegistry } from "../profile/registry";
import type { IconKey } from "./keys";
import { DEFAULT_MAPS, type IconMaps, planIcon } from "./plan";
import { isServablePng, MAX_ICON_BYTES } from "./png";
import {
  fallbackUrl,
  type IconSource,
  resolveSource,
  upstreamUrl,
} from "./source";

type Png = Uint8Array<ArrayBuffer>;

const FETCH_TIMEOUT_MS = 5_000;
const MAX_PARALLEL_FETCHES = 4;
const BACKOFF_MS = 60_000;

export interface IconImage {
  readonly bytes: Png;
  /** The quoted content hash. */
  readonly etag: string;
}

export interface IconService {
  /** Null means 404: off, an unknown profile, an unmapped ID, or no file anywhere the mode allows. */
  get(key: IconKey): Promise<IconImage | null>;
  /** Deletes every cache folder except the source in use. Run once at startup. */
  pruneCache(): Promise<void>;
  /** Deletes every source folder under `icon-cache/` and forgets the remembered misses. */
  clearCache(): Promise<void>;
}

export interface IconServiceOptions {
  readonly paths: Pick<DataPaths, "iconsFolder" | "iconCacheFolder">;
  readonly registry: Pick<ProfileRegistry, "get">;
  /** Read on every request, so a live `icons` change applies at once. */
  readonly settings: () => Settings["icons"];
  readonly fetch?: typeof fetch;
  readonly clock?: Clock;
  readonly log?: Log;
  readonly maps?: IconMaps;
  /** Default 5000. */
  readonly fetchTimeoutMs?: number;
}

const absolute = (folder: string, path: string) =>
  join(folder, ...path.split("/"));

const isMissingFile = (error: unknown) =>
  (error as { code?: string }).code === "ENOENT";

/** Reads at most `max` bytes of a body, or null when it is longer. */
async function readCapped(
  response: Response,
  max: number,
): Promise<Png | null> {
  const declared = Number(response.headers.get("content-length"));
  if (declared > max) return null;
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Png[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

/**
 * The `/icons` lookup (spec §11.9): the icon pack, then `icon-cache/`, then upstream when the mode
 * is `online`. Only PNGs of 512 KB or less that pass the magic-byte check are served.
 */
export function createIconService(options: IconServiceOptions): IconService {
  const { paths, registry } = options;
  const log = options.log ?? silentLog;
  const clock = options.clock ?? systemClock;
  const maps = options.maps ?? DEFAULT_MAPS;
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.fetchTimeoutMs ?? FETCH_TIMEOUT_MS;

  /** `sourceId/path` of upstream files that answered 404 or failed the check, for this run. */
  const missing = new Set<string>();
  /** When each source may be tried again after a network error. */
  const backoffUntil = new Map<string, number>();
  const inFlight = new Map<string, Promise<Png | null>>();
  const warnedPackFiles = new Set<string>();
  let running = 0;
  const waiting: Array<() => void> = [];
  let tempCounter = 0;

  const acquire = async () => {
    if (running >= MAX_PARALLEL_FETCHES)
      await new Promise<void>((resolve) => waiting.push(resolve));
    else running++;
  };
  // A finished fetch hands its slot to the next waiter, so `running` only drops when nobody waits.
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else running--;
  };

  const image = (bytes: Png): IconImage => ({
    bytes,
    etag: `"${createHash("sha1").update(bytes).digest("hex")}"`,
  });

  async function readPack(path: string): Promise<Png | null> {
    const file = absolute(paths.iconsFolder, path);
    let bytes: Png;
    try {
      bytes = await readFile(file);
    } catch (error) {
      if (!isMissingFile(error) && !warnedPackFiles.has(file)) {
        warnedPackFiles.add(file);
        log.warn(`icon pack file ${file} could not be read`, { error });
      }
      return null;
    }
    if (isServablePng(bytes)) return bytes;
    if (!warnedPackFiles.has(file)) {
      warnedPackFiles.add(file);
      log.warn(
        `icon pack file ${file} is not a PNG of 512 KB or less, so it is ignored`,
      );
    }
    return null;
  }

  async function readCache(
    source: IconSource,
    path: string,
  ): Promise<Png | null> {
    const file = absolute(join(paths.iconCacheFolder, source.id), path);
    let bytes: Png;
    try {
      bytes = await readFile(file);
    } catch {
      return null;
    }
    if (isServablePng(bytes)) return bytes;
    await rm(file, { force: true }).catch(() => {});
    return null;
  }

  async function writeCache(
    source: IconSource,
    path: string,
    bytes: Png,
  ): Promise<void> {
    const file = absolute(join(paths.iconCacheFolder, source.id), path);
    const temp = `${file}.${process.pid}.${tempCounter++}.tmp`;
    try {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(temp, bytes);
      await rename(temp, file);
    } catch (error) {
      await rm(temp, { force: true }).catch(() => {});
      log.warn(`icon cache file ${file} could not be written`, { error });
    }
  }

  const send = (url: string) =>
    doFetch(url, { signal: AbortSignal.timeout(timeoutMs) });

  async function download(
    source: IconSource,
    path: string,
    memory: string,
  ): Promise<Png | null> {
    await acquire();
    try {
      let response: Response;
      try {
        response = await send(upstreamUrl(source, path));
        const second =
          response.status === 403 ? fallbackUrl(source, path) : null;
        if (second !== null) {
          await response.body?.cancel();
          response = await send(second);
        }
      } catch (error) {
        backoffUntil.set(source.id, clock.now() + BACKOFF_MS);
        log.warn(
          `icon source ${source.id} is unreachable, so it is skipped for 60 s`,
          { error },
        );
        return null;
      }
      if (response.status === 429 || response.status >= 500) {
        await response.body?.cancel();
        backoffUntil.set(source.id, clock.now() + BACKOFF_MS);
        log.warn(
          `icon source ${source.id} answered ${response.status}, so it is skipped for 60 s`,
        );
        return null;
      }
      if (!response.ok) {
        await response.body?.cancel();
        missing.add(memory);
        return null;
      }
      let bytes: Png | null;
      try {
        bytes = await readCapped(response, MAX_ICON_BYTES);
      } catch (error) {
        backoffUntil.set(source.id, clock.now() + BACKOFF_MS);
        log.warn(`icon source ${source.id} dropped a response`, { error });
        return null;
      }
      if (bytes === null || !isServablePng(bytes)) {
        missing.add(memory);
        log.warn(
          `icon source ${source.id} sent ${path}, which is not a PNG of 512 KB or less`,
        );
        return null;
      }
      await writeCache(source, path, bytes);
      return bytes;
    } finally {
      release();
    }
  }

  function fetchUpstream(
    source: IconSource,
    path: string,
  ): Promise<Png | null> {
    const memory = `${source.id}/${path}`;
    if (missing.has(memory)) return Promise.resolve(null);
    if ((backoffUntil.get(source.id) ?? 0) > clock.now())
      return Promise.resolve(null);
    const shared = inFlight.get(memory);
    if (shared) return shared;
    const started = download(source, path, memory).finally(() =>
      inFlight.delete(memory),
    );
    inFlight.set(memory, started);
    return started;
  }

  return {
    async get(key) {
      const { mode, baseUrl } = options.settings();
      if (mode === "off") return null;
      const profile = registry.get(key.profileId);
      if (!profile) return null;
      const plan = planIcon(profile, key, maps);
      if (!plan) return null;
      for (const path of plan.pack) {
        const bytes = await readPack(path);
        if (bytes) return image(bytes);
      }
      if (mode === "local" || plan.upstream === null) return null;
      const source = resolveSource(baseUrl);
      const cached = await readCache(source, plan.upstream);
      if (cached) return image(cached);
      const fetched = await fetchUpstream(source, plan.upstream);
      return fetched ? image(fetched) : null;
    },

    async pruneCache() {
      const keep = resolveSource(options.settings().baseUrl).id;
      try {
        const entries = await readdir(paths.iconCacheFolder, {
          withFileTypes: true,
        });
        for (const entry of entries)
          if (entry.isDirectory() && entry.name !== keep)
            await rm(join(paths.iconCacheFolder, entry.name), {
              recursive: true,
              force: true,
            });
      } catch (error) {
        if (!isMissingFile(error))
          log.warn("could not clean the icon cache", { error });
      }
    },

    async clearCache() {
      missing.clear();
      const entries = await readdir(paths.iconCacheFolder, {
        withFileTypes: true,
      }).catch((error) => {
        if (isMissingFile(error)) return [];
        throw error;
      });
      for (const entry of entries)
        if (entry.isDirectory())
          await rm(join(paths.iconCacheFolder, entry.name), {
            recursive: true,
            force: true,
          });
    },
  };
}
