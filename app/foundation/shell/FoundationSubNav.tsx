"use client";

export type FoundationSubNavItem = {
  id: string;
  label: string;
  title?: string;
  needsAttention?: boolean;
  /**
   * Optionaler echter Zähler (z.B. offene Inbox-Items, Kadergröße). Nur die
   * "Neuer Look"-Ansicht setzt diesen Wert (additiv); ohne Wert bleibt die
   * Untertab-Leiste byte-identisch zur Flag-AUS-Darstellung.
   */
  count?: number | null;
};

type FoundationSubNavProps = {
  items: FoundationSubNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
};

export default function FoundationSubNav({ items, activeId, onSelect, className = "" }: FoundationSubNavProps) {
  if (items.length === 0) return null;

  return (
    <nav
      className={`foundation-subnav${className ? ` ${className}` : ""}`}
      data-testid="foundation-subnav"
      aria-label="Unterreiter"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`foundation-subnav-item${activeId === item.id ? " is-active" : ""}${item.needsAttention ? " is-attention" : ""}`}
          data-testid={`foundation-subnav-${item.id}`}
          title={item.title ?? item.label}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
          {item.count != null ? (
            <span className="foundation-subnav-count" data-testid={`foundation-subnav-count-${item.id}`}>
              {item.count}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
