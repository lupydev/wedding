/**
 * Opaque invitation slugs.
 *
 * The slug is the only thing standing between a leaked URL and someone else's
 * invitation card, so it is random rather than derived: it never encodes the
 * invitation's sequential id.
 *
 * Randomness is INJECTED, not sourced here (design decision D2). This module is
 * a pure encoder, which is what keeps `lib/domain/**` free of `node:crypto` and
 * testable under `environment: 'node'` with no mocking at all. The server
 * adapter supplies `randomBytes(SLUG_BYTE_LENGTH)`.
 */

/**
 * 10 bytes = 80 bits of entropy, above the required 64, and the one length that
 * encodes to whole base32 characters (80 / 5 = 16) with no padding and no
 * truncation bias.
 */
export const SLUG_BYTE_LENGTH = 10;

/** 16 base32 characters, matching the DB check `slug ~ '^[a-z2-7]{16}$'`. */
export const SLUG_LENGTH = 16;

/** RFC 4648 base32, lowercased. Excludes 0, 1, 8 and 9. */
const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

const BITS_PER_CHARACTER = 5;

const SLUG_PATTERN = /^[a-z2-7]{16}$/;

/**
 * Encodes exactly `SLUG_BYTE_LENGTH` random bytes as an unpadded base32 slug.
 *
 * Rejects any other length rather than padding or truncating: a shorter slug is
 * a silently weaker one, and the entropy guarantee is the point.
 */
export function encodeSlug(bytes: Uint8Array): string {
  if (bytes.length !== SLUG_BYTE_LENGTH) {
    throw new Error(
      `encodeSlug requires exactly SLUG_BYTE_LENGTH (10 bytes), received ${bytes.length}`,
    );
  }

  let out = "";
  let buffer = 0;
  let bitsInBuffer = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsInBuffer += 8;

    while (bitsInBuffer >= BITS_PER_CHARACTER) {
      bitsInBuffer -= BITS_PER_CHARACTER;
      out += ALPHABET[(buffer >> bitsInBuffer) & 0b11111];
    }
  }

  return out;
}

/**
 * Is this string shaped like a slug?
 *
 * Used before any lookup so a malformed path segment never reaches the database,
 * and so an unknown slug and a malformed one take the same code path.
 */
export function isWellFormedSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}
