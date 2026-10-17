import Link from "next/link";
import type { SlotSummary } from "@/lib/vault";
import { CartridgeCard } from "./CartridgeCard";

function groupSlots(slots: SlotSummary[]) {
  const gba = slots.filter((s) => s.generation === 3);
  const ds = slots.filter((s) => s.generation === 4 || s.generation === 5);
  const n3ds = slots.filter((s) => s.generation === 6 || s.generation === 7);
  const nsw = slots.filter((s) => s.generation === 8 || s.generation === 9);
  const other = slots.filter(
    (s) =>
      s.generation == null ||
      (s.generation < 3 || s.generation > 9)
  );

  // Small collections stay on one shelf so the grid doesn't feel sparse.
  const known = [...gba, ...ds, ...n3ds, ...nsw];
  if (known.length > 0 && known.length <= 4 && other.length === 0) {
    return [{ title: "YOUR GAMES", slots: known }];
  }

  const rows: { title: string; slots: SlotSummary[] }[] = [];
  if (gba.length) rows.push({ title: "GBA SHELF", slots: gba });
  if (ds.length) rows.push({ title: "DS SHELF", slots: ds });
  if (n3ds.length) rows.push({ title: "3DS SHELF", slots: n3ds });
  if (nsw.length) rows.push({ title: "SWITCH SHELF", slots: nsw });
  if (other.length) rows.push({ title: "OTHER", slots: other });
  return rows.length ? rows : [{ title: "YOUR GAMES", slots }];
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
              No games yet. Insert a cartridge to begin.
            </p>
            <Link className="btn btn-primary" href="/upload">
              Insert save
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const rows = groupSlots(slots);

  return (
    <div className="shelf-scene">
      {rows.map((row) => (
        <section key={row.title} className="shelf-row">
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
