"use client";

import type { ParsedPokemon } from "@/lib/parsed";
import { HPBar } from "./HPBar";
import { SpriteImage } from "./SpriteImage";

export function PartySlot({
  pokemon,
  selected,
  onSelect,
}: {
  pokemon: ParsedPokemon | null;
  selected?: boolean;
  onSelect?: () => void;
}) {
  if (!pokemon) {
    return (
      <div className="party-slot party-slot--empty" aria-label="Empty party slot">
        <span className="party-slot__empty-mark">—</span>
        <span className="muted">Empty</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="party-slot"
      data-selected={selected || undefined}
      data-shiny={pokemon.shiny || undefined}
      onClick={onSelect}
    >
      <SpriteImage
        alt={pokemon.nickname || pokemon.speciesName}
        speciesId={pokemon.speciesId}
        types={pokemon.types}
        shiny={pokemon.shiny}
        width={56}
        height={56}
        className="party-slot__sprite"
      />
      <div className="party-slot__body">
        <div className="party-slot__top">
          <strong>{pokemon.nickname || pokemon.speciesName}</strong>
          <span className="party-slot__lv">Lv{pokemon.level}</span>
        </div>
        <div className="party-slot__meta">
          <span>{pokemon.speciesName}</span>
          {pokemon.shiny ? <span className="shiny-tag">★</span> : null}
          <span>{pokemon.gender === "U" ? "—" : pokemon.gender}</span>
        </div>
        <HPBar current={pokemon.currentHp} max={pokemon.maxHp} compact />
      </div>
    </button>
  );
}
