"use client";

import { useState } from "react";
import type { ParsedPokemon } from "@/lib/parsed";
import { HPBar } from "./HPBar";
import { SpriteImage } from "./SpriteImage";

type Tab = "info" | "skills" | "moves";

function originKindLabel(kind: ParsedPokemon["originKind"]): string {
  switch (kind) {
    case "wild":
      return "Wild";
    case "egg":
      return "Egg";
    case "trade":
      return "Trade";
    case "gift":
      return "Gift";
    case "fateful":
      return "Fateful encounter";
    default:
      return "Unknown";
  }
}

export function SummaryTabs({ pokemon }: { pokemon: ParsedPokemon }) {
  const [tab, setTab] = useState<Tab>("info");
  const moveRows =
    pokemon.moveDetails?.length > 0
      ? pokemon.moveDetails
      : pokemon.moves.map((name) => ({
          id: 0,
          name,
          pp: null as number | null,
          type: "unknown",
          power: null as number | null,
          accuracy: null as number | null,
          category: "unknown" as const,
        }));

  return (
    <div className="summary-tabs">
      <div className="summary-tabs__hero">
        <SpriteImage
          alt={pokemon.nickname || pokemon.speciesName}
          speciesId={pokemon.speciesId}
          types={pokemon.types}
          shiny={pokemon.shiny}
          width={72}
          height={72}
        />
        <div>
          <h4 className="summary-tabs__name">
            {pokemon.nickname || pokemon.speciesName}
            {pokemon.shiny ? <span className="shiny-tag"> ★</span> : null}
          </h4>
          <p className="muted">
            {pokemon.speciesName} · Lv{pokemon.level} ·{" "}
            {pokemon.gender === "U" ? "—" : pokemon.gender}
          </p>
          <div className="type-row">
            {pokemon.types.map((t) => (
              <span key={t} className="type-chip">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="summary-tabs__nav" role="tablist">
        {(
          [
            ["info", "INFO"],
            ["skills", "SKILLS"],
            ["moves", "MOVES"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            data-active={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="summary-tabs__panel" role="tabpanel">
        {tab === "info" ? (
          <dl className="detail-grid">
            <div>
              <dt>Ability</dt>
              <dd>{pokemon.ability || "—"}</dd>
            </div>
            <div>
              <dt>Nature</dt>
              <dd>{pokemon.nature || "—"}</dd>
            </div>
            <div>
              <dt>Held item</dt>
              <dd>{pokemon.heldItem || "— none —"}</dd>
            </div>
            <div>
              <dt>Ball</dt>
              <dd>{pokemon.ball || "—"}</dd>
            </div>
            <div>
              <dt>OT</dt>
              <dd>{pokemon.otName || "—"}</dd>
            </div>
            <div>
              <dt>Friendship</dt>
              <dd>{pokemon.friendship}</dd>
            </div>
            <div>
              <dt>How obtained</dt>
              <dd>{originKindLabel(pokemon.originKind)}</dd>
            </div>
            <div>
              <dt>Met level</dt>
              <dd>{pokemon.metLevel != null ? `Lv${pokemon.metLevel}` : "—"}</dd>
            </div>
            <div className="detail-grid__wide">
              <dt>Met location</dt>
              <dd>{pokemon.metLocation || "—"}</dd>
            </div>
            {pokemon.caughtAt ? (
              <div className="detail-grid__wide">
                <dt>Caught / met date</dt>
                <dd>{pokemon.caughtAt}</dd>
              </div>
            ) : null}
            {pokemon.origin ? (
              <div className="detail-grid__wide">
                <dt>Origin</dt>
                <dd>{pokemon.origin}</dd>
              </div>
            ) : null}
            {pokemon.originGame ? (
              <div className="detail-grid__wide">
                <dt>Origin game</dt>
                <dd>{pokemon.originGame}</dd>
              </div>
            ) : null}
            <div className="detail-grid__wide">
              <dt>HP</dt>
              <dd>
                <HPBar current={pokemon.currentHp} max={pokemon.maxHp} />
              </dd>
            </div>
          </dl>
        ) : null}

        {tab === "skills" ? (
          <dl className="detail-grid">
            <div>
              <dt>Species No.</dt>
              <dd>#{String(pokemon.speciesId).padStart(3, "0")}</dd>
            </div>
            <div>
              <dt>Types</dt>
              <dd>{pokemon.types.length ? pokemon.types.join(" / ") : "—"}</dd>
            </div>
            <div>
              <dt>Ability</dt>
              <dd>{pokemon.ability || "—"}</dd>
            </div>
            <div>
              <dt>Nature</dt>
              <dd>{pokemon.nature || "—"}</dd>
            </div>
          </dl>
        ) : null}

        {tab === "moves" ? (
          <ul className="move-list">
            {moveRows.map((move, i) => (
              <li key={`${move.name}-${i}`} className="move-list__item">
                <span className="move-list__slot">#{i + 1}</span>
                <div className="move-list__body">
                  <span className="move-list__name">{move.name}</span>
                  <span className="muted move-list__meta">
                    {[
                      move.type !== "unknown" ? move.type : null,
                      move.category !== "unknown" ? move.category : null,
                      move.power != null ? `Pow ${move.power}` : null,
                      move.accuracy != null ? `Acc ${move.accuracy}` : null,
                      move.pp != null ? `PP ${move.pp}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              </li>
            ))}
            {moveRows.length === 0 ? (
              <li className="muted">No moves recorded.</li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
