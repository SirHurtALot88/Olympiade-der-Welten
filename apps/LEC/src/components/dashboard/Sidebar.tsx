"use client";

import { usePathname } from "next/navigation";

type NavKey =
  | "dashboard"
  | "cockpit"
  | "sortiment"
  | "topflop"
  | "marktpreise"
  | "empfehlungen"
  | "import"
  | "einstellungen";

// Nur zwei Seiten: Dashboard (das Wichtigste) und Sortiment (alle Details). Die uebrigen Seiten bleiben
// per Adresse erreichbar, stehen aber nicht mehr in der Navigation. Einstellungen (Billbee-Zugang,
// Datenstand) liegt als kleiner Link unten.
const NAV_ITEMS: { key: NavKey; label: string; href: string }[] = [
  { key: "dashboard", label: "Dashboard", href: "/" },
  { key: "sortiment", label: "Sortiment", href: "/sortiment" },
];

/** Ordnet die aktuelle Route dem Sidebar-Eintrag zu (aktiver Zustand aus der Route). */
function navKeyForPath(pathname: string): NavKey {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/cockpit")) return "cockpit";
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
      </nav>
      <div className="sidefoot">
        <a href="/einstellungen" className={active === "einstellungen" ? "active" : undefined} style={{ color: "inherit", textDecoration: "underline dotted" }}>
          Einstellungen &amp; Datenstand
        </a>
      </div>
    </aside>
  );
}
