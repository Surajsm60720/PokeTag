/** Draw original pixel art as crisp SVG from a character grid. */
export function pixelSvg(
  rows: string[],
  palette: Record<string, string>,
  scale = 1
): string {
  const rects: string[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c !== "." && palette[c]) {
        rects.push(
          `<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[c]}"/>`
        );
      }
    });
  });
  const w = rows[0]?.length ?? 0;
  const h = rows.length;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges">${rects.join("")}</svg>`;
}

export function pixelDataUri(
  rows: string[],
  palette: Record<string, string>,
  scale = 1
): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(pixelSvg(rows, palette, scale))}`;
}

/** Original Poké Ball mark — not an official logo lockup. */
export const POKEBALL_ROWS = [
  "....OOOOOO....",
  "...OKKKKKKO...",
  "..OKRRRRRRKO..",
  ".OKRRRRRRRRKO.",
  ".OKRRRRRRRRKO.",
  "OKRRRRRRRRRRKO",
  "OKRRRROORRRRKO",
  "OOOOOOKKOOOOOO",
  "OWWWWWOOWWWWWK",
  "OWWWWWWWWWWWWK",
  ".OWWWWWWWWWWO.",
  ".OWWWWWWWWWWO.",
  "..OWWWWWWWWO..",
  "...OWWWWWWO...",
  "....OOOOOO....",
];

export const POKEBALL_PALETTE = {
  O: "#1a1a22",
  K: "#0e0e14",
  R: "#d8402a",
  W: "#f4efd8",
};

export const CURSOR_ROWS = [
  "X.......",
  "XX......",
  "X.X.....",
  "X..X....",
  "X...X...",
  "X....X..",
  "X..XXXXX",
  "X.X.....",
  "XX.X....",
  "X..X....",
  "...X....",
];

export const CURSOR_PALETTE = {
  X: "currentColor",
};
