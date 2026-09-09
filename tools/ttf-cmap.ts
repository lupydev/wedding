/**
 * Minimal TrueType character-map reader, for tests only.
 *
 * It answers one question: does this font have a glyph for this codepoint?
 * That is precisely the condition Satori uses to decide between drawing a
 * character and drawing tofu, so it is what the Open Graph card's font
 * coverage test needs — and nothing more. It is deliberately not a font
 * library: no shaping, no metrics, no rendering.
 *
 * Supported subtable formats are 4 (BMP ranges) and 12 (full Unicode), which
 * together cover every font this project could plausibly ship.
 */

const CMAP_TAG = "cmap";
const OFFSET_TABLE_SIZE = 12;
const TABLE_RECORD_SIZE = 16;

interface Reader {
  readonly uint8: Uint8Array;
  readonly view: DataView;
}

function toReader(font: Uint8Array): Reader {
  return {
    uint8: font,
    view: new DataView(font.buffer, font.byteOffset, font.byteLength),
  };
}

function readTag(reader: Reader, offset: number): string {
  return String.fromCharCode(...reader.uint8.subarray(offset, offset + 4));
}

/** Byte offset of the `cmap` table, or -1 when the font has none. */
function findCmapTable(reader: Reader): number {
  const tableCount = reader.view.getUint16(4);

  for (let index = 0; index < tableCount; index += 1) {
    const record = OFFSET_TABLE_SIZE + index * TABLE_RECORD_SIZE;

    if (readTag(reader, record) === CMAP_TAG) {
      return reader.view.getUint32(record + 8);
    }
  }

  return -1;
}

/**
 * Picks the subtable to read.
 *
 * Format 12 wins when present because it addresses the whole Unicode range;
 * format 4 is the near-universal BMP fallback. Any other format is ignored
 * rather than guessed at.
 */
function findSubtable(
  reader: Reader,
  cmapOffset: number,
): { offset: number; format: number } | null {
  const subtableCount = reader.view.getUint16(cmapOffset + 2);
  let format4: number | null = null;

  for (let index = 0; index < subtableCount; index += 1) {
    const record = cmapOffset + 4 + index * 8;
    const subtable = cmapOffset + reader.view.getUint32(record + 4);
    const format = reader.view.getUint16(subtable);

    if (format === 12) {
      return { offset: subtable, format };
    }

    if (format === 4 && format4 === null) {
      format4 = subtable;
    }
  }

  return format4 === null ? null : { offset: format4, format: 4 };
}

function lookupFormat4(
  reader: Reader,
  subtable: number,
  codepoint: number,
): number {
  if (codepoint > 0xffff) {
    return 0;
  }

  const segCountX2 = reader.view.getUint16(subtable + 6);
  const endOffset = subtable + 14;
  const startOffset = endOffset + segCountX2 + 2;
  const deltaOffset = startOffset + segCountX2;
  const rangeOffset = deltaOffset + segCountX2;

  for (let segment = 0; segment < segCountX2 / 2; segment += 1) {
    const end = reader.view.getUint16(endOffset + segment * 2);

    if (codepoint > end) {
      continue;
    }

    const start = reader.view.getUint16(startOffset + segment * 2);

    if (codepoint < start) {
      return 0;
    }

    const delta = reader.view.getInt16(deltaOffset + segment * 2);
    const range = reader.view.getUint16(rangeOffset + segment * 2);

    if (range === 0) {
      return (codepoint + delta) & 0xffff;
    }

    const glyphOffset =
      rangeOffset + segment * 2 + range + (codepoint - start) * 2;
    const glyph = reader.view.getUint16(glyphOffset);

    return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
  }

  return 0;
}

function lookupFormat12(
  reader: Reader,
  subtable: number,
  codepoint: number,
): number {
  const groupCount = reader.view.getUint32(subtable + 12);

  for (let group = 0; group < groupCount; group += 1) {
    const record = subtable + 16 + group * 12;
    const start = reader.view.getUint32(record);
    const end = reader.view.getUint32(record + 4);

    if (codepoint >= start && codepoint <= end) {
      return reader.view.getUint32(record + 8) + (codepoint - start);
    }
  }

  return 0;
}

/**
 * Glyph id for `codepoint` in `font`, or `0` when the font has no glyph for it.
 *
 * Glyph id 0 is `.notdef` by specification — the box a renderer draws when it
 * cannot draw the character. Returning it is therefore the same answer as
 * "this would render as tofu".
 */
export function glyphIdForCodepoint(
  font: Uint8Array,
  codepoint: number,
): number {
  const reader = toReader(font);
  const cmapOffset = findCmapTable(reader);

  if (cmapOffset === -1) {
    throw new Error("The font has no cmap table, so it maps no characters.");
  }

  const subtable = findSubtable(reader, cmapOffset);

  if (subtable === null) {
    throw new Error(
      "The font's cmap has no format 4 or format 12 subtable, so its coverage cannot be read.",
    );
  }

  return subtable.format === 12
    ? lookupFormat12(reader, subtable.offset, codepoint)
    : lookupFormat4(reader, subtable.offset, codepoint);
}
