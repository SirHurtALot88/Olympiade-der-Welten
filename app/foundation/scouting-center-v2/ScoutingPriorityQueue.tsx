"use client";

import { useState, type CSSProperties } from "react";
import { getInitials } from "@/lib/foundation/tabs/foundation-format-render-helpers";

import ScoutGradeRing from "@/app/foundation/scouting-center-v2/ScoutGradeRing";
import ScoutVerdictReport from "@/app/foundation/scouting-center-v2/ScoutVerdictReport";
import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import { NlEmptyState, NlProgressBar } from "@/components/foundation/new-look";
import { appendMediaImageVariant, getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import type { ScoutVerdict } from "@/lib/scouting/scout-verdict-service";
import type { ScoutingWishlistQueueState } from "@/lib/scouting/scouting-wishlist-slots";

export type ScoutingQueueRow = {
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  certainty: number;
  effectiveScoutingLevel: number;
  isActiveSlot: boolean;
  isFocusTarget: boolean;
  isFullyScouted: boolean;
  /** Seit 11.11.: aktiv / fertig / wartend. Fehlt = aus isActiveSlot/isFullyScouted abgeleitet. */
  queueState?: ScoutingWishlistQueueState;
  /** Scout-Urteil für den Bewertungskreis; fehlt = kein Kreis. */
  verdict?: ScoutVerdict | null;
};

function resolveQueueState(entry: ScoutingQueueRow): ScoutingWishlistQueueState {
  if (entry.queueState) return entry.queueState;
  if (entry.isFullyScouted) return "completed";
  return entry.isActiveSlot ? "active" : "waiting";
}


type ScoutingPriorityQueueProps = {
  entries: ScoutingQueueRow[];
  focusEtaLabel?: string | null;
  slotLimit?: number | null;
  selectedReportPlayerId?: string | null;
  onReorder: (playerId: string, targetIndex: number) => void;
  onOpenPlayer: (playerId: string) => void;
  onRemove: (playerId: string) => void;
  onSelectReport?: (playerId: string) => void;
  onOpenMarket?: () => void;
  /** Neuer Look: NL-Leerzustand (NlEmptyState) statt Legacy-Placeholder-Text. */
  newLook?: boolean;
};

// #T-082 — Tastatur-Alternative zur reinen HTML5-Drag&Drop-Sortierung.
// Inline-Styles bewusst statt neuer app/globals.css-Regeln: geteilte Styles
// sind außerhalb des T-082-Scopes (siehe Backlog-Auftrag), und die Buttons
// leben in der bestehenden "scouting-queue-drag-handle"-Grid-Zelle, damit das
// 6-spaltige Grid (grid-template-columns) unangetastet bleibt.
const reorderHandleWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
};
const reorderButtonGroupStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};
const reorderButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 14,
  padding: 0,
  lineHeight: 1,
  fontSize: "9px",
  color: "inherit",
  background: "rgba(148, 163, 184, 0.12)",
  border: "1px solid rgba(148, 163, 184, 0.3)",
  borderRadius: 4,
  cursor: "pointer",
};
const reorderButtonDisabledStyle: CSSProperties = {
  ...reorderButtonStyle,
  opacity: 0.35,
  cursor: "default",
};


export default function ScoutingPriorityQueue({
  entries,
  focusEtaLabel,
  slotLimit,
  selectedReportPlayerId,
  onReorder,
  onOpenPlayer,
  onRemove,
  onSelectReport,
  onOpenMarket,
  newLook = false,
}: ScoutingPriorityQueueProps) {
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [openVerdictPlayerId, setOpenVerdictPlayerId] = useState<string | null>(null);

  if (entries.length === 0) {
    if (newLook) {
      return (
        <NlEmptyState
          icon="🔍"
          title="Wishlist ist leer"
          message="Im Transfermarkt Spieler auf die Wishlist setzen — sie erscheinen hier als Scouting-Warteschlange, per Drag & Drop sortierbar."
          action={onOpenMarket ? { label: "Transfermarkt öffnen", onClick: onOpenMarket } : undefined}
          data-testid="scouting-queue-empty"
        />
      );
    }
    return (
      <div className="scouting-queue-empty" data-testid="scouting-queue-empty">
        <p className="muted">
          Noch niemand auf der Wishlist. Im Transfermarkt Spieler auf die Wishlist setzen — sie erscheinen hier als
          Scouting-Warteschlange, per Drag &amp; Drop sortierbar.
        </p>
        {onOpenMarket ? (
          <button type="button" className="primary-button inline-button" onClick={onOpenMarket}>
            Transfermarkt öffnen
          </button>
        ) : null}
      </div>
    );
  }

  const firstWaitingIndex = entries.findIndex((entry) => resolveQueueState(entry) === "waiting");

  return (
    <ol className="scouting-queue-list" data-testid="scouting-priority-queue">
      {entries.map((entry, index) => {
        const src = getPlayerPortraitBrowserUrl(entry.playerId, null, null);
        const previewSrc = appendMediaImageVariant(src, "preview") ?? src;
        const isDragging = draggedPlayerId === entry.playerId;
        const isDropTarget = dropIndex === index && draggedPlayerId != null && draggedPlayerId !== entry.playerId;
        // Drei Zustände aus EINER sortierbaren Liste (Konzept Abschnitt 4). Fertige Einträge
        // können überall in der Priorität stehen (sie geben nur ihren Slot frei) und tragen ihren
        // Zustand in Zeile und vollem Kreis; die Trennlinie steht nur vor dem ersten WARTENDEN —
        // ab dort wird nichts mehr gescoutet, bis oben ein Platz frei wird.
        const queueState = resolveQueueState(entry);
        const showGroupDivider = index === firstWaitingIndex;
        const verdictOpen = openVerdictPlayerId === entry.playerId && entry.verdict != null;

        return (
          <li key={entry.playerId} className="scouting-queue-row-wrapper" data-queue-state={queueState}>
            {showGroupDivider ? (
              <div className={`scouting-queue-slot-divider is-${queueState}`} role="presentation" data-testid={`scouting-queue-divider-${queueState}`}>
                <span>
                  Wartet auf freien Scout-Slot{slotLimit != null ? ` — ${slotLimit} werden gleichzeitig gescoutet` : ""}
                </span>
              </div>
            ) : null}
            <div
              className={`scouting-queue-row${entry.isFocusTarget ? " is-focus" : ""}${
                entry.isFullyScouted ? " is-fully-scouted" : ""
              }${queueState === "waiting" ? " is-bookmarked" : ""}${queueState === "completed" ? " is-completed" : ""}${isDragging ? " is-dragging" : ""}${
                isDropTarget ? " is-drop-target" : ""
              }${selectedReportPlayerId === entry.playerId ? " is-selected" : ""}`}
              draggable
              data-testid={entry.isFocusTarget ? "scouting-queue-focus-row" : "scouting-queue-row"}
              onDragStart={(event) => {
                setDraggedPlayerId(entry.playerId);
                event.dataTransfer.setData("text/plain", entry.playerId);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDraggedPlayerId(null);
                setDropIndex(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const droppedPlayerId = event.dataTransfer.getData("text/plain") || draggedPlayerId;
                setDraggedPlayerId(null);
                setDropIndex(null);
                if (droppedPlayerId && droppedPlayerId !== entry.playerId) {
                  onReorder(droppedPlayerId, index);
                }
              }}
            >
              <span className="scouting-queue-rank" aria-hidden="true">
                {index + 1}
              </span>
              <div className="scouting-queue-drag-handle" style={reorderHandleWrapStyle}>
                <span title="Ziehen zum Umsortieren" aria-hidden="true">
                  ⠿
                </span>
                {/* #T-082 — Tastatur-Alternative zum Drag&Drop: dieselben onReorder-Semantiken
                    wie onDrop oben (Ziel-Index im vollen entries-Array), per Button statt Ziehen. */}
                <div className="scouting-queue-reorder-buttons" role="group" aria-label={`${entry.playerName}: Position in der Warteschlange ändern`} style={reorderButtonGroupStyle}>
                  <button
                    type="button"
                    style={index === 0 ? reorderButtonDisabledStyle : reorderButtonStyle}
                    onClick={() => onReorder(entry.playerId, index - 1)}
                    disabled={index === 0}
                    aria-label={`${entry.playerName} in der Warteschlange nach oben verschieben`}
                    title="Nach oben"
                  >
                    <span aria-hidden="true">▲</span>
                  </button>
                  <button
                    type="button"
                    style={index === entries.length - 1 ? reorderButtonDisabledStyle : reorderButtonStyle}
                    onClick={() => onReorder(entry.playerId, index + 1)}
                    disabled={index === entries.length - 1}
                    aria-label={`${entry.playerName} in der Warteschlange nach unten verschieben`}
                    title="Nach unten"
                  >
                    <span aria-hidden="true">▼</span>
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="scouting-queue-portrait"
                onClick={() => onOpenPlayer(entry.playerId)}
                title="Spielerprofil öffnen"
              >
                {previewSrc ? (
                  <BudgetedMediaImage
                    src={src}
                    placeholderSrc={previewSrc}
                    alt=""
                    className=""
                    width={40}
                    height={40}
                    loading="lazy"
                    fetchPriority="low"
                  />
                ) : (
                  <span className="scouting-queue-portrait-fallback">{getInitials(entry.playerName)}</span>
                )}
              </button>
              <button type="button" className="scouting-queue-info" onClick={() => onSelectReport?.(entry.playerId)}>
                <strong>{entry.playerName}</strong>
                <small>
                  {entry.className} · {entry.race}
                </small>
                {entry.isFocusTarget ? (
                  <NlProgressBar
                    className="scouting-queue-progress-bar"
                    value={entry.certainty}
                    max={100}
                    tone="accent"
                    label="Fokus"
                    format={(v) => `${Math.round(v)}% Intel${focusEtaLabel ? ` · ${focusEtaLabel}` : ""}`}
                    title={`Fokus-Ziel, ${entry.certainty}% Intel`}
                  />
                ) : (
                  <span className="scouting-queue-status muted">
                    {entry.isFullyScouted
                      ? "Vollständig gescoutet"
                      : queueState === "active"
                        ? `${entry.certainty}% Intel · Hintergrund`
                        : "Wartet auf freien Scout-Slot"}
                  </span>
                )}
              </button>
              {entry.isFocusTarget ? <span className="scouting-queue-badge is-focus">🔍 Fokus</span> : null}
              {entry.verdict ? (
                <ScoutGradeRing
                  verdict={entry.verdict}
                  size="sm"
                  expanded={verdictOpen}
                  onClick={() => setOpenVerdictPlayerId((current) => (current === entry.playerId ? null : entry.playerId))}
                  className="scouting-queue-grade"
                />
              ) : null}
              <button
                type="button"
                className="scouting-queue-remove"
                onClick={() => onRemove(entry.playerId)}
                title="Von Wishlist entfernen"
                aria-label={`${entry.playerName} von Wishlist entfernen`}
              >
                ✕
              </button>
            </div>
            {verdictOpen && entry.verdict ? (
              <ScoutVerdictReport
                verdict={entry.verdict}
                playerName={entry.playerName}
                compact
                onClose={() => setOpenVerdictPlayerId(null)}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
