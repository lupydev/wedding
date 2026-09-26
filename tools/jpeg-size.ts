/**
 * Reads a JPEG's declared dimensions out of its own frame header.
 *
 * Hand-rolled because this repository has no image library: `sharp` is not a
 * dependency, and adding one to measure two numbers would be a build cost paid
 * on every install for a test. The parse is the marker walk every JPEG decoder
 * starts with — segments are `FF <marker> <2-byte length>`, and the frame
 * header (SOF) carries height then width as big-endian 16-bit values at a fixed
 * offset inside it.
 *
 * Reading the HEADER rather than trusting a filename is the point: a file named
 * `og-card.jpg` that is secretly 3000px wide would pass any assertion about its
 * name, and would be served to every crawler at that size.
 *
 * ONE PARSER, FOR THE REASON `photos.ts` GIVES FOR ONE PHOTOGRAPH. It lived
 * inside `og-card-asset-budget.spec.ts` while the card was the only committed
 * binary anybody measured. `img/venue-map.jpg` is a second, and a copied marker
 * walk is two decoders that agree until somebody fixes a bug in one of them.
 *
 * Every caller is expected to triangulate it against an asset of a DIFFERENT
 * shape, so a reader that returned a constant cannot sit green behind a file
 * that has been replaced with something else entirely.
 */
export function readJpegSize(bytes: Uint8Array): {
  width: number;
  height: number;
} {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("Not a JPEG: the file does not open with SOI (FF D8).");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset + 3 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      throw new Error(`Lost the marker stream at byte ${offset}.`);
    }

    const marker = bytes[offset + 1];

    // A run of fill bytes before a marker is legal padding, not a segment.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }

    const segmentLength = view.getUint16(offset + 2);

    // SOF0 through SOF15 all carry the frame header. Three markers share that
    // numeric range and carry something else entirely: DHT (C4), JPG (C8) and
    // DAC (CC). Reading dimensions out of a Huffman table would produce two
    // confident wrong numbers.
    const isFrameHeader =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isFrameHeader) {
      // Inside the segment: length (2), sample precision (1), height (2),
      // width (2). So height sits at +5 from the marker and width at +7.
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }

  throw new Error("No frame header: this JPEG declares no dimensions.");
}
