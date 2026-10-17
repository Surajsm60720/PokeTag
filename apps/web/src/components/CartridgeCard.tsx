import Link from "next/link";
import { formatBytes } from "@/lib/format";
import type { SlotSummary } from "@/lib/vault";
import { cartForm, resolveTheme } from "@/lib/theme";

function shortTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function CartridgeCard({ slot }: { slot: SlotSummary }) {
  const name = slot.runLabel || slot.label;
  const game = resolveTheme(slot.gameVersion);
  const form = cartForm(slot.generation, game);

  return (
    <Link
      href={`/slots/${slot.id}`}
      className="cartridge"
      data-game={game}
      data-form={form}
      data-recognized={slot.recognized ? "true" : "false"}
      aria-label={`${name}, Gen ${slot.generation ?? "?"}, ${(slot.sourceFormat || "?").toUpperCase()}`}
    >
      <div className="cartridge__shell">
        <span className="cartridge__notch" aria-hidden />
        {!slot.recognized ? (
          <span className="cartridge__badge">???</span>
        ) : (
          <span className="cartridge__badge cartridge__badge--ok">OK</span>
        )}
        <div className="cartridge__label">
          <div className="cartridge__stripe" aria-hidden />
          <div className="cartridge__name">{name}</div>
          <div className="cartridge__meta">
            GEN {slot.generation ?? "?"} ·{" "}
            {(slot.sourceFormat || "?").toUpperCase()}
          </div>
          <div className="cartridge__meta">
            {formatBytes(slot.sizeBytes)} · {shortTime(slot.lastUploadedAt)}
          </div>
        </div>
      </div>
    </Link>
  );
}
