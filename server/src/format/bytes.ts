/**
 * A read-only view over one slice. Getters take offsets from the slice's start and throw a
 * RangeError when out of bounds, which is a layout bug.
 */
export class Bytes {
  readonly length: number;
  readonly #view: DataView;
  readonly #bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
    this.length = bytes.length;
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  }

  #check(offset: number, size: number): void {
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset + size > this.length
    ) {
      throw new RangeError(
        `read of ${size} bytes at ${offset} is outside a slice of ${this.length}`,
      );
    }
  }

  u8(offset: number): number {
    this.#check(offset, 1);
    return this.#view.getUint8(offset);
  }

  u16le(offset: number): number {
    this.#check(offset, 2);
    return this.#view.getUint16(offset, true);
  }

  u32le(offset: number): number {
    this.#check(offset, 4);
    return this.#view.getUint32(offset, true);
  }

  /** Takes `count` bits at `shift` from a value already read with an explicit-endian getter. */
  static bits(value: number, shift: number, count: number): number {
    return Math.floor(value / 2 ** shift) % 2 ** count;
  }

  sub(offset: number, length: number): Bytes {
    this.#check(offset, length);
    return new Bytes(this.#bytes.subarray(offset, offset + length));
  }

  raw(): Uint8Array {
    return this.#bytes;
  }
}
