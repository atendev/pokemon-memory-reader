import type { Range, ReadOutcome } from "../adapter/types";

/**
 * A multi-step read with no I/O of its own. The read loop drives it through the one request
 * slot: step(null) starts it, and each later call passes the outcome of the ranges the previous
 * step asked for (interfaces 004).
 */
export interface ReadJob<T> {
  step(
    previous: ReadOutcome | null,
  ): { readonly read: readonly Range[] } | { readonly done: T };
}

/** Drives a job to its end, one read at a time. */
export async function runJob<T>(
  job: ReadJob<T>,
  read: (ranges: readonly Range[]) => Promise<ReadOutcome>,
): Promise<T> {
  let step = job.step(null);
  while ("read" in step) step = job.step(await read(step.read));
  return step.done;
}
