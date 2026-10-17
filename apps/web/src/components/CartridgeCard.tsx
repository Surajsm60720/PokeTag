import Link from "next/link";
import { formatPlayTimeShort } from "@/lib/parsed";
import { shortGameName } from "@/lib/game-dirs";
import type { SlotSummary } from "@/lib/vault";
import { cartForm, resolveTheme } from "@/lib/theme";
import { SpriteImage } from "./SpriteImage";

export function CartridgeCard({ slot }: { slot: SlotSummary }) {
  const gameName = shortGameName(slot.gameVersion);
  const game = resolveTheme(slot.gameVersion);
  const form = cartForm(slot.generation, game);
  const party = slot.partyIcons.slice(0, 6);

  return (
    <Link
      href={`/slots/${slot.id}`}
      className="cartridge"
      data-game={game}
      data-form={form}
      data-recognized={slot.recognized ? "true" : "false"}
      data-parsed={slot.hasParsed ? "true" : "false"}
      aria-label={`${gameName}, Gen ${slot.generation ?? "?"}${
        slot.trainerName ? `, trainer ${slot.trainerName}` : ""
      }`}
    >
      <div className="cartridge__shell">
        <span className="cartridge__notch" aria-hidden />

        <div className="cartridge__label">
          {slot.hasParsed && slot.badgeCount != null ? (
            <span className="cartridge__badge cartridge__badge--ok">
              {slot.badgeCount}
            </span>
          ) : !slot.recognized ? (
            <span className="cartridge__badge">???</span>
          ) : null}
          <div className="cartridge__stripe" aria-hidden />
          <div className="cartridge__name">{gameName}</div>
          {slot.runLabel ? (
            <div className="cartridge__run">{slot.runLabel}</div>
          ) : null}
          {party.length > 0 ? (
            <div className="cartridge__party" aria-hidden>
              {party.map((p, i) => (
                <span
                  key={`${p.speciesName}-${i}`}
                  className="cartridge__party-icon"
                  data-shiny={p.shiny || undefined}
                >
                  <SpriteImage
                    alt=""
                    speciesId={p.speciesId}
                    types={p.types}
                    shiny={p.shiny}
                    width={14}
                    height={14}
                  />
                </span>
              ))}
            </div>
          ) : null}
          <div className="cartridge__meta">
            <span>Gen {slot.generation ?? "?"}</span>
            {slot.playTimeSeconds != null ? (
              <span>{formatPlayTimeShort(slot.playTimeSeconds)}</span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
