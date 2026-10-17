/**
 * DeSmuME / compatible .dsv footer helpers.
 * Footer layout (trailing bytes):
 *   ... save payload ...
 *   24 bytes metadata (version, sizes, etc. — we preserve or synthesize conservatively)
 *   magic: "|-DESMUME SAVE-|" (16 bytes)
 *
 * Many tools only need the magic present at EOF to treat a file as .dsv.
 * We strip from the magic marker when converting to raw .sav.
 */

export const DESMUME_MAGIC = Buffer.from("|-DESMUME SAVE-|", "ascii");

/** Minimal footer: 24 zero bytes + magic (common enough for melonDS/DeSmuME imports). */
export const DESMUME_FOOTER_LENGTH = 24 + DESMUME_MAGIC.length;

export function findDesmumeMagicOffset(data: Buffer): number {
  if (data.length < DESMUME_MAGIC.length) return -1;
  const start = Math.max(0, data.length - 256);
  for (let i = data.length - DESMUME_MAGIC.length; i >= start; i--) {
    if (data.subarray(i, i + DESMUME_MAGIC.length).equals(DESMUME_MAGIC)) {
      return i;
    }
  }
  return -1;
}

export function hasDesmumeFooter(data: Buffer): boolean {
  return findDesmumeMagicOffset(data) >= 0;
}

/** Payload length before DeSmuME footer (footer starts 24 bytes before magic when present). */
export function desmumePayloadLength(data: Buffer): number {
  const magicAt = findDesmumeMagicOffset(data);
  if (magicAt < 0) return data.length;
  const footerStart = Math.max(0, magicAt - 24);
  return footerStart;
}

export function stripDesmumeFooter(data: Buffer): Buffer {
  const len = desmumePayloadLength(data);
  return Buffer.from(data.subarray(0, len));
}

export function appendDesmumeFooter(rawSav: Buffer): Buffer {
  const meta = Buffer.alloc(24, 0);
  // Byte 0-3: version-ish marker used by some tools (0)
  // Remaining zeros are acceptable for a synthetic footer.
  return Buffer.concat([rawSav, meta, DESMUME_MAGIC]);
}
