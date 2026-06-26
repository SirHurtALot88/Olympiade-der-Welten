"use client";

import { useMemo } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { VeloStatOrbitRow } from "@/components/foundation/velo-ui";

import type { InboxV2ClientProps } from "@/app/foundation/inbox-v2/inbox-v2-types";

const INBOX_CATEGORY_FILTERS = [
  { value: "ALL", label: "Alle" },
  { value: "task", label: "Aufgaben" },
  { value: "warning", label: "Warnungen" },
  { value: "news", label: "News" },
  { value: "result", label: "Results" },
  { value: "finance", label: "Finanzen" },
  { value: "transfer", label: "Transfers" },
  { value: "training", label: "Training" },
  { value: "contract", label: "Vertraege" },
  { value: "facility", label: "Facilities" },
] as const;

export default function InboxV2Client({
  items,
  selectedItemId,
  onSelectItem,
  teamLabel,
  openCount = 0,
  criticalCount = 0,
  categoryFilter = "ALL",
  onCategoryFilterChange,
  includeDone = false,
  onIncludeDoneChange,
  includeDismissed = false,
  onIncludeDismissedChange,
  onRunChoice,
  onMarkDone,
  onDismiss,
  hideCategoryFilters = false,
}: InboxV2ClientProps) {
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? items[0] ?? null,
    [items, selectedItemId],
  );

  return (
    <div className="inbox-v2-shell" data-testid="foundation-inbox-v2" id="foundation-inbox-v2">
      <header className="inbox-v2-header">
        <div>
          <span className="eyebrow">Inbox</span>
          <h2 title={teamLabel ?? undefined}>Entscheidungen</h2>
          {teamLabel ? <p className="home-v2-hero-meta-line">{teamLabel}</p> : null}
        </div>
        <div className="inbox-v2-actions">
          <span className="pill">{openCount} offen</span>
          {criticalCount > 0 ? <span className="pill is-warning">{criticalCount} kritisch</span> : null}
        </div>
      </header>

      {onCategoryFilterChange && !hideCategoryFilters ? (
        <div className="inbox-v2-filters">
          <div className="velo-intensity-rail inbox-v2-category-rail" aria-label="Inbox Kategorien">
            {INBOX_CATEGORY_FILTERS.map((filter) => (
              <button
                key={filter.value}
                className={`velo-intensity-segment inbox-v2-category-segment${categoryFilter === filter.value ? " is-active" : ""}`}
                type="button"
                onClick={() => onCategoryFilterChange(filter.value)}
              >
                <span className="velo-intensity-segment-label">{filter.label}</span>
              </button>
            ))}
          </div>
          <div className="inbox-v2-toggle-row foundation-filter-grid">
          {onIncludeDoneChange ? (
            <label className="filter-field checkbox-field">
              <input type="checkbox" checked={includeDone} onChange={(event) => onIncludeDoneChange(event.target.checked)} />
              <span>Erledigte anzeigen</span>
            </label>
          ) : null}
          {onIncludeDismissedChange ? (
            <label className="filter-field checkbox-field">
              <input type="checkbox" checked={includeDismissed} onChange={(event) => onIncludeDismissedChange(event.target.checked)} />
              <span>Ausgeblendete anzeigen</span>
            </label>
          ) : null}
          </div>
        </div>
      ) : null}

      <div className="inbox-v2-layout">
        <aside className="inbox-v2-list" aria-label="Inbox Liste">
          {items.length > 0 ? (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`inbox-v2-list-item is-${item.severity}${selectedItem?.id === item.id ? " is-active" : ""}`}
                onClick={() => onSelectItem(item.id)}
              >
                <span className="inbox-v2-category">{item.category}</span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </button>
            ))
          ) : (
            <p className="muted">Keine offenen Inbox-Einträge.</p>
          )}
        </aside>

        <section className="inbox-v2-detail">
          {selectedItem ? (
            <>
              <span className="inbox-v2-category">{selectedItem.category}</span>
              <h3>{selectedItem.title}</h3>
              <p>{selectedItem.detail}</p>
              {selectedItem.choices && selectedItem.choices.length > 0 ? (
                <div className="inbox-v2-choices">
                  {selectedItem.choices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      className="inbox-v2-choice-card"
                      onClick={() => onRunChoice?.(selectedItem.id, choice.id)}
                    >
                      <strong>{choice.label}</strong>
                      <small>{choice.detail}</small>
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedItem.status === "open" && (onMarkDone || onDismiss) ? (
                <div className="inbox-v2-detail-actions">
                  {onMarkDone ? (
                    <button type="button" className="secondary-button inline-button" onClick={() => onMarkDone(selectedItem.id)}>
                      Erledigt
                    </button>
                  ) : null}
                  {onDismiss ? (
                    <button type="button" className="secondary-button inline-button" onClick={() => onDismiss(selectedItem.id)}>
                      Ausblenden
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">Wähle links einen Eintrag.</p>
          )}
        </section>
      </div>
    </div>
  );
}
