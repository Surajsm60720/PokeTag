"use client";

import { useLayoutEffect } from "react";
import {
  applyThemeToDocument,
  DEFAULT_THEME,
  restoreDocumentTheme,
  themeEra,
  themePlatform,
} from "@/lib/theme";

/**
 * Applies the save's game theme to `<html>` for the lifetime of this mount.
 */
export function ThemeSync({
  gameVersion,
}: {
  gameVersion: string | null | undefined;
}) {
  useLayoutEffect(() => {
    if (!gameVersion) return;

    applyThemeToDocument(gameVersion);
    return () => {
      const theme = DEFAULT_THEME;
      restoreDocumentTheme({
        theme,
        era: themeEra(theme),
        platform: themePlatform(theme),
      });
    };
  }, [gameVersion]);

  return null;
}
