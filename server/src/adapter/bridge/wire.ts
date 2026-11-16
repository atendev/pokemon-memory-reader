import type { Domain } from "@pokemon-memory-reader/internal/memory";
import {
  DOMAIN_CODES,
  FRAME_HEADER_BYTES,
  FRAME_KIND,
  type FrameKindName,
  MAX_BODY,
  RANGE_BYTES,
} from "./constants";

export interface Frame {
  readonly kind: number;
  readonly id: number;
  readonly body: Uint8Array;
}

export interface Range {
  readonly domain: Domain;
  readonly offset: number;
  readonly length: number;
}

const KIND_NAMES = new Map<number, FrameKindName>(
  (Object.keys(FRAME_KIND) as FrameKindName[]).map((name) => [
    FRAME_KIND[name],
    name,
  ]),
);
const DOMAIN_BY_CODE = new Map<number, Domain>(
  (Object.keys(DOMAIN_CODES) as Domain[]).map((domain) => [
    DOMAIN_CODES[domain],
    domain,
  ]),
);

export function kindName(kind: number): FrameKindName | undefined {
  return KIND_NAMES.get(kind);
}

/** Every frame is `u32 length | u8 kind | u32 id | body`, big-endian (spec §4.2). */
export function encodeFrame(
  kind: number,
  id: number,
  body: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(4 + FRAME_HEADER_BYTES + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, FRAME_HEADER_BYTES + body.length);
  view.setUint8(4, kind);
  view.setUint32(5, id);
  out.set(body, 9);
  return out;
}

/** A READ body: a u16 range count, then `u8 domain | u32 offset | u32 length` per range (spec §4.4). */
export function encodeReadBody(ranges: readonly Range[]): Uint8Array {
  const out = new Uint8Array(2 + RANGE_BYTES * ranges.length);
  const view = new DataView(out.buffer);
  view.setUint16(0, ranges.length);
  ranges.forEach((range, i) => {
    const at = 2 + RANGE_BYTES * i;
    view.setUint8(at, DOMAIN_CODES[range.domain]);
    view.setUint32(at + 1, range.offset);
    view.setUint32(at + 5, range.length);
  });
  return out;
}

/** Reads a READ body, for fake bridges. Domain codes outside the table are kept as numbers. */
export function decodeReadBody(body: Uint8Array):
  | {
      readonly ranges: readonly {
        code: number;
        domain: Domain | undefined;
        offset: number;
        length: number;
      }[];
    }
  | { readonly badFrame: string } {
  if (body.length < 2)
    return { badFrame: "READ body is shorter than its range count" };
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const count = view.getUint16(0);
  if (body.length !== 2 + RANGE_BYTES * count) {
    return {
      badFrame: `READ body holds ${body.length} bytes but ${count} ranges need ${2 + RANGE_BYTES * count}`,
    };
  }
  const ranges = [];
  for (let i = 0; i < count; i++) {
    const at = 2 + RANGE_BYTES * i;
    const code = view.getUint8(at);
    ranges.push({
      code,
      domain: DOMAIN_BY_CODE.get(code),
      offset: view.getUint32(at + 1),
      length: view.getUint32(at + 5),
    });
  }
  return { ranges };
}

/** Request ids start at 1 on each connection, go up by one and skip 0 when they wrap (spec §4.2). */
export function createRequestIds(after = 0): () => number {
  let last = after;
  return () => {
    last = last >= 0xffffffff ? 1 : last + 1;
    return last;
  };
}

/** Hand-written incremental frame decoder. A bad frame stops it for good (spec §4.2). */
export class FrameDecoder {
  #buffer: Uint8Array = new Uint8Array(0);
  #bad: string | null = null;

  /** `badFrame` is set when the stream broke. `frames` still holds every valid frame parsed before the break, so the caller delivers them and closes in one step. */
  push(chunk: Uint8Array): {
    readonly frames: readonly Frame[];
    readonly badFrame: string | null;
  } {
    if (this.#bad !== null) return { frames: [], badFrame: this.#bad };
    if (this.#buffer.length === 0) {
      this.#buffer = chunk.slice();
    } else {
      const joined = new Uint8Array(this.#buffer.length + chunk.length);
      joined.set(this.#buffer);
      joined.set(chunk, this.#buffer.length);
      this.#buffer = joined;
    }
    const frames: Frame[] = [];
    for (;;) {
      const buf = this.#buffer;
      if (buf.length < 4) break;
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const length = view.getUint32(0);
      if (length < FRAME_HEADER_BYTES) {
        return this.#fail(
          frames,
          `length ${length} is below the ${FRAME_HEADER_BYTES} header bytes`,
        );
      }
      if (buf.length < 5) break;
      const kind = view.getUint8(4);
      const name = KIND_NAMES.get(kind);
      if (name === undefined)
        return this.#fail(frames, `unknown frame kind ${kind}`);
      if (length > MAX_BODY[name] + FRAME_HEADER_BYTES) {
        return this.#fail(
          frames,
          `${name} frame length ${length} exceeds its ${MAX_BODY[name]} byte body limit`,
        );
      }
      if (buf.length < 4 + length) break;
      frames.push({
        kind,
        id: view.getUint32(5),
        body: buf.slice(9, 4 + length),
      });
      this.#buffer = buf.subarray(4 + length);
    }
    return { frames, badFrame: null };
  }

  #fail(
    frames: readonly Frame[],
    reason: string,
  ): { readonly frames: readonly Frame[]; readonly badFrame: string } {
    this.#bad = reason;
    this.#buffer = new Uint8Array(0);
    return { frames, badFrame: reason };
  }
}
