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
  { key: "sortiment", label: "Sortiment", href: "#" },
  { key: "topflop", label: "Top / Flop", href: "#" },
  { key: "marktpreise", label: "Marktpreise", href: "#" },
];

const NAV_ITEMS_STEUERUNG: { key: NavKey; label: string; href: string }[] = [
  { key: "empfehlungen", label: "Empfehlungen", href: "#" },
  { key: "import", label: "Import & Matching", href: "/import" },
  { key: "einstellungen", label: "Einstellungen", href: "#" },
];

export function Sidebar({ active = "dashboard" }: { active?: NavKey }) {
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
