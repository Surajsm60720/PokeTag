"use client";

import { useMemo, useState } from "react";
import type { ParsedDex, ParsedDexEntry } from "@/lib/parsed";
import { SpriteImage } from "./SpriteImage";

type DexFilter = "seen" | "owned" | "national";

function nationalList(dex: ParsedDex): ParsedDexEntry[] {
  const byId = new Map(dex.entries.map((entry) => [entry.speciesId, entry]));
  const total = Math.max(dex.regionalTotal, dex.entries.length);
  const list: ParsedDexEntry[] = [];
  for (let speciesId = 1; speciesId <= total; speciesId++) {
    const hit = byId.get(speciesId);
    list.push(
      hit ?? {
        speciesId,
        speciesName: `Species #${speciesId}`,
        seen: false,
        owned: false,
      }
    );
  }
  return list;
}

export function DexPanel({ dex }: { dex: ParsedDex }) {
  const [filter, setFilter] = useState<DexFilter>("seen");
  const all = useMemo(() => nationalList(dex), [dex]);
  const shown = all.filter((entry) => {
    if (filter === "owned") return entry.owned;
    if (filter === "seen") return entry.seen || entry.owned;
    return true;
  });

  return (
    <div className="dex-panel">
      <div className="dex-panel__counters">
        <div>
          <span className="dex-panel__label">SEEN</span>
          <strong>{dex.seen}</strong>
        </div>
        <div>
          <span className="dex-panel__label">OWN</span>
          <strong>{dex.owned}</strong>
        </div>
        <div>
          <span className="dex-panel__label">REGIONAL</span>
          <strong>
            {dex.owned}/{dex.regionalTotal}
          </strong>
        </div>
      </div>

      <div className="dex-panel__filters" role="tablist" aria-label="Pokédex list">
        {(
          [
            ["seen", "Seen"],
            ["owned", "Owned"],
            ["national", "National"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            data-active={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="dex-panel__grid">
        {shown.map((entry) => (
          <li
            key={`${entry.speciesId}-${entry.speciesName}`}
            className="dex-tile"
            data-seen={entry.seen}
            data-owned={entry.owned}
          >
            <SpriteImage
              alt={entry.seen ? entry.speciesName : "Unseen"}
              speciesId={entry.seen ? entry.speciesId : null}
              width={40}
              height={40}
              loading="lazy"
              className={entry.seen ? "" : "sprite-image--muted"}
            />
            <span className="dex-tile__no">
              #{String(entry.speciesId).padStart(3, "0")}
            </span>
            <span className="dex-tile__name">
              {entry.seen ? entry.speciesName : "-----"}
            </span>
            <span className="dex-tile__flags">
              {entry.owned ? "OWN" : entry.seen ? "SEEN" : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
