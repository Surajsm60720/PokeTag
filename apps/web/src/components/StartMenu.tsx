"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "SHELF" },
  { href: "/upload", label: "SAVE" },
] as const;

export function StartMenu() {
  const pathname = usePathname();

  return (
    <nav className="start-menu" aria-label="Start menu">
      <div className="start-menu__title">START</div>
      <ul className="start-menu__list">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link href={item.href} data-active={active}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="start-menu__foot">
        Fan project. Not affiliated with Nintendo, Game Freak, or The Pokémon
        Company.
      </p>
    </nav>
  );
}
