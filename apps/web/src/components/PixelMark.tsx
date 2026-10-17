import { POKEBALL_PALETTE, POKEBALL_ROWS, pixelSvg } from "@/lib/pixel";

/** Original wordmark mark — chunky ball, not an official logo. */
export function PokeBallMark({
  size = 56,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const html = pixelSvg(POKEBALL_ROWS, POKEBALL_PALETTE, 1);
  return (
    <span
      className={`pokeball-mark ${className}`.trim()}
      aria-hidden
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
