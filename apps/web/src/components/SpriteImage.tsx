"use client";

import { useEffect, useMemo, useState } from "react";
import { creatureGlyphUri, pokeApiSpriteUrl } from "@/lib/creature-art";

/**
 * Single gate for creature art.
 * PUBLIC_MODE → original type glyph (never remote ripped sheets).
 * Private local vault → PokeAPI sprites, with glyph fallback on error.
 */
export function SpriteImage({
  src,
  speciesId,
  types,
  shiny = false,
  variant = "pixel",
  alt,
  className = "",
  width = 64,
  height = 64,
}: {
  src?: string | null;
  speciesId?: number | null;
  types?: string[];
  shiny?: boolean;
  /** `art` = higher-res official artwork (3DS/Switch era scenes). */
  variant?: "pixel" | "art";
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const [publicMode, setPublicMode] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setPublicMode(document.documentElement.dataset.publicMode === "true");
  }, []);

  const glyph = useMemo(
    () => creatureGlyphUri(speciesId ?? 0, types),
    [speciesId, types]
  );

  const remote =
    !publicMode && speciesId
      ? pokeApiSpriteUrl(speciesId, shiny, variant)
      : null;

  const resolved = src || (!failed ? remote : null);
  const showGlyph = publicMode || !resolved || failed;

  if (showGlyph) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={`sprite-image sprite-image--glyph ${className}`.trim()}
        src={glyph}
        alt={alt}
        width={width}
        height={height}
        style={{ imageRendering: "pixelated", width, height }}
      />
    );
  }

  const rendering = variant === "art" ? "auto" : "pixelated";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`sprite-image ${className}`.trim()}
      src={resolved}
      alt={alt}
      width={width}
      height={height}
      style={{ imageRendering: rendering, width, height }}
      onError={() => setFailed(true)}
    />
  );
}
