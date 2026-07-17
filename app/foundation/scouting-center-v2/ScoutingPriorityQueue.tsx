"use client";

import { useState } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import { NlEmptyState, NlProgressBar } from "@/components/foundation/new-look";
import { appendMediaImageVariant, getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";

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
};

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

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

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

  return (
    <ol className="scouting-queue-list" data-testid="scouting-priority-queue">
      {entries.map((entry, index) => {
        const src = getPlayerPortraitBrowserUrl(entry.playerId, null, null);
        const previewSrc = appendMediaImageVariant(src, "preview") ?? src;
        const isDragging = draggedPlayerId === entry.playerId;
        const isDropTarget = dropIndex === index && draggedPlayerId != null && draggedPlayerId !== entry.playerId;
        const isFirstBookmarkedRow = !entry.isActiveSlot && (index === 0 || entries[index - 1]?.isActiveSlot);

        return (
          <li key={entry.playerId} className="scouting-queue-row-wrapper">
            {isFirstBookmarkedRow ? (
              <div className="scouting-queue-slot-divider" role="presentation">
                <span>Über Slot-Limit{slotLimit != null ? ` (${slotLimit})` : ""} — nur gemerkt</span>
              </div>
            ) : null}
            <div
              className={`scouting-queue-row${entry.isFocusTarget ? " is-focus" : ""}${
                entry.isFullyScouted ? " is-fully-scouted" : ""
              }${!entry.isActiveSlot ? " is-bookmarked" : ""}${isDragging ? " is-dragging" : ""}${
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
              <span className="scouting-queue-drag-handle" title="Ziehen zum Umsortieren" aria-hidden="true">
                ⠿
              </span>
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
                      : entry.isActiveSlot
                        ? `${entry.certainty}% Intel · Hintergrund`
                        : "Wartet auf freien Slot"}
                  </span>
                )}
              </button>
              {entry.isFocusTarget ? <span className="scouting-queue-badge is-focus">🔍 Fokus</span> : null}
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
          </li>
        );
      })}
    </ol>
  );
}
