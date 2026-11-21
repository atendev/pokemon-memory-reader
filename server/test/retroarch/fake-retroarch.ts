import type { udp } from "bun";

/** The memory a fake core maps: a base bus address and its bytes. Reads can't span two entries. */
export interface Descriptor {
  readonly start: number;
  readonly bytes: Uint8Array;
}

export const EMERALD_STATUS =
  "GET_STATUS PLAYING gba,Pokemon - Emerald Version";

/**
 * A TypeScript RetroArch for adapter tests. It listens on UDP, answers `GET_STATUS` and
 * `READ_CORE_MEMORY` in RetroArch's reply format, and lets a test stay silent, drop single
 * datagrams or clamp replies on purpose.
 */
export class FakeRetroArch {
  /** The reply to GET_STATUS. null stays silent. */
  status: string | null = EMERALD_STATUS;
  /** The memory descriptors the core maps. A read has to sit inside one. */
  descriptors: Descriptor[] = [];
  /** Answers nothing at all while true. */
  silent = false;
  /** Every datagram that arrived, in order. */
  readonly seen: string[] = [];
  /** Decides per datagram whether to drop it unanswered. */
  drop: (command: string) => boolean = () => false;
  #socket: udp.Socket<"buffer"> | null = null;
  #client: { port: number; address: string } | null = null;

  get port(): number {
    if (!this.#socket) throw new Error("the fake is not started");
    return this.#socket.port;
  }

  get reads(): string[] {
    return this.seen.filter((c) => c.startsWith("READ_CORE_MEMORY"));
  }

  get statuses(): string[] {
    return this.seen.filter((c) => c === "GET_STATUS");
  }

  async start(): Promise<void> {
    this.#socket = await Bun.udpSocket({
      hostname: "127.0.0.1",
      port: 0,
      socket: {
        data: (socket, data, port, address) => {
          const command = new TextDecoder().decode(data).trim();
          this.seen.push(command);
          this.#client = { port, address };
          if (this.silent || this.drop(command)) return;
          const reply = this.answer(command);
          if (reply !== null) socket.send(reply, port, address);
        },
      },
    });
  }

  /** Sends an unprompted datagram to the last client. */
  push(text: string): void {
    if (this.#client)
      this.#socket?.send(text, this.#client.port, this.#client.address);
  }

  stop(): void {
    this.#socket?.close();
    this.#socket = null;
  }

  answer(command: string): string | null {
    if (command === "GET_STATUS") return this.status;
    const match = /^READ_CORE_MEMORY ([0-9a-f]+) (\d+)$/.exec(command);
    if (!match) return null;
    const address = Number.parseInt(match[1] ?? "", 16);
    const count = Number(match[2]);
    const descriptor = this.descriptors.find(
      (d) => address >= d.start && address < d.start + d.bytes.length,
    );
    if (!descriptor) return `READ_CORE_MEMORY ${match[1]} -1`;
    const from = address - descriptor.start;
    // Like 1.22.2, clamp at the end of the descriptor instead of failing.
    const bytes = descriptor.bytes.subarray(from, from + count);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `READ_CORE_MEMORY ${match[1]} ${hex.join(" ")}`;
  }
}

/** The descriptors the mGBA core publishes for a GBA game (spec §3.4). */
export function gbaDescriptors(memory: {
  rom: Uint8Array;
  ewram: Uint8Array;
  iwram: Uint8Array;
}): Descriptor[] {
  return [
    { start: 0x02000000, bytes: memory.ewram },
    { start: 0x03000000, bytes: memory.iwram },
    { start: 0x08000000, bytes: memory.rom },
  ];
}
