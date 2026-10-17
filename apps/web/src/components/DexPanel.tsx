import type { ParsedDex } from "@/lib/parsed";
import { SpriteImage } from "./SpriteImage";

export function DexPanel({ dex }: { dex: ParsedDex }) {
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

      <ul className="dex-panel__grid">
        {dex.entries.map((entry) => (
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
