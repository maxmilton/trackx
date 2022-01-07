declare module 'xxhash-addon' {
  /** @see <https://github.com/ktrongnhan/xxhash-addon#xxhash3> */
  export class XXHash3 {
    constructor(seed: number | Buffer);

    /** Produces hash. */
    hash(buf: Buffer): Buffer;

    /** Updates internal state for stream hashing. */
    update(buf?: Buffer): Buffer;

    /** Produces hash of a stream. */
    digest(): Buffer;

    /**
     * Resets internal state. You can use this rather than creating another
     * hasher instance.
     */
    reset(): void;
  }
}
