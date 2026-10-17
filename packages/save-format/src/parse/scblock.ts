/**
 * Gen 8/9 SCBlock helpers + SwishCrypto-style XOR layer.
 *
 * Block wire format and FNV-1a key hashing are publicly documented
 * (Project Pokémon / community research). Full retail SwishCrypto also uses
 * a 127-byte static XOR pad and SHA-256 intro/outro salts from the game binary;
 * those constants are not vendored here — callers may supply a pad, or parse
 * an already-decrypted block stream (tests / exported dumps).
 */

import { createHash } from "node:crypto";

/** SCTypeCode values used in Switch save blocks. */
export enum SCTypeCode {
  None = 0,
  Bool1 = 1,
  Bool2 = 2,
  Bool3 = 3,
  Object = 4,
  Array = 5,
  Byte = 8,
  UInt16 = 9,
  UInt32 = 10,
  UInt64 = 11,
  SByte = 12,
  Int16 = 13,
  Int32 = 14,
  Int64 = 15,
  Single = 16,
  Double = 17,
}

export interface SCBlock {
  key: number;
  type: SCTypeCode;
  data: Uint8Array;
}

/** FNV-1a 32-bit (basis 0x811C9DC5, prime 0x01000193) over UTF-8 / ASCII key names. */
export function fnv1a32(name: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Published block key hashes (name → FNV) used across SwSh / BDSP / LA / SV. */
export const BLOCK_KEYS = {
  MONEY: 0x19e41e69, // FNV("MONEY") — SV / shared
  /** SwSh MyStatus-like trainer block (public research key). */
  MY_STATUS_SWSH: 0xf7d4a45d,
  PLAY_TIME: fnv1a32("Played"),
  PARTY: fnv1a32("Party"),
  BOX: fnv1a32("BoxLay"),
} as const;

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

function primitiveSize(type: SCTypeCode): number {
  switch (type) {
    case SCTypeCode.Bool1:
    case SCTypeCode.Bool2:
    case SCTypeCode.Bool3:
    case SCTypeCode.Byte:
    case SCTypeCode.SByte:
      return 1;
    case SCTypeCode.UInt16:
    case SCTypeCode.Int16:
      return 2;
    case SCTypeCode.UInt32:
    case SCTypeCode.Int32:
    case SCTypeCode.Single:
      return 4;
    case SCTypeCode.UInt64:
    case SCTypeCode.Int64:
    case SCTypeCode.Double:
      return 8;
    default:
      return 0;
  }
}

/**
 * Parse an SCBlock stream (decrypted payload without trailing SHA-256).
 * Stops at EOF or when a None/invalid key pattern is hit.
 */
export function parseSCBlockStream(data: Uint8Array): SCBlock[] {
  const blocks: SCBlock[] = [];
  let o = 0;
  while (o + 5 <= data.length) {
    const key = readU32(data, o);
    const type = data[o + 4]! as SCTypeCode;
    o += 5;
    if (type === SCTypeCode.Object) {
      if (o + 4 > data.length) break;
      const len = readU32(data, o);
      o += 4;
      if (len > data.length - o || len > 0x200000) break;
      blocks.push({ key, type, data: data.subarray(o, o + len) });
      o += len;
      continue;
    }
    if (type === SCTypeCode.Array) {
      if (o + 4 > data.length) break;
      const count = readU32(data, o);
      o += 4;
      if (o >= data.length) break;
      const elemType = data[o]! as SCTypeCode;
      o += 1;
      const esize = primitiveSize(elemType);
      if (esize <= 0 || count > 0x100000) break;
      const nbytes = count * esize;
      if (nbytes > data.length - o) break;
      blocks.push({ key, type, data: data.subarray(o, o + nbytes) });
      o += nbytes;
      continue;
    }
    const size = primitiveSize(type);
    if (size <= 0) {
      // Unknown / end — stop cleanly.
      break;
    }
    if (o + size > data.length) break;
    blocks.push({ key, type, data: data.subarray(o, o + size) });
    o += size;
  }
  return blocks;
}

/** Build key → block map (last write wins). */
export function scBlockMap(blocks: SCBlock[]): Map<number, SCBlock> {
  const map = new Map<number, SCBlock>();
  for (const b of blocks) map.set(b.key >>> 0, b);
  return map;
}

/** Apply a repeating XOR pad (SwishCrypto-style). Same op encrypts and decrypts. */
export function cryptStaticXorpad(data: Uint8Array, pad: Uint8Array): Uint8Array {
  if (pad.length === 0) throw new Error("SCBlock XOR pad must be non-empty");
  const out = data.slice();
  for (let i = 0; i < out.length; i++) {
    out[i] = out[i]! ^ pad[i % pad.length]!;
  }
  return out;
}

/**
 * Optional SHA-256 footer check: hash(intro || payload || outro) === trailing 32 bytes.
 * When intro/outro are empty, compares hash(payload) for synthetic fixtures.
 */
export function isScHashValid(
  file: Uint8Array,
  intro: Uint8Array = new Uint8Array(0),
  outro: Uint8Array = new Uint8Array(0)
): boolean {
  if (file.length < 32) return false;
  const payload = file.subarray(0, file.length - 32);
  const stored = file.subarray(file.length - 32);
  const h = createHash("sha256");
  h.update(intro);
  h.update(payload);
  h.update(outro);
  const digest = h.digest();
  for (let i = 0; i < 32; i++) {
    if (digest[i] !== stored[i]) return false;
  }
  return true;
}

/**
 * Decrypt a SwishCrypto-wrapped save when a XOR pad is provided.
 * Verifies optional SHA-256 footer (empty intro/outro for test fixtures).
 */
export function decryptSCBlocks(
  file: Uint8Array,
  xorPad: Uint8Array,
  intro?: Uint8Array,
  outro?: Uint8Array
): Map<number, SCBlock> {
  if (!isScHashValid(file, intro, outro)) {
    throw new Error("SCBlock checksum/hash validation failed");
  }
  const payload = file.subarray(0, file.length - 32);
  const plain = cryptStaticXorpad(payload, xorPad);
  return scBlockMap(parseSCBlockStream(plain));
}

/** Read a u32 / u64 money-style value from a block. */
export function blockUint(block: SCBlock | undefined): number | null {
  if (!block || block.data.length < 1) return null;
  if (block.data.length >= 8) {
    // low 32 bits of u64
    return readU32(block.data, 0);
  }
  if (block.data.length >= 4) return readU32(block.data, 0);
  if (block.data.length >= 2) return readU16(block.data, 0);
  return block.data[0]!;
}

/** Encode a single Object SCBlock for fixtures. */
export function encodeObjectBlock(key: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(5 + 4 + payload.length);
  out[0] = key & 0xff;
  out[1] = (key >>> 8) & 0xff;
  out[2] = (key >>> 16) & 0xff;
  out[3] = (key >>> 24) & 0xff;
  out[4] = SCTypeCode.Object;
  const len = payload.length;
  out[5] = len & 0xff;
  out[6] = (len >>> 8) & 0xff;
  out[7] = (len >>> 16) & 0xff;
  out[8] = (len >>> 24) & 0xff;
  out.set(payload, 9);
  return out;
}

/** Encode a UInt32 SCBlock for fixtures. */
export function encodeU32Block(key: number, value: number): Uint8Array {
  const out = new Uint8Array(5 + 4);
  out[0] = key & 0xff;
  out[1] = (key >>> 8) & 0xff;
  out[2] = (key >>> 16) & 0xff;
  out[3] = (key >>> 24) & 0xff;
  out[4] = SCTypeCode.UInt32;
  out[5] = value & 0xff;
  out[6] = (value >>> 8) & 0xff;
  out[7] = (value >>> 16) & 0xff;
  out[8] = (value >>> 24) & 0xff;
  return out;
}
