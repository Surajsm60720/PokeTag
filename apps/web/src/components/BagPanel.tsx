"use client";

import type { ParsedBagItem, ParsedInventory } from "@/lib/parsed";

const POCKET_ORDER = [
  "items",
  "medicine",
  "balls",
  "tmhm",
  "berries",
  "key",
  "other",
  "pc",
] as const;

const POCKET_LABEL: Record<(typeof POCKET_ORDER)[number], string> = {
  items: "ITEMS",
  medicine: "MEDICINE",
  balls: "POKÉ BALLS",
  tmhm: "TMs & HMs",
  berries: "BERRIES",
  key: "KEY ITEMS",
  other: "OTHER",
  pc: "PC STORAGE",
};

function groupByPocket(items: ParsedBagItem[]) {
  const map = new Map<string, ParsedBagItem[]>();
  for (const item of items) {
    const key = POCKET_ORDER.includes(item.pocket as (typeof POCKET_ORDER)[number])
      ? item.pocket
      : "other";
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return POCKET_ORDER.filter((p) => map.has(p)).map((p) => ({
    pocket: p,
    items: map.get(p)!,
  }));
}

function ItemList({ items, empty }: { items: ParsedBagItem[]; empty: string }) {
  if (items.length === 0) {
    return <p className="muted">{empty}</p>;
  }
  const groups = groupByPocket(items);
  return (
    <div className="bag-panel__groups">
      {groups.map((g) => (
        <div key={g.pocket} className="bag-panel__group">
          <h4 className="bag-panel__pocket">
            {POCKET_LABEL[g.pocket as (typeof POCKET_ORDER)[number]]}
          </h4>
          <ul className="bag-panel__list">
            {g.items.map((item) => (
              <li key={`${item.pocket}-${item.id}-${item.name}`}>
                <span>{item.name}</span>
                <span className="bag-panel__qty">×{item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function BagPanel({ inventory }: { inventory: ParsedInventory }) {
  const bag = inventory?.bag ?? [];
  const pc = inventory?.pc ?? [];

  return (
    <div className="bag-panel">
      <section>
        <h3 className="section-head">BAG</h3>
        <ItemList items={bag} empty="Bag is empty or not parsed for this game yet." />
      </section>
      <section style={{ marginTop: 20 }}>
        <h3 className="section-head">PC ITEMS</h3>
        <ItemList items={pc} empty="No PC items parsed." />
      </section>
    </div>
  );
}
