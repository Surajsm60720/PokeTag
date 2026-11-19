"use client";

import { useState } from "react";
import type { ParsedBox } from "@/lib/parsed";
import { SpriteImage } from "./SpriteImage";
import { SummaryTabs } from "./SummaryTabs";

export function BoxGrid({ boxes }: { boxes: ParsedBox[] }) {
  const [boxIndex, setBoxIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const box = boxes[boxIndex] ?? null;
  const selected =
    selectedCell != null && box ? box.pokemon[selectedCell] : null;

  if (!boxes.length || !box) {
    return <p className="muted">The PC is empty.</p>;
  }

  function shift(delta: number) {
    setBoxIndex((i) => (i + delta + boxes.length) % boxes.length);
    setSelectedCell(null);
  }

  return (
    <div className="box-grid">
      <div className="box-grid__header">
        <button type="button" className="btn btn-tiny" onClick={() => shift(-1)}>
          ◀
        </button>
        <div className="box-grid__title">
          <strong>{box.name}</strong>
          <span className="muted">
            {boxIndex + 1}/{boxes.length} · {box.wallpaper}
          </span>
        </div>
        <button type="button" className="btn btn-tiny" onClick={() => shift(1)}>
          ▶
        </button>
      </div>

      <div
        className="box-grid__wall"
        data-wallpaper={box.wallpaper}
        role="grid"
        aria-label={box.name}
      >
        {box.pokemon.map((mon, i) => (
          <button
            key={i}
            type="button"
            className="box-grid__cell"
            data-filled={Boolean(mon)}
            data-selected={selectedCell === i && Boolean(mon)}
            disabled={!mon}
            onClick={() => setSelectedCell(i)}
            aria-label={
              mon
                ? `${mon.nickname || mon.speciesName}, level ${mon.level}`
                : `Empty ${i + 1}`
            }
          >
            {mon ? (
              <>
                <SpriteImage
                  alt=""
                  speciesId={mon.speciesId}
                  types={mon.types}
                  shiny={mon.shiny}
                  width={40}
                  height={40}
                  loading="lazy"
                />
                <span className="box-grid__lv">{mon.level}</span>
              </>
            ) : (
              <span className="box-grid__empty" />
            )}
          </button>
        ))}
      </div>

      <div className="box-grid__info">
        {selected ? (
          <SummaryTabs pokemon={selected} />
        ) : (
          <span className="muted">Pick a Pokémon in the box.</span>
        )}
      </div>
    </div>
  );
}
