"use client";

import { useEffect, useState } from "react";

export interface MenuItem {
  id: string;
  label: string;
  disabled?: boolean;
}

export function MenuList({
  items,
  onSelect,
  initialIndex = 0,
}: {
  items: MenuItem[];
  onSelect: (id: string) => void;
  initialIndex?: number;
}) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        setIndex((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter" || e.key === "z" || e.key === "Z") {
        const item = items[index];
        if (item && !item.disabled) onSelect(item.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, index, onSelect]);

  return (
    <ul className="menu-list" role="menu">
      {items.map((item, i) => (
        <li key={item.id} role="none">
          <button
            type="button"
            role="menuitem"
            data-selected={i === index}
            disabled={item.disabled}
            onMouseEnter={() => setIndex(i)}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
