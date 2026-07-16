"use client";

import { usePathname } from "next/navigation";

type NavKey =
  | "dashboard"
  | "sortiment"
  | "topflop"
  | "marktpreise"
  | "empfehlungen"
  | "import"
  | "einstellungen";

const NAV_ITEMS: { key: NavKey; label: string; href: string }[] = [
  { key: "dashboard", label: "Dashboard", href: "/" },
  { key: "sortiment", label: "Sortiment", href: "/sortiment" },
  { key: "topflop", label: "Top / Flop", href: "/top-flop" },
  { key: "marktpreise", label: "Marktpreise", href: "/marktpreise" },
];

const NAV_ITEMS_STEUERUNG: { key: NavKey; label: string; href: string }[] = [
  { key: "empfehlungen", label: "Empfehlungen", href: "/empfehlungen" },
  { key: "import", label: "Import & Matching", href: "/import" },
  { key: "einstellungen", label: "Einstellungen", href: "/einstellungen" },
];

/** Ordnet die aktuelle Route dem Sidebar-Eintrag zu (aktiver Zustand aus der Route). */
function navKeyForPath(pathname: string): NavKey {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/sortiment")) return "sortiment";
  if (pathname.startsWith("/top-flop")) return "topflop";
  if (pathname.startsWith("/marktpreise")) return "marktpreise";
  if (pathname.startsWith("/empfehlungen")) return "empfehlungen";
  if (pathname.startsWith("/import")) return "import";
  if (pathname.startsWith("/einstellungen")) return "einstellungen";
  return "dashboard";
}

export function Sidebar() {
  const pathname = usePathname();
  const active = navKeyForPath(pathname ?? "/");

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="crest">LE</div>
        <div>
          <b>Lord Enterich</b>
          <span>Cards · Cockpit</span>
        </div>
      </div>
      <nav className="nav">
        {NAV_ITEMS.map((item) => (
          <a key={item.key} className={item.key === active ? "active" : undefined} href={item.href}>
            {item.label}
          </a>
        ))}
        <div className="navsec">Steuerung</div>
        {NAV_ITEMS_STEUERUNG.map((item) => (
          <a key={item.key} className={item.key === active ? "active" : undefined} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="sidefoot">LEC Cockpit · Live-Daten</div>
    </aside>
  );
}
