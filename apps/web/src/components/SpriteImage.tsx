"use client";

import { useEffect, useState } from "react";

/**
 * Single gate for creature art. PUBLIC_MODE forces original silhouettes
 * so public builds never expose ripped sprites.
 */
export function SpriteImage({
  src,
  alt,
  className = "",
  width = 64,
  height = 64,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const [publicMode, setPublicMode] = useState(false);

  useEffect(() => {
    setPublicMode(
      document.documentElement.dataset.publicMode === "true"
    );
  }, []);

  const showPlaceholder = publicMode || !src;

  if (showPlaceholder) {
    return (
      <span
        className={`sprite-image sprite-image--silhouette ${className}`.trim()}
        role="img"
        aria-label={alt}
        style={{ width, height }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`sprite-image ${className}`.trim()}
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
