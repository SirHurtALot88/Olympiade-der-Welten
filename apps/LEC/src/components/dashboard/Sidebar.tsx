"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { StandInfo } from "@/lib/dashboard/stand";
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

function agoShort(iso: string | null): string {
  if (!iso) return "nie";
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 60) return `${Math.max(min, 1)} Min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} Std` : `${Math.floor(h / 24)} Tg`;
}

/** Stand-Zeile: wie frisch sind Billbee, eBay und Cardmarket, und wie viele Artikel haben einen Marktwert. */
function StandZeile() {
  const [stand, setStand] = useState<StandInfo | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/stand")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setStand(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!stand) return null;
  return (
    <div className="stand" aria-label="Datenstand">
      {stand.items.map((i) => (
        <span key={i.key} className={`stand-i stand-${i.level}`} title={i.at ? `${i.label}: ${new Date(i.at).toLocaleString("de-DE")}` : `${i.label}: noch nie abgerufen`}>
          <i />
          {i.label} {agoShort(i.at)}
        </span>
      ))}
      {stand.marktAbdeckung != null && (
        <span className="stand-i" title={`${stand.withMarkt} von ${stand.withStock} Artikeln mit Bestand haben einen Cardmarket-Marktwert`}>
          Marktwert {Math.round(stand.marktAbdeckung * 100)} %
        </span>
      )}
    </div>
  );
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
        <StandZeile />
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
