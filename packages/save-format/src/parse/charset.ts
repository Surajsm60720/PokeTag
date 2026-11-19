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

/**
 * Generation IV character set (Bulbapedia). Code units are little-endian
 * u16 values, terminated by 0xFFFF or 0x0000. Halfwidth Latin lives at
 * 0x0121–0x015E; kana lives at 0x0002–0x00A1.
 */
const GEN4_KANA =
  "ぁあぃいぅうぇえぉおかがきぎ" +
  "くぐけげこごさざしじすずせぜそぞ" +
  "ただちぢっつづてでとどなにぬねの" +
  "はばぱひびぴふぶぷへべぺほぼぽま" +
  "みむめもゃやゅゆょよらりるれろわ" +
  "をんァアィイゥウェエォオカガキギ" +
  "クグケゲコゴサザシジスズセゼソゾ" +
  "タダチヂッツヅテデトドナニヌネノ" +
  "ハバパヒビピフブプヘベペホボポマ" +
  "ミムメモャヤュユョヨラリルレロワ" +
  "ヲン";

/** 0x015F À through 0x01A4 º. */
const GEN4_ACCENT =
  "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿŒœŞşªº";

const GEN4_SYMBOLS: Record<number, string> = {
  0x0120: "＆",
  0x00e1: "！",
  0x00e2: "？",
  0x00e4: "…",
  0x00e5: "・",
  0x00ee: "♂",
  0x00ef: "♀",
  0x01a5: "er",
  0x01a6: "re",
  0x01a7: "r",
  0x01a9: "¡",
  0x01aa: "¿",
  0x01ab: "!",
  0x01ac: "?",
  0x01ad: ",",
  0x01ae: ".",
  0x01af: "…",
  0x01b0: "･",
  0x01b1: "/",
  0x01b2: "‘",
  0x01b3: "'",
  0x01b4: "“",
  0x01b5: "”",
  0x01b9: "(",
  0x01ba: ")",
  0x01bb: "♂",
  0x01bc: "♀",
  0x01bd: "+",
  0x01be: "-",
  0x01bf: "*",
  0x01c0: "#",
  0x01c1: "=",
  0x01c2: "&",
  0x01c3: "~",
  0x01c4: ":",
  0x01c5: ";",
};

export function gen4Char(code: number): string {
  if (code >= 0x0002 && code <= 0x00a1) return GEN4_KANA[code - 0x0002] ?? "";
  if (code >= 0x00a2 && code <= 0x00ab) {
    return String.fromCharCode(0xff10 + (code - 0x00a2));
  }
  if (code >= 0x00ac && code <= 0x00c5) {
    return String.fromCharCode(0xff21 + (code - 0x00ac));
  }
  if (code >= 0x00c6 && code <= 0x00df) {
    return String.fromCharCode(0xff41 + (code - 0x00c6));
  }
  if (code >= 0x0121 && code <= 0x012a) {
    return String.fromCharCode(0x30 + (code - 0x0121));
  }
  if (code >= 0x012b && code <= 0x0144) {
    return String.fromCharCode(0x41 + (code - 0x012b));
  }
  if (code >= 0x0145 && code <= 0x015e) {
    return String.fromCharCode(0x61 + (code - 0x0145));
  }
  if (code >= 0x015f && code < 0x015f + GEN4_ACCENT.length) {
    return GEN4_ACCENT[code - 0x015f] ?? "";
  }
  return GEN4_SYMBOLS[code] ?? "";
}

/** Decode a Gen 4 string. `data` is the save or Pokémon buffer. */
export function decodeGen4String(
  data: Uint8Array,
  offset: number,
  maxChars: number
): string {
  let out = "";
  for (let i = 0; i < maxChars; i++) {
    const at = offset + i * 2;
    if (at + 1 >= data.length) break;
    const code = data[at]! | (data[at + 1]! << 8);
    if (code === 0xffff || code === 0) break;
    out += gen4Char(code);
  }
  return out;
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
