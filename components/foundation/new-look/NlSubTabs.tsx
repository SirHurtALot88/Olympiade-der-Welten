"use client";

export type NlSubTabItem = {
  id: string;
  label: string;
  /** Optionaler Zähler-Badge, z. B. offene Aufgaben. */
  count?: number;
};

export type NlSubTabsProps = {
  items: NlSubTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Zugängliche Beschreibung der Tab-Leiste. */
  "aria-label"?: string;
  className?: string;
};

/**
 * Horizontale Sub-Tab-Leiste am oberen Seitenrand (Layoutmuster:
 * linke Hauptnavigation + Sub-Tabs oben). Rein präsentational —
 * die Seite steuert `activeId` und rendert den passenden Inhalt.
 */
export function NlSubTabs({ items, activeId, onSelect, "aria-label": ariaLabel, className }: NlSubTabsProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav className={["nl-subtabs", className ?? ""].filter(Boolean).join(" ")} aria-label={ariaLabel ?? "Unterbereiche"}>
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            className={`nl-subtab${isActive ? " is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(item.id)}
          >
            <span className="nl-subtab-label">{item.label}</span>
            {item.count != null && Number.isFinite(item.count) ? (
              <span className="nl-subtab-count nl-tnum">{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export default NlSubTabs;
