import type {
  Adapter,
  AdapterState,
  Range,
  ReadOutcome,
} from "../../src/adapter/types";
import { emeraldMemory, serve, TREECKO } from "./emerald-memory";

export const CONNECTED: AdapterState = {
  connection: "connected",
  bridge: null,
  problem: null,
  game: {
    platform: "gba",
    crc32: "1f1c08fb",
    sha1: null,
    romName: "Emerald",
    domains: { rom: 0x400, ewram: 0x40000, iwram: 0x8000 },
  },
  gameEpoch: 1,
};

/** Serves synthetic Emerald memory unless a test scripts the next answers. */
export class ScriptedAdapter implements Adapter {
  readonly id = "mgba";
  readonly limits = { minIntervalMs: 0, mergeGap: 32 };
  state: AdapterState = CONNECTED;
  #listeners = new Set<(state: AdapterState) => void>();
  memory = emeraldMemory([TREECKO]);
  /** Answers a request instead of the memory. Returns null to serve it. */
  respond: (ranges: readonly Range[]) => ReadOutcome | null = () => null;
  reads = 0;
  scripted = 0;

  subscribe(listener: (state: AdapterState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  set(state: AdapterState): void {
    this.state = state;
    for (const listener of this.#listeners) listener(state);
  }

  async read(ranges: readonly Range[]): Promise<ReadOutcome> {
    this.reads++;
    const answer = this.respond(ranges);
    if (answer) {
      this.scripted++;
      return answer;
    }
    return {
      kind: "data",
      slices: ranges.map((range) => serve(this.memory, [range])),
    };
  }
}
