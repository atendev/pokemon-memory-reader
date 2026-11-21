import type { SupportFlags } from "../../src/format/support";

/** Every data format supported. Tests that decode a format before its fixtures exist pass this (spec §6.1). */
export const ALL_SUPPORTED: SupportFlags = {
  gen1: true,
  gen2: true,
  gen3: true,
  cfru: true,
};
