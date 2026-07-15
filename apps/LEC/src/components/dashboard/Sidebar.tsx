const NAV_ITEMS = [
  { label: "Dashboard", href: "/", active: true },
  { label: "Sortiment", href: "#", active: false },
  { label: "Top / Flop", href: "#", active: false },
  { label: "Marktpreise", href: "#", active: false },
];

const NAV_ITEMS_STEUERUNG = [
  { label: "Empfehlungen", href: "#", active: false },
  { label: "Import & Matching", href: "#", active: false },
  { label: "Einstellungen", href: "#", active: false },
];

export function Sidebar() {
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
          <a key={item.label} className={item.active ? "active" : undefined} href={item.href}>
            {item.label}
          </a>
        ))}
        <div className="navsec">Steuerung</div>
        {NAV_ITEMS_STEUERUNG.map((item) => (
          <a key={item.label} className={item.active ? "active" : undefined} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="sidefoot">LEC Cockpit · Live-Daten</div>
    </aside>
  );
}
