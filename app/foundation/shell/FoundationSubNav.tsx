"use client";

export type FoundationSubNavItem = {
  id: string;
  label: string;
  title?: string;
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
          className={`foundation-subnav-item${activeId === item.id ? " is-active" : ""}`}
          data-testid={`foundation-subnav-${item.id}`}
          title={item.title ?? item.label}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
