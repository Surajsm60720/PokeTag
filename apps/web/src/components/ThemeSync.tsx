"use client";

import { useEffect } from "react";
import {
  applyThemeToDocument,
  restoreDocumentTheme,
} from "@/lib/theme";

/**
 * Applies the save's game theme to `<html>` for the lifetime of this mount.
 */
export function ThemeSync({
  gameVersion,
}: {
  gameVersion: string | null | undefined;
}) {
  useEffect(() => {
    if (!gameVersion) return;

    const prev = applyThemeToDocument(gameVersion);
    return () => {
      restoreDocumentTheme(prev);
    };
  }, [gameVersion]);

  return null;
}
