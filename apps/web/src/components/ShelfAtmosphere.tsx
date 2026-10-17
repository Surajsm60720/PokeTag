"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  applyThemeToDocument,
  DEFAULT_THEME,
  readDocumentTheme,
  restoreDocumentTheme,
  type DocumentThemeState,
} from "@/lib/theme";

/**
 * Live-previews a cartridge's plot scene on hover/focus.
 * Restores the shelf default when the pointer leaves the shelf.
 */
export function ShelfAtmosphere({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const baselineRef = useRef<DocumentThemeState | null>(null);
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    baselineRef.current = readDocumentTheme();

    const clearRestore = () => {
      if (restoreTimer.current) {
        clearTimeout(restoreTimer.current);
        restoreTimer.current = null;
      }
    };

    const previewGame = (game: string | null | undefined) => {
      if (!game || game === "unknown") return;
      clearRestore();
      applyThemeToDocument(game);
    };

    const scheduleRestore = () => {
      clearRestore();
      restoreTimer.current = setTimeout(() => {
        const baseline = baselineRef.current ?? {
          theme: DEFAULT_THEME,
          era: "gen3",
          platform: "gba",
        };
        restoreDocumentTheme(baseline);
      }, 120);
    };

    const onEnter = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const cart = target?.closest?.(".cartridge") as HTMLElement | null;
      if (!cart || !root.contains(cart)) return;
      previewGame(cart.dataset.game);
    };

    const onLeaveShelf = (event: PointerEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && root.contains(next)) return;
      scheduleRestore();
    };

    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && root.contains(next)) return;
      scheduleRestore();
    };

    root.addEventListener("pointerenter", onEnter, true);
    root.addEventListener("focusin", onEnter, true);
    root.addEventListener("pointerleave", onLeaveShelf);
    root.addEventListener("focusout", onFocusOut);

    return () => {
      clearRestore();
      root.removeEventListener("pointerenter", onEnter, true);
      root.removeEventListener("focusin", onEnter, true);
      root.removeEventListener("pointerleave", onLeaveShelf);
      root.removeEventListener("focusout", onFocusOut);
      const baseline = baselineRef.current;
      if (baseline) restoreDocumentTheme(baseline);
    };
  }, []);

  return (
    <div className="shelf-atmosphere" ref={rootRef}>
      {children}
    </div>
  );
}
