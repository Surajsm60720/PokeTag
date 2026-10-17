"use client";

import { useEffect } from "react";
import {
  DEFAULT_THEME,
  resolveTheme,
  themeEra,
  themePlatform,
} from "@/lib/theme";

/** Applies the save's game theme to `<html>` for the lifetime of this mount. */
export function ThemeSync({
  gameVersion,
}: {
  gameVersion: string | null | undefined;
}) {
  useEffect(() => {
    if (!gameVersion) return;

    const theme = resolveTheme(gameVersion);
    const root = document.documentElement;
    const prev = {
      theme: root.dataset.theme,
      era: root.dataset.era,
      platform: root.dataset.platform,
    };

    root.dataset.theme = theme;
    root.dataset.era = themeEra(theme);
    root.dataset.platform = themePlatform(theme);

    return () => {
      root.dataset.theme = prev.theme || DEFAULT_THEME;
      root.dataset.era = prev.era || "gen3";
      root.dataset.platform = prev.platform || "gba";
    };
  }, [gameVersion]);

  return null;
}
