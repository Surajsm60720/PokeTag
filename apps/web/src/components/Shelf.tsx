import Link from "next/link";
import { sortByReleaseDate } from "@/lib/release-order";
import type { SlotSummary } from "@/lib/vault";
import { CartridgeCard } from "./CartridgeCard";

/** Group by console shelf; release order within each bay. */
function groupSlotsByConsole(slots: SlotSummary[]) {
  const gba = sortByReleaseDate(slots.filter((s) => s.generation === 3));
  const ds = sortByReleaseDate(
    slots.filter((s) => s.generation === 4 || s.generation === 5)
  );
  const n3ds = sortByReleaseDate(
    slots.filter((s) => s.generation === 6 || s.generation === 7)
  );
  const nsw = sortByReleaseDate(
    slots.filter((s) => s.generation === 8 || s.generation === 9)
  );
  const other = sortByReleaseDate(
    slots.filter(
      (s) => s.generation == null || s.generation < 3 || s.generation > 9
    )
  );

  // Small collections stay on one shelf so the grid doesn't feel sparse.
  const known = [...gba, ...ds, ...n3ds, ...nsw];
  if (known.length > 0 && known.length <= 4 && other.length === 0) {
    return [{ title: "YOUR GAMES", key: "all", slots: known }];
  }

  const rows: { title: string; key: string; slots: SlotSummary[] }[] = [];
  if (gba.length) rows.push({ title: "GBA SHELF", key: "gba", slots: gba });
  if (ds.length) rows.push({ title: "DS SHELF", key: "ds", slots: ds });
  if (n3ds.length) rows.push({ title: "3DS SHELF", key: "3ds", slots: n3ds });
  if (nsw.length) rows.push({ title: "SWITCH SHELF", key: "switch", slots: nsw });
  if (other.length) rows.push({ title: "OTHER", key: "other", slots: other });
  return rows.length
    ? rows
    : [{ title: "YOUR GAMES", key: "all", slots: sortByReleaseDate(slots) }];
}

export function Shelf({ slots }: { slots: SlotSummary[] }) {
  if (slots.length === 0) {
    return (
      <div className="lcd-screen">
        <div className="lcd-screen__glass">
          <div className="lcd-inner empty-shelf">
            <div className="empty-shelf__silhouettes" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <p className="empty-shelf__press">PRESS START</p>
            <p className="empty-shelf__copy">
              No runs yet. Start a new run to begin tracking a save.
            </p>
            <Link className="btn btn-primary" href="/upload?mode=new">
              New run
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const rows = groupSlotsByConsole(slots);

  return (
    <div className="shelf-scene">
      <div className="shelf-toolbar">
        <p className="muted shelf-toolbar__hint">
          Each cartridge is a separate run. Start another anytime — old runs
          stay.
        </p>
        <Link className="btn btn-primary" href="/upload?mode=new">
          New run
        </Link>
      </div>

      {rows.map((row) => (
        <section key={row.key} className="shelf-row">
          <h2 className="shelf-row__label">{row.title}</h2>
          <div className="shelf-bay">
            <div className="cartridge-grid">
              {row.slots.map((slot) => (
                <CartridgeCard key={slot.id} slot={slot} />
              ))}
            </div>
            <div className="shelf-plank" aria-hidden />
            <div className="shelf-plank__shadow" aria-hidden />
          </div>
        </section>
      ))}
    </div>
  );
}
