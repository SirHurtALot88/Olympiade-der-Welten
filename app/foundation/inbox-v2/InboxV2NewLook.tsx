"use client";

import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react";

import type { InboxV2ClientProps, InboxV2Item, InboxV2Mode } from "@/app/foundation/inbox-v2/inbox-v2-types";
import { NlCard, NlSubTabs, nlToneClass, type NlTone } from "@/components/foundation/new-look";
import { getInboxItemCadence, isAutoResolvingInboxItemId } from "@/lib/foundation/game-inbox-service";

/**
 * "Neuer Look" Entscheidungs-Triage fuer Inbox V2 (flag-gated, additive).
 *
 * Wird nur gerendert, wenn der Runtime-Flag (`useNewLook`) aktiv ist —
 * `InboxV2Client` faellt ohne Flag unveraendert auf die bestehende
 * Liste/Detail-Ansicht zurueck. Konsumiert exakt dieselben Props und
 * Handler (onSelectItem/onRunChoice/onMarkDone/onDismiss).
 */

const NL_INBOX_DECISION_CATEGORY_FILTERS = [
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

const NL_INBOX_CHRONICLE_CATEGORY_FILTERS = [
  { value: "ALL", label: "Alle" },
  { value: "news", label: "News" },
  { value: "result", label: "Results" },
  { value: "transfer", label: "Transfers" },
] as const;

/* --- Kategorie-Vokabular: deutsches Label + Inline-SVG Icon ------- */

type NlIconProps = { className?: string };

const NL_ICON_SVG_PROPS = {
  viewBox: "0 0 24 24",
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function IconClipboard({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <rect x="6" y="4.5" width="12" height="16" rx="2" />
      <path d="M9.5 4.5V3h5v1.5" />
      <path d="M9 10h6M9 13.5h6M9 17h3.5" />
    </svg>
  );
}

function IconWarningTriangle({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
      <path d="M12 9.5v5" />
      <path d="M12 17.4v.1" />
    </svg>
  );
}

function IconNewspaper({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <path d="M4 5h13v14H6a2 2 0 0 1-2-2V5Z" />
      <path d="M17 9h3v8a2 2 0 0 1-2 2h-1" />
      <path d="M7 9h7M7 12.5h7M7 16h4" />
    </svg>
  );
}

function IconTrophy({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4a3 3 0 0 0 3 4" />
      <path d="M17 5h3a3 3 0 0 1-3 4" />
      <path d="M12 14v3" />
      <path d="M8 20h8" />
    </svg>
  );
}

function IconCoins({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <ellipse cx="12" cy="6.5" rx="7" ry="3" />
      <path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
      <path d="M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    </svg>
  );
}

function IconTransferArrows({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <path d="M4 8h13" />
      <path d="m14 4.5 3.5 3.5L14 11.5" />
      <path d="M20 16H7" />
      <path d="m10 12.5L6.5 16l3.5 3.5" />
    </svg>
  );
}

function IconDumbbell({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <path d="M4 10v4M7 8v8M17 8v8M20 10v4" />
      <path d="M7 12h10" />
    </svg>
  );
}

function IconContract({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <path d="M6 3.5h9L19 7.5V20.5H6z" />
      <path d="M14.5 3.5v4.5H19" />
      <path d="M9 12h6M9 15.5h4" />
    </svg>
  );
}

function IconBuilding({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <path d="M5 21V5l7-2.5V21" />
      <path d="M12 8.5 19 11v10" />
      <path d="M3 21h18" />
    </svg>
  );
}

function IconHandshake({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <path d="m12 6.5-3.5 3a1.6 1.6 0 0 0 2.2 2.3L13 9.5l5 4.5" />
      <path d="M2.5 7 7 5l5 1.5L17 5l4.5 2" />
      <path d="m6 13 4 4a1.5 1.5 0 0 0 2.1-2.1" />
    </svg>
  );
}

function IconDot({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function IconCheck({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <path d="M5 12.5 9.5 17 19 6.5" />
    </svg>
  );
}

/** Reale Inbox-Kategorien (Enum) → deutsches Label + Icon. */
const NL_INBOX_CATEGORY_META: Record<string, { label: string; icon: (props: NlIconProps) => ReturnType<typeof IconDot> }> = {
  task: { label: "Aufgabe", icon: IconClipboard },
  warning: { label: "Warnung", icon: IconWarningTriangle },
  news: { label: "News", icon: IconNewspaper },
  result: { label: "Ergebnis", icon: IconTrophy },
  finance: { label: "Finanzen", icon: IconCoins },
  transfer: { label: "Transfer", icon: IconTransferArrows },
  training: { label: "Training", icon: IconDumbbell },
  contract: { label: "Vertrag", icon: IconContract },
  facility: { label: "Facility", icon: IconBuilding },
  sponsor: { label: "Sponsor", icon: IconHandshake },
};

function getCategoryMeta(category: string) {
  // Quell-Items liefern die Kategorie als UPPERCASE-Enum (siehe
  // use-inbox-v2-derivations: `category.toUpperCase()`); die Vokabular-Map
  // ist lowercase-keyed. Ohne Normalisierung fiel jede Karte auf den
  // grauen Punkt + rohes Enum zurück.
  const key = category.toLowerCase();
  return NL_INBOX_CATEGORY_META[key] ?? { label: category.replaceAll("_", " "), icon: IconDot };
}

function getSeverityTone(severity: InboxV2Item["severity"]): NlTone {
  if (severity === "critical") return "risk";
  if (severity === "warning") return "warn";
  return "accent";
}

function getStatusLabel(item: InboxV2Item): string | null {
  // #43: automatisch (aus dem Spielstand) erledigte Bedingungs-Items tragen
  // ein eigenes Label statt "Erledigt" — das macht sichtbar, dass hier
  // niemand geklickt hat, sondern die Bedingung schlicht erfüllt ist.
  if (item.status === "done") {
    return isAutoResolvingInboxItemId(item.id) ? "Automatisch erledigt" : "Erledigt";
  }
  if (item.status === "dismissed") return "Ausgeblendet";
  return null;
}

/** #44: kleines Cadence-Tag ("Wiederkehrend" / "Einmalig") für die Aktionen-Liste. */
function getCadenceLabel(item: InboxV2Item): { text: string; cadence: "recurring" | "once" } | null {
  const cadence = getInboxItemCadence(item.id);
  if (!cadence) return null;
  return { text: cadence === "recurring" ? "Wiederkehrend" : "Einmalig", cadence };
}

function getInboxItemDomId(itemId: string) {
  return `nl-inbox-item-${itemId}`;
}

export default function InboxV2NewLook({
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
  onModeChange,
}: InboxV2ClientProps) {
  const headerTitle = mode === "chronicle" ? "Chronik" : "Entscheidungen";
  const categoryFilters = mode === "chronicle" ? NL_INBOX_CHRONICLE_CATEGORY_FILTERS : NL_INBOX_DECISION_CATEGORY_FILTERS;

  // Kategorie-Filter als klickbare Portale (#3). Der Mount reicht aktuell
  // keinen `onCategoryFilterChange`-Handler durch (Host setzt
  // `hideCategoryFilters`), daher filtert der Neue Look die Liste lokal —
  // nur echte `item.category`-Werte, keine erfundenen Daten.
  const [localCategoryFilter, setLocalCategoryFilter] = useState<string>(categoryFilter);
  const isExternallyFiltered = Boolean(onCategoryFilterChange);
  const activeCategoryFilter = isExternallyFiltered ? categoryFilter : localCategoryFilter;

  const handleCategoryFilter = (value: string) => {
    if (onCategoryFilterChange) {
      onCategoryFilterChange(value);
    } else {
      setLocalCategoryFilter(value);
    }
  };

  // Modus-Wechsel (Entscheidungen ↔ Chronik) setzt den lokalen Kategorie-Filter
  // auf "ALL" zurück: die Kategorie-Vokabulare der beiden Modi überschneiden
  // sich nur teilweise, ein überlebender Filter würde die Chronik sonst auf eine
  // dort nicht existierende Kategorie einschränken (leere Liste + irreführende
  // "alles erledigt"-Karte). Nur im lokal gefilterten Pfad — vorfiltert der Host
  // extern, gehört das Filter-State ihm.
  useEffect(() => {
    if (!isExternallyFiltered) {
      setLocalCategoryFilter("ALL");
    }
  }, [mode, isExternallyFiltered]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = item.category.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  // Wenn der Host bereits vorfiltert (externer Handler), nichts doppelt
  // filtern; sonst lokal nach der gewählten Kategorie einschränken.
  const displayedItems = useMemo(() => {
    if (isExternallyFiltered || activeCategoryFilter === "ALL") {
      return items;
    }
    const wanted = activeCategoryFilter.toLowerCase();
    return items.filter((item) => item.category.toLowerCase() === wanted);
  }, [items, isExternallyFiltered, activeCategoryFilter]);

  const firstCriticalItem = useMemo(
    () => displayedItems.find((item) => item.severity === "critical") ?? null,
    [displayedItems],
  );

  // Mode-Umschaltung existiert nur, wenn der Mount einen Handler liefert —
  // ohne Handler zeigt die Leiste den aktiven Modus als Kontext an.
  const modeTabs = onModeChange
    ? [
        { id: "decisions", label: "Entscheidungen", count: mode === "decisions" ? openCount : undefined },
        { id: "chronicle", label: "Chronik", count: mode === "chronicle" ? openCount : undefined },
      ]
    : [{ id: mode, label: headerTitle, count: openCount }];

  const jumpToFirstCritical = () => {
    if (!firstCriticalItem) {
      return;
    }
    onSelectItem(firstCriticalItem.id);
    document.getElementById(getInboxItemDomId(firstCriticalItem.id))?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const runInnerAction = (event: MouseEvent, action: () => void) => {
    event.stopPropagation();
    action();
  };

  // Chronik-"Magazin" (#Wave2): Lead-Story-Karte + Support-Karten-Grid statt
  // der generischen Liste. Nur für Chronik-Items (news/result/transfer aus
  // der Chronik-Quelle) — der Entscheidungen-Modus rendert unverändert die
  // bestehende Listenansicht, funktionale Items bleiben also unangetastet.
  const renderChronicleCardActions = (item: InboxV2Item) => (
    <>
      {item.choices && item.choices.length > 0 ? (
        <div className="nl-inbox-card-choices" data-testid="inbox-v2-quick-actions">
          {item.choices.map((choice, choiceIndex) => (
            <button
              key={choice.id}
              type="button"
              className={`nl-inbox-choice${choiceIndex === 0 ? " is-recommended" : ""}`}
              data-testid={`inbox-quick-action-${choice.id}`}
              onClick={(event) => runInnerAction(event, () => onRunChoice?.(item.id, choice.id))}
            >
              <span className="nl-inbox-choice-label">
                {choice.label}
                {choiceIndex === 0 && item.choices && item.choices.length > 1 ? (
                  <span className="nl-inbox-choice-tag">Empfohlen</span>
                ) : null}
              </span>
              {choice.detail ? <small className="nl-inbox-choice-hint">{choice.detail}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
      {item.status === "open" && (onMarkDone || onDismiss) ? (
        <div className="nl-inbox-card-actions">
          {onMarkDone ? (
            <button
              type="button"
              className="nl-inbox-card-action"
              onClick={(event) => runInnerAction(event, () => onMarkDone(item.id))}
            >
              Erledigt
            </button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              className="nl-inbox-card-action"
              onClick={(event) => runInnerAction(event, () => onDismiss(item.id))}
            >
              Ausblenden
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const renderChronicleEyebrow = (meta: ReturnType<typeof getCategoryMeta>, statusLabel: string | null) => {
    const CategoryIcon = meta.icon;
    return (
      <span className="nl-inbox-card-meta">
        <CategoryIcon />
        <span className="nl-inbox-card-category">{meta.label}</span>
        {statusLabel ? <span className="nl-inbox-card-status">{statusLabel}</span> : null}
      </span>
    );
  };

  const renderChronicleLeadCard = (item: InboxV2Item) => {
    const meta = getCategoryMeta(item.category);
    const severityTone = getSeverityTone(item.severity);
    const statusLabel = getStatusLabel(item);
    const isSelected = selectedItemId === item.id;
    return (
      <div key={item.id} id={getInboxItemDomId(item.id)}>
        <NlCard
          interactive
          onClick={() => onSelectItem(item.id)}
          className={`nl-chronicle-lead ${nlToneClass(severityTone)}${isSelected ? " is-selected" : ""}${statusLabel ? " is-resolved" : ""}`}
          eyebrow={renderChronicleEyebrow(meta, statusLabel)}
          title={item.title}
          data-testid={`nl-chronicle-lead-${item.id}`}
        >
          <p className="nl-chronicle-lead-body">{item.detail}</p>
          {renderChronicleCardActions(item)}
        </NlCard>
      </div>
    );
  };

  const renderChronicleStoryCard = (item: InboxV2Item, revealIndex: number) => {
    const meta = getCategoryMeta(item.category);
    const severityTone = getSeverityTone(item.severity);
    const statusLabel = getStatusLabel(item);
    const isSelected = selectedItemId === item.id;
    return (
      <div
        key={item.id}
        id={getInboxItemDomId(item.id)}
        className="nl-reveal"
        style={{ "--nl-reveal-i": revealIndex } as CSSProperties}
      >
        <NlCard
          interactive
          onClick={() => onSelectItem(item.id)}
          className={`nl-chronicle-story ${nlToneClass(severityTone)}${isSelected ? " is-selected" : ""}${statusLabel ? " is-resolved" : ""}`}
          eyebrow={renderChronicleEyebrow(meta, statusLabel)}
          title={item.title}
          data-testid={`nl-chronicle-story-${item.id}`}
        >
          <p className="nl-chronicle-story-body">{item.detail}</p>
          {renderChronicleCardActions(item)}
        </NlCard>
      </div>
    );
  };

  const renderChronicleMagazine = () => {
    const [leadItem, ...restItems] = displayedItems;
    if (!leadItem) {
      return null;
    }
    return (
      <div className="nl-chronicle-magazine" aria-label="Chronik-Magazin">
        {renderChronicleLeadCard(leadItem)}
        {restItems.length > 0 ? (
          <div className="nl-chronicle-grid" aria-label="Weitere Chronik-Einträge">
            {restItems.map((item, index) => renderChronicleStoryCard(item, index))}
          </div>
        ) : null}
      </div>
    );
  };

  const emptyTitle = mode === "chronicle" ? "Noch keine Chronik-Einträge" : "Alles erledigt";
  const emptyText =
    mode === "chronicle"
      ? "Sobald es News, Ergebnisse oder Transfers gibt, erscheinen sie hier."
      : "Keine offenen Aufgaben — neue Entscheidungen landen automatisch hier.";

  return (
    <div className="nl-inbox" data-testid="foundation-inbox-v2" id="foundation-inbox-v2" data-inbox-mode={mode} data-new-look="true">
      <header className="nl-inbox-header">
        <div className="nl-inbox-header-copy">
          <span className="nl-inbox-eyebrow">Inbox</span>
          <h2 className="nl-inbox-title" title={teamLabel ?? undefined}>{headerTitle}</h2>
          {teamLabel ? <p className="nl-inbox-team">{teamLabel}</p> : null}
        </div>
        <div className="nl-inbox-header-meta">
          <span className="nl-inbox-open-pill nl-tnum">{openCount} offen</span>
          {criticalCount > 0 ? (
            <button
              type="button"
              className={`nl-inbox-critical-alert ${nlToneClass("risk")}`}
              onClick={jumpToFirstCritical}
              disabled={!firstCriticalItem}
              title={firstCriticalItem ? "Zum ersten kritischen Eintrag springen" : "Kritische Einträge sind ausgefiltert"}
            >
              <IconWarningTriangle />
              <span className="nl-tnum">{criticalCount} kritisch</span>
            </button>
          ) : null}
        </div>
      </header>

      <NlSubTabs
        className="nl-inbox-mode-tabs"
        items={modeTabs}
        activeId={mode}
        onSelect={(id) => onModeChange?.(id as InboxV2Mode)}
        aria-label="Inbox Modus"
      />

      <div className="nl-inbox-filter-row" role="group" aria-label="Inbox Kategorien">
        {categoryFilters.map((filter) => {
          const isActive = activeCategoryFilter === filter.value;
          const count = filter.value === "ALL" ? items.length : categoryCounts.get(filter.value) ?? 0;
          // Kategorien ohne Einträge werden ausgeblendet (kein toter Chip),
          // "ALL" und der aktive Chip bleiben immer sichtbar.
          if (filter.value !== "ALL" && !isActive && count === 0) {
            return null;
          }
          return (
            <button
              key={filter.value}
              type="button"
              className={`nl-inbox-filter-chip${isActive ? " is-active" : ""}`}
              onClick={() => handleCategoryFilter(filter.value)}
              aria-pressed={isActive}
            >
              <span>{filter.label}</span>
              <span className="nl-inbox-filter-count nl-tnum">{count}</span>
            </button>
          );
        })}
      </div>

      {onIncludeDoneChange || onIncludeDismissedChange ? (
        <div className="nl-inbox-toggle-row">
          {onIncludeDoneChange ? (
            <label className="nl-inbox-toggle">
              <input type="checkbox" checked={includeDone} onChange={(event) => onIncludeDoneChange(event.target.checked)} />
              <span>Erledigte anzeigen</span>
            </label>
          ) : null}
          {onIncludeDismissedChange ? (
            <label className="nl-inbox-toggle">
              <input type="checkbox" checked={includeDismissed} onChange={(event) => onIncludeDismissedChange(event.target.checked)} />
              <span>Ausgeblendete anzeigen</span>
            </label>
          ) : null}
        </div>
      ) : null}

      {displayedItems.length === 0 ? (
        <NlCard className="nl-inbox-empty-card" title={emptyTitle} eyebrow="Inbox">
          <p className="nl-inbox-empty-text">{emptyText}</p>
        </NlCard>
      ) : mode === "chronicle" ? (
        renderChronicleMagazine()
      ) : (
        <ul className="nl-inbox-list" aria-label="Inbox Einträge">
          {displayedItems.map((item) => {
            const meta = getCategoryMeta(item.category);
            const CategoryIcon = meta.icon;
            const severityTone = getSeverityTone(item.severity);
            const statusLabel = getStatusLabel(item);
            const isSelected = selectedItemId === item.id;
            // #43: Bedingungs-Items lösen sich selbst auf — keine manuelle
            // "Erledigt/Ausblenden"-Aktion, die einen unerfüllten Zustand
            // vortäuschen könnte. Solange die Bedingung offen ist, zeigt ein
            // kleines "Automatisch"-Tag, warum hier kein Button steht.
            const isAutoResolving = isAutoResolvingInboxItemId(item.id);
            const cadenceLabel = getCadenceLabel(item);
            const showManualActions = item.status === "open" && !isAutoResolving && (onMarkDone || onDismiss);
            return (
              <li key={item.id} id={getInboxItemDomId(item.id)} className="nl-inbox-list-row">
                <NlCard
                  interactive
                  onClick={() => onSelectItem(item.id)}
                  className={`nl-inbox-card ${nlToneClass(severityTone)}${isSelected ? " is-selected" : ""}${statusLabel ? " is-resolved" : ""}`}
                  data-testid={`nl-inbox-card-${item.id}`}
                >
                  <div className="nl-inbox-card-row">
                    <span className={`nl-inbox-card-icon ${nlToneClass(severityTone)}`} title={meta.label}>
                      <CategoryIcon />
                    </span>
                    <div className="nl-inbox-card-copy">
                      <span className="nl-inbox-card-meta">
                        <span className="nl-inbox-card-category">{meta.label}</span>
                        {cadenceLabel ? (
                          <span className={`nl-inbox-cadence-tag nl-inbox-cadence-${cadenceLabel.cadence}`}>
                            {cadenceLabel.text}
                          </span>
                        ) : null}
                        {item.status === "open" && isAutoResolving ? (
                          <span className="nl-inbox-auto-tag" title="Löst sich automatisch, sobald die Bedingung erfüllt ist.">
                            Automatisch
                          </span>
                        ) : null}
                        {statusLabel ? (
                          <span className="nl-inbox-card-status">
                            {item.status === "done" && isAutoResolving ? <IconCheck className="nl-inbox-card-status-icon" /> : null}
                            {statusLabel}
                          </span>
                        ) : null}
                      </span>
                      <strong className="nl-inbox-card-title">{item.title}</strong>
                      {item.detail ? <p className="nl-inbox-card-detail">{item.detail}</p> : null}

                      {item.choices && item.choices.length > 0 ? (
                        <div className="nl-inbox-card-choices" data-testid="inbox-v2-quick-actions">
                          {item.choices.map((choice, choiceIndex) => (
                            <button
                              key={choice.id}
                              type="button"
                              className={`nl-inbox-choice${choiceIndex === 0 ? " is-recommended" : ""}`}
                              data-testid={`inbox-quick-action-${choice.id}`}
                              onClick={(event) => runInnerAction(event, () => onRunChoice?.(item.id, choice.id))}
                            >
                              <span className="nl-inbox-choice-label">
                                {choice.label}
                                {choiceIndex === 0 && item.choices && item.choices.length > 1 ? (
                                  <span className="nl-inbox-choice-tag">Empfohlen</span>
                                ) : null}
                              </span>
                              {choice.detail ? <small className="nl-inbox-choice-hint">{choice.detail}</small> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {showManualActions ? (
                        <div className="nl-inbox-card-actions">
                          {onMarkDone ? (
                            <button
                              type="button"
                              className="nl-inbox-card-action"
                              onClick={(event) => runInnerAction(event, () => onMarkDone(item.id))}
                            >
                              Erledigt
                            </button>
                          ) : null}
                          {onDismiss ? (
                            <button
                              type="button"
                              className="nl-inbox-card-action"
                              onClick={(event) => runInnerAction(event, () => onDismiss(item.id))}
                            >
                              Ausblenden
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </NlCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
