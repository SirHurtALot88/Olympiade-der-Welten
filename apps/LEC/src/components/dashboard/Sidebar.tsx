"use client";

import { usePathname } from "next/navigation";
import { UpdateButton } from "./UpdateButton";

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
  { key: "cockpit", label: "Finanzen", href: "/cockpit" },
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
        <UpdateButton />
        <a href="/einstellungen" className={active === "einstellungen" ? "active" : undefined} style={{ color: "inherit", textDecoration: "underline dotted" }}>
          Einstellungen &amp; Datenstand
        </a>
      </div>
    </aside>
  );
}

/** Untere Navigationsleiste fuer schmale Bildschirme (die Seitenleiste ist unter 920 px ausgeblendet). */
export function BottomNav() {
  const pathname = usePathname();
  const active = navKeyForPath(pathname ?? "/");
  const items = [...NAV_ITEMS, { key: "einstellungen" as NavKey, label: "Einstellungen", href: "/einstellungen" }];
  return (
    <nav className="bottomnav" aria-label="Hauptnavigation">
      {items.map((item) => (
        <a key={item.key} href={item.href} className={item.key === active ? "active" : undefined} aria-current={item.key === active ? "page" : undefined}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}
