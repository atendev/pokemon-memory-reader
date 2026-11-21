import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import type { Log } from "../log";
import type { PickKey } from "./pick-keys";

const PICKS_VERSION = 1;

/** `manual-picks.json` (amendment 014 §5). */
const picksFile = z.object({
  version: z.literal(PICKS_VERSION),
  picks: z.record(z.string(), z.object({ profileId: z.string().min(1) })),
});

/** A pick the store holds: the key it sits under and the profile it names. */
export interface StoredPick {
  readonly key: PickKey;
  readonly profileId: string;
}

export interface PickStore {
  /** The first of `keys`, in the order given, that holds a pick. */
  lookup(keys: readonly PickKey[]): StoredPick | null;
  /** Saves `profileId` under every key. False when the file couldn't be written, so the pick lasts for the session only. */
  save(keys: readonly PickKey[], profileId: string): Promise<boolean>;
  /** Removes every key's entry. False when the file couldn't be written. */
  forget(keys: readonly PickKey[]): Promise<boolean>;
}

type Entries = Record<string, { profileId: string }>;

/**
 * The picks file, kept in memory and written through. A save re-reads the file, applies its change
 * over what the file holds so another instance's picks survive, writes a temp file in the same
 * folder and renames it over the original (spec §9.6). A malformed file is renamed to `.bad` and
 * replaced with empty state, so the old picks stay recoverable.
 */
export async function openPickStore(
  path: string,
  log: Log,
): Promise<PickStore> {
  const quarantine = async (why: string): Promise<void> => {
    log.warn(`${path} ${why}, so it is renamed to ${path}.bad`);
    await rename(path, `${path}.bad`).catch((error) =>
      log.error(`could not rename ${path} to ${path}.bad`, { error }),
    );
  };

  /** The file's picks. A missing file is empty, a malformed one is quarantined, a newer or unreadable one throws. */
  async function load(): Promise<Entries> {
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") return {};
      throw error;
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      await quarantine("is not valid JSON");
      return {};
    }
    const parsed = picksFile.safeParse(json);
    if (!parsed.success) {
      await quarantine("does not hold manual picks");
      return {};
    }
    return parsed.data.picks;
  }

  let entries: Entries = await load().catch((error) => {
    log.error(`could not read ${path}`, { error });
    return {};
  });

  async function write(change: (current: Entries) => void): Promise<boolean> {
    const temp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    try {
      const current = await load();
      change(current);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(
        temp,
        `${JSON.stringify({ version: PICKS_VERSION, picks: current }, null, 2)}\n`,
      );
      await rename(temp, path);
      entries = current;
      return true;
    } catch (error) {
      await rm(temp, { force: true }).catch(() => {});
      log.error(`could not save ${path}`, { error });
      return false;
    }
  }

  /** Whatever the file failed to take still applies for this run, so the pick works until the program exits. */
  const remember = (change: (current: Entries) => void): void => {
    entries = { ...entries };
    change(entries);
  };

  return {
    lookup(keys) {
      for (const key of keys) {
        const found = entries[key];
        if (found) return { key, profileId: found.profileId };
      }
      return null;
    },
    async save(keys, profileId) {
      const apply = (current: Entries) => {
        for (const key of keys) current[key] = { profileId };
      };
      const saved = await write(apply);
      if (!saved) remember(apply);
      return saved;
    },
    async forget(keys) {
      const apply = (current: Entries) => {
        for (const key of keys) delete current[key];
      };
      const saved = await write(apply);
      if (!saved) remember(apply);
      return saved;
    },
  };
}

/** The store of a run with no picks file: nothing is found and nothing is saved, so picks last for the session only. */
export const noPickStore: PickStore = {
  lookup: () => null,
  save: () => Promise.resolve(false),
  forget: () => Promise.resolve(false),
};
