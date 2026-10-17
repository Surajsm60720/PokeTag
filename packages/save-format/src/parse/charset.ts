/**
 * Generation III Western character encoding (Bulbapedia / Project Pokémon).
 * Strings are 0xFF-terminated; remainder often padded with 0x00.
 */

const GEN3_CHARS: Record<number, string> = {
  0x00: " ",
  0xa1: "0",
  0xa2: "1",
  0xa3: "2",
  0xa4: "3",
  0xa5: "4",
  0xa6: "5",
  0xa7: "6",
  0xa8: "7",
  0xa9: "8",
  0xaa: "9",
  0xab: "!",
  0xac: "?",
  0xad: ".",
  0xae: "-",
  0xb0: "…",
  0xb1: "“",
  0xb2: "”",
  0xb3: "‘",
  0xb4: "’",
  0xb5: "♂",
  0xb6: "♀",
  0xb7: "¥",
  0xb8: ",",
  0xb9: "×",
  0xba: "/",
  0xbb: "A",
  0xbc: "B",
  0xbd: "C",
  0xbe: "D",
  0xbf: "E",
  0xc0: "F",
  0xc1: "G",
  0xc2: "H",
  0xc3: "I",
  0xc4: "J",
  0xc5: "K",
  0xc6: "L",
  0xc7: "M",
  0xc8: "N",
  0xc9: "O",
  0xca: "P",
  0xcb: "Q",
  0xcc: "R",
  0xcd: "S",
  0xce: "T",
  0xcf: "U",
  0xd0: "V",
  0xd1: "W",
  0xd2: "X",
  0xd3: "Y",
  0xd4: "Z",
  0xd5: "a",
  0xd6: "b",
  0xd7: "c",
  0xd8: "d",
  0xd9: "e",
  0xda: "f",
  0xdb: "g",
  0xdc: "h",
  0xdd: "i",
  0xde: "j",
  0xdf: "k",
  0xe0: "l",
  0xe1: "m",
  0xe2: "n",
  0xe3: "o",
  0xe4: "p",
  0xe5: "q",
  0xe6: "r",
  0xe7: "s",
  0xe8: "t",
  0xe9: "u",
  0xea: "v",
  0xeb: "w",
  0xec: "x",
  0xed: "y",
  0xee: "z",
};

/** Decode a Gen 3 encoded string (stops at 0xFF). */
export function decodeGen3String(bytes: Uint8Array, maxLen?: number): string {
  const limit = maxLen ?? bytes.length;
  let out = "";
  for (let i = 0; i < limit; i++) {
    const b = bytes[i]!;
    if (b === 0xff) break;
    if (b === 0x00) {
      // Padding after terminator is ignored; mid-string NUL uncommon — treat as space.
      out += " ";
      continue;
    }
    out += GEN3_CHARS[b] ?? "";
  }
  return out.trimEnd();
}

/** Encode ASCII-ish text into Gen 3 bytes (for fixtures). */
export function encodeGen3String(text: string, length: number): Uint8Array {
  const reverse = new Map<string, number>();
  for (const [code, ch] of Object.entries(GEN3_CHARS)) {
    reverse.set(ch, Number(code));
  }
  const out = new Uint8Array(length);
  out.fill(0xff);
  const n = Math.min(text.length, length - 1);
  for (let i = 0; i < n; i++) {
    const ch = text[i]!;
    out[i] = reverse.get(ch) ?? 0x00;
  }
  if (n < length) out[n] = 0xff;
  return out;
}
