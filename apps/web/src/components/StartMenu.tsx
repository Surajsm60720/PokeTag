"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const ITEMS = [
  { href: "/", label: "SHELF" },
  { href: "/upload?mode=new", label: "NEW RUN" },
] as const;

export function StartMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <nav className="start-menu" aria-label="Start menu">
      <div className="start-menu__title">START</div>
      <ul className="start-menu__list">
        {ITEMS.map((item) => {
          const active =
            item.label === "SHELF"
              ? pathname === "/"
              : pathname.startsWith("/upload");
          return (
            <li key={item.href}>
              <Link href={item.href} data-active={active}>
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className="start-menu__logout"
            onClick={logout}
            disabled={loggingOut}
          >
            {loggingOut ? "…" : "LOG OUT"}
          </button>
        </li>
      </ul>
      <p className="start-menu__foot">
        Fan project. Not affiliated with Nintendo, Game Freak, or The Pokémon
        Company.
      </p>
    </nav>
  );
}
