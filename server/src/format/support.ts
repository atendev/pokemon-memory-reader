import { DATA_FORMATS, type DataFormatId } from "../profile/schema";

/** Which data formats the program serves, by `dataFormat` (spec §6.1). */
export type SupportFlags = Readonly<Record<DataFormatId, boolean>>;

/**
 * The committed `supported` flag per data format. A format may turn true only when its tier 1
 * states pass with their fields verified on every primary revision (spec §12.8), and the coverage
 * guard test fails when one does without that. A format with no verified fixtures ships false, and
 * its resources answer 503 `unsupported`.
 */
export const SUPPORTED: SupportFlags = {
  gen1: false,
  gen2: false,
  gen3: false,
  cfru: false,
};

/**
 * Reads `PMR_ASSUME_SUPPORTED`, a comma-separated list of data formats to serve although their
 * flag is false. It is for developers working on a decoder before its fixtures exist, and for the
 * compiled-executable test. Names that aren't a data format come back in `unknown`.
 */
export function assumeSupported(
  value: string | undefined,
  base: SupportFlags = SUPPORTED,
): { flags: SupportFlags; assumed: DataFormatId[]; unknown: string[] } {
  const names = (value ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  const known = (name: string): name is DataFormatId =>
    (DATA_FORMATS as readonly string[]).includes(name);
  const assumed = names.filter(known);
  return {
    flags: { ...base, ...Object.fromEntries(assumed.map((f) => [f, true])) },
    assumed,
    unknown: names.filter((name) => !known(name)),
  };
}

/** A data format this build doesn't know is never supported. */
export function isSupported(flags: SupportFlags, dataFormat: string): boolean {
  return (flags as Readonly<Record<string, boolean>>)[dataFormat] === true;
}
