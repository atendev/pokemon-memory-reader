import type { Domain, Platform } from "@pokemon-memory-reader/internal/memory";
import {
  type FixtureFile,
  type RecordedRegion,
  recordedRegions,
} from "../fixture/file";
import type { DataFormatId } from "../profile/schema";
import type {
  Adapter,
  AdapterLimits,
  AdapterState,
  Range,
  ReadOutcome,
} from "./types";

const PLATFORMS: Record<DataFormatId, Platform> = {
  gen1: "gb",
  gen2: "gb",
  gen3: "gba",
  cfru: "gba",
};

const hex = (value: number): string => `0x${value.toString(16)}`;

/**
 * Serves a fixture's recorded regions through the adapter interface (spec §12.3). A read that
 * strays outside the recorded bytes rejects, so a decoder that reads undeclared memory fails
 * loudly. The fixture holds no ROM, so the state has no `rom` domain and a read of `rom` rejects. A
 * loader that treats the profile's ROM tables as missing (spec §12.2) is a later ticket.
 */
export class SliceAdapter implements Adapter {
  readonly id = "slice";
  /** A merged range never spans a gap, so it never reads bytes the capture skipped. */
  readonly limits: AdapterLimits = { minIntervalMs: 0, mergeGap: 0 };
  readonly state: AdapterState;
  readonly #regions: Map<Domain, RecordedRegion[]>;

  constructor(fixture: FixtureFile) {
    const regions = recordedRegions(fixture);
    this.#regions = new Map(
      [...Map.groupBy(regions, (r) => r.domain)].map(([domain, list]) => [
        domain,
        list.sort((a, b) => a.offset - b.offset),
      ]),
    );
    // The recorded extent per domain, not the emulator's real domain size.
    const domains: Partial<Record<Domain, number>> = {};
    for (const { domain, offset, bytes } of regions) {
      domains[domain] = Math.max(domains[domain] ?? 0, offset + bytes.length);
    }
    this.state = {
      connection: "connected",
      bridge: null,
      problem: null,
      game: {
        platform: PLATFORMS[fixture.dataFormat],
        crc32: null,
        sha1: null,
        romName: null,
        domains,
      },
      gameEpoch: 1,
    };
  }

  subscribe(): () => void {
    return () => {};
  }

  async read(
    ranges: readonly Range[],
    _timeoutMs?: number,
  ): Promise<ReadOutcome> {
    return { kind: "data", slices: ranges.map((range) => this.#slice(range)) };
  }

  /** The range's bytes from recorded regions that cover it end to end, or a throw. */
  #slice({ domain, offset, length }: Range): Uint8Array {
    const out = new Uint8Array(length);
    let at = offset;
    const end = offset + length;
    for (const region of this.#regions.get(domain) ?? []) {
      if (at >= end) break;
      const regionEnd = region.offset + region.bytes.length;
      if (regionEnd <= at) continue;
      if (region.offset > at) break;
      const take = Math.min(end, regionEnd);
      out.set(
        region.bytes.subarray(at - region.offset, take - region.offset),
        at - offset,
      );
      at = take;
    }
    if (at < end) {
      throw new Error(
        `SliceAdapter: read of ${domain} ${hex(offset)}..${hex(end)} reaches ${hex(at)}, which no recorded region covers`,
      );
    }
    return out;
  }
}
