"use client";

import { useMemo } from "react";

import type { InboxV2ClientProps } from "@/app/foundation/inbox-v2/inbox-v2-types";

export default function InboxV2Client({
  items,
  selectedItemId,
  onSelectItem,
  onOpenClassicInbox,
  onOpenHomeV2,
  onRunChoice,
}: InboxV2ClientProps) {
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? items[0] ?? null,
    [items, selectedItemId],
  );

  return (
    <div className="inbox-v2-shell" data-testid="foundation-inbox-v2" id="foundation-inbox-v2">
      <header className="inbox-v2-header">
        <div>
          <span className="eyebrow">Inbox V2</span>
          <h2>Entscheidungen & Hinweise</h2>
        </div>
        <div className="inbox-v2-actions">
          <button type="button" className="secondary-button" onClick={onOpenHomeV2}>
            Home V2
          </button>
          <button type="button" className="secondary-button" onClick={onOpenClassicInbox}>
            Inbox Classic
          </button>
        </div>
      </header>

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
            </>
          ) : (
            <p className="muted">Wähle links einen Eintrag.</p>
          )}
        </section>
      </div>
    </div>
  );
}
