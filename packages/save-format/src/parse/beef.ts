/**
 * Gen 6/7 BEEF-block helpers (XY/ORAS/SM/USUM).
 * Public layout: blocks tagged with little-endian magic 0x46454542 ('BEEF').
 */

export const BEEF_MAGIC = 0x46454542;

export interface BeefBlock {
  /** Absolute offset of the block header in the save. */
  offset: number;
  /** Payload length (bytes after header fields). */
  length: number;
  /** Raw payload bytes. */
  data: Uint8Array;
}

function readU32(data: Uint8Array, off: number): number {
  return (
    (data[off]! |
      (data[off + 1]! << 8) |
      (data[off + 2]! << 16) |
      (data[off + 3]! << 24)) >>>
    0
  );
}

function readU16(data: Uint8Array, off: number): number {
  return data[off]! | (data[off + 1]! << 8);
}

/**
 * Scan for BEEF markers. Header layout used by community docs:
 *   +0x00: magic 'BEEF'
 *   +0x04: u16 length (payload)
 *   +0x06: u16 reserved / flags
 *   +0x08: payload…
 * Returns blocks with plausible lengths only.
 */
export function findBeefBlocks(save: Uint8Array, maxBlocks = 64): BeefBlock[] {
  const blocks: BeefBlock[] = [];
  const limit = save.length - 8;
  for (let i = 0; i < limit && blocks.length < maxBlocks; i++) {
    if (readU32(save, i) !== BEEF_MAGIC) continue;
    const length = readU16(save, i + 4);
    if (length === 0 || length > 0x80000) continue;
    if (i + 8 + length > save.length) continue;
    blocks.push({
      offset: i,
      length,
      data: save.subarray(i + 8, i + 8 + length),
    });
    // Skip past this block to avoid overlapping false positives inside payload.
    i += 7 + length;
  }
  return blocks;
}

/** Simple 16-bit additive checksum over 16-bit words (used in some Gen6 footers). */
export function beefChecksum16(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i + 1 < data.length; i += 2) {
    sum = (sum + readU16(data, i)) & 0xffff;
  }
  if (data.length & 1) sum = (sum + data[data.length - 1]!) & 0xffff;
  return sum;
}

/**
 * Validate a BEEF block when a trailing u16 checksum is present at payload end.
 * Returns true if no checksum region or if it matches.
 */
export function validateBeefBlock(block: BeefBlock): boolean {
  if (block.data.length < 2) return true;
  const body = block.data.subarray(0, block.data.length - 2);
  const stored = readU16(block.data, block.data.length - 2);
  // Many blocks do not use this scheme — only fail when stored is non-zero and mismatched.
  if (stored === 0) return true;
  return beefChecksum16(body) === stored;
}
