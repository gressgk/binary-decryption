/* ==========================================================================
   random.js — random numbers and ids. Uses crypto.getRandomValues when present.
   ========================================================================== */
const Rand = (() => {
  // No look-alike characters (0/O, 1/I).
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  /** Unbiased integer in [0, max). */
  function int(max) {
    const crypto = globalThis.crypto;
    if (crypto && crypto.getRandomValues) {
      const range = 0x100000000;
      const limit = range - (range % max);
      const buffer = new Uint32Array(1);
      do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
      return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  /** A binary value of `bits` bits, never zero: 1 .. 2^bits - 1. */
  const binaryValue = bits => 1 + int((1 << bits) - 1);

  function code(length) {
    let out = '';
    for (let i = 0; i < length; i++) out += CODE_ALPHABET[int(CODE_ALPHABET.length)];
    return out;
  }

  /** A short id such as "T-4K9Q" that is not in `takenIds`. */
  function id(prefix, takenIds) {
    let candidate;
    do { candidate = `${prefix}-${code(4)}`; } while (takenIds.includes(candidate));
    return candidate;
  }

  return { int, binaryValue, code, id };
})();
