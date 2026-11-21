import type { UpdateBody } from "@pokemon-memory-reader/internal/update";
import type { Clock } from "../clock";
import type { Config } from "../config";
import type { Log } from "../log";
import { compareSemver, parseSemver, type Semver } from "./semver";

/** Spec §9.8: a check at startup and then every 24 hours. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Turning the setting on live schedules a check shortly after. */
export const ENABLE_DELAY_MS = 5000;
const REQUEST_TIMEOUT_MS = 10_000;

export interface UpdateChecker {
  /** What `GET /update` serves. Never calls GitHub. */
  state(): UpdateBody;
  /** Schedules the first check. Call it once the server is listening. */
  start(): void;
  /** Applies a live `updateCheck` change (spec §9.8). */
  setEnabled(enabled: boolean): void;
  /** Runs one check now and resolves when it is done. It never rejects. */
  checkNow(): Promise<void>;
  close(): void;
}

export interface UpdateCheckerDeps {
  /** This build's version, such as `2.0.0-rc.1`. */
  readonly current: string;
  readonly enabled: boolean;
  /** The release list URL, `https://api.github.com/repos/{owner}/{repo}/releases`. */
  readonly feedUrl: string;
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  readonly clock: Clock;
  readonly log: Log;
  /** Called once per newer version found, for the console line. */
  readonly onNewer?: (latest: { version: string; url: string }) => void;
}

interface Candidate {
  readonly version: string;
  readonly parsed: Semver;
  readonly url: string;
  /** GitHub's own flag or a prerelease part in the version. */
  readonly prerelease: boolean;
}

/** App releases only: `v` plus a semver version, so `api-v*` and `v1-lua` never count. Drafts are ignored. */
function candidates(feed: unknown): Candidate[] | null {
  if (!Array.isArray(feed)) return null;
  const found: Candidate[] = [];
  for (const entry of feed as unknown[]) {
    if (typeof entry !== "object" || entry === null) continue;
    const { tag_name, html_url, draft, prerelease } = entry as Record<
      string,
      unknown
    >;
    if (typeof tag_name !== "string" || typeof html_url !== "string") continue;
    if (draft === true || !tag_name.startsWith("v")) continue;
    const version = tag_name.slice(1);
    const parsed = parseSemver(version);
    if (parsed)
      found.push({
        version,
        parsed,
        url: html_url,
        prerelease: prerelease === true || parsed.pre.length > 0,
      });
  }
  return found;
}

/**
 * The §9.8 update check. It lists the releases, picks the newest one this build may upgrade to
 * and remembers it. A stable build compares only against stable releases, a prerelease build
 * against all of them. A failed check changes nothing and logs only under `--debug`.
 */
export function createUpdateChecker(deps: UpdateCheckerDeps): UpdateChecker {
  const { clock, log } = deps;
  const current = parseSemver(deps.current);
  let enabled = deps.enabled;
  let latest: { version: string; url: string } | null = null;
  let checkedAt: string | null = null;
  let cancel: (() => void) | null = null;
  // Bumped whenever the setting flips, so a check that was in flight when it was turned off is dropped.
  let epoch = 0;
  let announced: string | null = null;
  let closed = false;

  const schedule = (ms: number) => {
    cancel?.();
    cancel = clock.setTimeout(() => {
      void checkNow();
    }, ms);
  };

  async function checkNow(): Promise<void> {
    if (!enabled || closed || current === null) return;
    const mine = epoch;
    try {
      const response = await deps.fetch(deps.feedUrl, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": `pokemon-memory-reader/${deps.current}`,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`the feed answered ${response.status}`);
      const found = candidates(await response.json());
      if (found === null) throw new Error("the feed is not a release list");
      if (mine !== epoch || closed) return;
      const eligible = found.filter(
        (c) => current.pre.length > 0 || !c.prerelease,
      );
      const newest = eligible.reduce<Candidate | null>(
        (best, c) =>
          best === null || compareSemver(c.parsed, best.parsed) > 0 ? c : best,
        null,
      );
      latest =
        newest !== null && compareSemver(newest.parsed, current) > 0
          ? { version: newest.version, url: newest.url }
          : null;
      checkedAt = new Date(clock.now()).toISOString();
      if (latest !== null && announced !== latest.version) {
        announced = latest.version;
        deps.onNewer?.(latest);
      }
    } catch (error) {
      log.debug("update check failed", { error });
    } finally {
      if (mine === epoch && enabled && !closed) schedule(CHECK_INTERVAL_MS);
    }
  }

  return {
    state: () => ({
      enabled,
      current: deps.current,
      latest: enabled ? latest : null,
      checkedAt,
    }),
    start() {
      if (enabled) void checkNow();
    },
    setEnabled(next) {
      if (next === enabled) return;
      enabled = next;
      epoch++;
      cancel?.();
      cancel = null;
      if (next) schedule(ENABLE_DELAY_MS);
    },
    checkNow,
    close() {
      closed = true;
      cancel?.();
      cancel = null;
    },
  };
}

/** Applies a live `updateCheck` change from the config to the checker (spec §9.8). Returns the unsubscribe function. */
export function followUpdateSetting(
  config: Pick<Config, "onLive">,
  checker: Pick<UpdateChecker, "setEnabled">,
  allowed: boolean,
): () => void {
  return config.onLive((live, changed) => {
    if (changed.includes("updateCheck"))
      checker.setEnabled(live.updateCheck && allowed);
  });
}
