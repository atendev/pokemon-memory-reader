import type { Log } from "../log";
import { type LoadInput, loadProfiles, type ProfileRegistry } from "./registry";

export type StartupProfiles =
  | { readonly ok: true; readonly registry: ProfileRegistry }
  | { readonly ok: false; readonly message: string };

/**
 * Loads every profile for server startup. A built-in problem means the build is broken, so it
 * returns a message for the caller to print before exiting. User problems are logged and skipped.
 */
export function loadStartupProfiles(
  input: LoadInput,
  log: Log,
): StartupProfiles {
  const { registry, problems } = loadProfiles(input);
  const broken = problems.filter((problem) => problem.source === "builtin");
  if (broken.length > 0) {
    const lines = broken.map((p) => `  ${p.path}: ${p.message}`);
    return {
      ok: false,
      message: `Built-in profile failed to load, this build is broken:\n${lines.join("\n")}`,
    };
  }
  for (const problem of problems)
    log.warn(`profile ${problem.path}: ${problem.message}`);
  return { ok: true, registry };
}
