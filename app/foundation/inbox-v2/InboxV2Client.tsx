"use client";

import { useMemo } from "react";

import InboxV2NewLook from "@/app/foundation/inbox-v2/InboxV2NewLook";
import type { InboxV2ClientProps } from "@/app/foundation/inbox-v2/inbox-v2-types";
import { isAutoResolvingInboxItemId } from "@/lib/foundation/game-inbox-service";
import { useNewLook } from "@/lib/ui/new-look-preference";

const INBOX_DECISION_CATEGORY_FILTERS = [
  { value: "ALL", label: "Alle" },
  { value: "task", label: "Aufgaben" },
  { value: "warning", label: "Warnungen" },
  { value: "transfer", label: "Transfers" },
  { value: "finance", label: "Finanzen" },
  { value: "training", label: "Training" },
  { value: "contract", label: "Verträge" },
  { value: "facility", label: "Facilities" },
  { value: "sponsor", label: "Sponsoren" },
] as const;

const INBOX_CHRONICLE_CATEGORY_FILTERS = [
  { value: "ALL", label: "Alle" },
  { value: "news", label: "News" },
  { value: "result", label: "Results" },
  { value: "transfer", label: "Transfers" },
] as const;

export default function InboxV2Client(props: InboxV2ClientProps) {
  const {
    items,
    selectedItemId,
    onSelectItem,
    teamLabel,
    openCount = 0,
    criticalCount = 0,
    mode = "decisions",
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
  } = props;
  // "Neuer Look" Flag-Gate (additiv): Hooks laufen unverändert vor dem
  // Gate (stabile Hook-Reihenfolge beim Umschalten des Flags); Flag aus
  // => bestehende Liste/Detail-Ansicht unverändert.
  const [newLook] = useNewLook();
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? items[0] ?? null,
    [items, selectedItemId],
  );
  if (newLook) return <InboxV2NewLook {...props} />;
  const categoryFilters = mode === "chronicle" ? INBOX_CHRONICLE_CATEGORY_FILTERS : INBOX_DECISION_CATEGORY_FILTERS;
  const headerTitle = mode === "chronicle" ? "Chronik" : "Entscheidungen";
  const emptyLabel =
    mode === "chronicle" ? "Noch keine Chronik-Einträge." : "Keine offenen Aufgaben.";

  return (
    <div className="inbox-v2-shell" data-testid="foundation-inbox-v2" id="foundation-inbox-v2" data-inbox-mode={mode}>
      <header className="inbox-v2-header">
        <div>
          <span className="eyebrow">Inbox</span>
          <h2 title={teamLabel ?? undefined}>{headerTitle}</h2>
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
            {categoryFilters.map((filter) => (
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
                <span className="inbox-v2-list-item-title">{item.title}</span>
                <span className="inbox-v2-list-item-detail">{item.detail}</span>
              </button>
            ))
          ) : (
            <p className="muted">{emptyLabel}</p>
          )}
        </aside>

        <section className="inbox-v2-detail">
          {selectedItem ? (
            <>
              <span className="inbox-v2-category">{selectedItem.category}</span>
              <h3>{selectedItem.title}</h3>
              <p>{selectedItem.detail}</p>
              {selectedItem.choices && selectedItem.choices.length > 0 ? (
                <div className="inbox-v2-choices" data-testid="inbox-v2-quick-actions">
                  {selectedItem.choices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      className="inbox-v2-choice-card"
                      data-testid={`inbox-quick-action-${choice.id}`}
                      onClick={() => onRunChoice?.(selectedItem.id, choice.id)}
                    >
                      <strong>{choice.label}</strong>
                      <small>{choice.detail}</small>
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedItem.status === "open" && !isAutoResolvingInboxItemId(selectedItem.id) && (onMarkDone || onDismiss) ? (
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
              {selectedItem.status === "open" && isAutoResolvingInboxItemId(selectedItem.id) ? (
                <p className="muted">Löst sich automatisch, sobald die Bedingung erfüllt ist.</p>
              ) : null}
              {selectedItem.status === "done" && isAutoResolvingInboxItemId(selectedItem.id) ? (
                <p className="muted">Automatisch erledigt.</p>
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
