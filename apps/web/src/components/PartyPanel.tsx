"use client";

import { useState } from "react";
import type { ParsedPokemon } from "@/lib/parsed";
import { PartySlot } from "./PartySlot";
import { SummaryTabs } from "./SummaryTabs";

export function PartyPanel({ party }: { party: ParsedPokemon[] }) {
  const slots: Array<ParsedPokemon | null> = Array.from(
    { length: 6 },
    (_, i) => party[i] ?? null
  );
  const [selectedIndex, setSelectedIndex] = useState(
    slots.findIndex((s) => s) >= 0 ? slots.findIndex((s) => s) : 0
  );
  const selected = slots[selectedIndex];

  return (
    <div className="party-panel">
      <div className="party-panel__list">
        {slots.map((mon, i) => (
          <PartySlot
            key={i}
            pokemon={mon}
            selected={i === selectedIndex && Boolean(mon)}
            onSelect={mon ? () => setSelectedIndex(i) : undefined}
          />
        ))}
      </div>
      <div className="party-panel__summary">
        {selected ? (
          <SummaryTabs pokemon={selected} />
        ) : (
          <p className="muted">No Pokémon in the party.</p>
        )}
      </div>
    </div>
  );
}
