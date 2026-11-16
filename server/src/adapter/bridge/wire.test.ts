import { expect, test } from "bun:test";
import { FRAME_KIND, MAX_BODY } from "./constants";
import {
  createRequestIds,
  decodeReadBody,
  encodeFrame,
  encodeReadBody,
  FrameDecoder,
} from "./wire";

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const frames = (result: ReturnType<FrameDecoder["push"]>) => {
  if (result.badFrame !== null) throw new Error(result.badFrame);
  return result.frames;
};

test("encodeFrame writes length, kind and id big-endian", () => {
  expect(
    hex(encodeFrame(FRAME_KIND.READ, 0x01020304, Uint8Array.of(0xaa, 0xbb))),
  ).toBe("000000070301020304aabb");
});

test("encodeReadBody writes the count, then domain, offset and length per range", () => {
  expect(
    hex(
      encodeReadBody([
        { domain: "rom", offset: 0x08, length: 4 },
        { domain: "ewram", offset: 0x0100, length: 0x20 },
      ]),
    ),
  ).toBe(
    "0002" + "01" + "00000008" + "00000004" + "02" + "00000100" + "00000020",
  );
});

test("decodeReadBody round trips and rejects a count that doesn't match the length", () => {
  const body = encodeReadBody([{ domain: "sram", offset: 5, length: 9 }]);
  expect(decodeReadBody(body)).toEqual({
    ranges: [{ code: 6, domain: "sram", offset: 5, length: 9 }],
  });
  expect("badFrame" in decodeReadBody(body.subarray(0, body.length - 1))).toBe(
    true,
  );
  expect("badFrame" in decodeReadBody(Uint8Array.of(0))).toBe(true);
});

test("the decoder yields frames split across chunks and several frames in one chunk", () => {
  const a = encodeFrame(FRAME_KIND.DATA, 1, Uint8Array.of(1, 2, 3));
  const b = encodeFrame(FRAME_KIND.ERROR, 0, new TextEncoder().encode("{}"));
  const joined = new Uint8Array([...a, ...b]);
  const decoder = new FrameDecoder();
  const out = [];
  for (const byte of joined)
    out.push(...frames(decoder.push(Uint8Array.of(byte))));
  expect(out.map((f) => [f.kind, f.id, f.body.length])).toEqual([
    [FRAME_KIND.DATA, 1, 3],
    [FRAME_KIND.ERROR, 0, 2],
  ]);
  expect(frames(new FrameDecoder().push(joined))).toHaveLength(2);
});

test("an empty body is a valid frame", () => {
  expect(
    frames(
      new FrameDecoder().push(
        encodeFrame(FRAME_KIND.GAME, 0, new Uint8Array(0)),
      ),
    ),
  ).toHaveLength(1);
});

test("a broken frame is a bad frame and the decoder stays stopped", () => {
  const cases: [string, Uint8Array][] = [
    ["length below the header", Uint8Array.of(0, 0, 0, 4, 1, 0, 0, 0, 0)],
    ["unknown kind 0", Uint8Array.of(0, 0, 0, 5, 0, 0, 0, 0, 0)],
    ["unknown kind 6", Uint8Array.of(0, 0, 0, 5, 6, 0, 0, 0, 0)],
    ["READ over its limit", Uint8Array.of(0, 0, 0x12, 0x08, FRAME_KIND.READ)],
    ["HELLO over its limit", Uint8Array.of(0, 0, 0x10, 0x06, FRAME_KIND.HELLO)],
  ];
  for (const [name, bytes] of cases) {
    const decoder = new FrameDecoder();
    expect(decoder.push(bytes).badFrame, name).not.toBeNull();
    const after = decoder.push(
      encodeFrame(FRAME_KIND.DATA, 1, new Uint8Array(0)),
    );
    expect(after.badFrame, name).not.toBeNull();
    expect(after.frames, name).toHaveLength(0);
  }
});

test("a frame at exactly its kind's limit is accepted and one byte over is not", () => {
  const at = encodeFrame(FRAME_KIND.DATA, 7, new Uint8Array(MAX_BODY.DATA));
  expect(frames(new FrameDecoder().push(at))).toHaveLength(1);
  const over = encodeFrame(
    FRAME_KIND.DATA,
    7,
    new Uint8Array(MAX_BODY.DATA + 1),
  );
  expect(new FrameDecoder().push(over.subarray(0, 9)).badFrame).not.toBeNull();
});

test("request ids start at 1 and skip 0 when they wrap", () => {
  const next = createRequestIds();
  expect([next(), next(), next()]).toEqual([1, 2, 3]);
  const wrapping = createRequestIds(0xfffffffe);
  expect([wrapping(), wrapping(), wrapping()]).toEqual([0xffffffff, 1, 2]);
});

test("valid frames ahead of a bad one in the same chunk are not lost", () => {
  const good = encodeFrame(FRAME_KIND.DATA, 3, Uint8Array.of(9));
  const decoder = new FrameDecoder();
  const first = decoder.push(
    new Uint8Array([...good, 0, 0, 0, 5, 9, 0, 0, 0, 0]),
  );
  expect(first.frames.map((f) => f.id)).toEqual([3]);
  expect(first.badFrame).not.toBeNull();
});
