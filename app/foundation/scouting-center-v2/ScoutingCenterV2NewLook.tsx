"use client";

import { useState } from "react";

import type { ScoutingHubV2ClientProps, ScoutingHubV2TabId } from "@/app/foundation/scouting-center-v2/scouting-center-v2-types";
import ScoutingPriorityQueue from "@/app/foundation/scouting-center-v2/ScoutingPriorityQueue";
import ScoutingReportPanel from "@/app/foundation/scouting-center-v2/ScoutingReportPanel";
import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import { NlCard, NlGauge, NlProgressBar, NlSubTabs, StatChip, StatChipRow } from "@/components/foundation/new-look";
import { VeloStarRating } from "@/components/foundation/velo-ui/VeloStarRating";
import { appendMediaImageVariant, getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";

/**
 * "Neuer Look" Scouting-Center — flag-gated, additiv.
 *
 * Wird nur gerendert, wenn `useNewLook` aktiv ist; `ScoutingCenterV2Client`
 * fällt ohne Flag byte-identisch auf die bestehende Ansicht zurück.
 * Konsumiert exakt dieselben Props: Tab-Struktur (overview/reports/recommended),
 * `queueEntries`, `scoutPipeline`, Reveal-Stufen sowie die echten Handler
 * (`onOpenMarket`, `onOpenFacilities`, `onOpenPlayer`, `onReorderQueue`,
 * `onRemoveFromQueue`, `onSelectReportPlayer`). Die Wishlist-Warteschlange und
 * der Report-Panel werden als bestehende Komponenten wiederverwendet.
 *
 * Bewusst weggelassen (keine echten Daten in den Props):
 * - keine Preis-/MW-Angaben auf den Empfehlungs-Karten (ScoutingQueueRow trägt
 *   keinen Marktwert) — dafür Intel-Ring + Scouting-Sterne aus echten Feldern.
 */

const NL_SCOUT_REVEAL_STEP_LABELS = ["Basis", "Range", "Trait+", "Sterne", "Diszi", "Exakt"];

function getNlScoutInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

type NlScoutPortraitCardEntry = {
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  certainty: number;
  effectiveScoutingLevel: number;
  isFullyScouted: boolean;
};

function NlScoutPortraitCard({
  entry,
  statusLabel,
  statusTone,
  etaLabel,
  onOpenPlayer,
  onOpenReport,
}: {
  entry: NlScoutPortraitCardEntry;
  statusLabel: string;
  statusTone: "ready" | "focus";
  etaLabel?: string | null;
  onOpenPlayer: (playerId: string) => void;
  onOpenReport: () => void;
}) {
  const src = getPlayerPortraitBrowserUrl(entry.playerId, null, null);
  const previewSrc = appendMediaImageVariant(src, "preview") ?? src;

  return (
    <article className={`nl-scout-player-card${entry.isFullyScouted ? " is-ready" : ""}`}>
      <div className="nl-scout-player-card-top">
        <button
          type="button"
          className="nl-scout-player-portrait"
          onClick={() => onOpenPlayer(entry.playerId)}
          title={`${entry.playerName} — Spielerprofil öffnen`}
        >
          <span className="nl-scout-intel-ring" aria-hidden="true">
            <NlGauge
              value={Math.max(0, Math.min(100, entry.certainty))}
              max={100}
              tone={entry.isFullyScouted ? "good" : "accent"}
              format={(value) => `${Math.round(value)}%`}
              label="Intel"
              className="nl-scout-intel-gauge"
            />
          </span>
          {previewSrc ? (
            <BudgetedMediaImage
              src={src}
              placeholderSrc={previewSrc}
              alt=""
              width={64}
              height={64}
              loading="lazy"
              fetchPriority="low"
              className="nl-scout-player-portrait-img"
            />
          ) : (
            <span className="nl-scout-player-portrait-fallback">{getNlScoutInitials(entry.playerName)}</span>
          )}
        </button>
        <div className="nl-scout-player-copy">
          <strong>{entry.playerName}</strong>
          <small>
            {entry.className} · {entry.race}
          </small>
          <VeloStarRating
            value={entry.effectiveScoutingLevel}
            label="Scouting"
            compact
            className="nl-scout-player-stars"
          />
        </div>
      </div>
      <div className="nl-scout-player-card-foot">
        <span className={`nl-scout-status-pill ${statusTone === "ready" ? "is-ready" : "is-focus"}`}>
          {statusLabel}
          {etaLabel ? ` · ${etaLabel}` : ""}
        </span>
        <button type="button" className="nl-scout-inline-action" onClick={onOpenReport}>
          Report öffnen
        </button>
      </div>
    </article>
  );
}

export default function ScoutingCenterV2NewLook({
  teamName,
  scoutingFacilityLevel,
  scoutingFacilityLabel,
  recruitmentBudget,
  rosterCount,
  rosterMinimum,
  draftContextNote,
  disclosureLevel,
  visibleAtTier,
  hiddenAtTier,
  baseInfoAlwaysVisible,
  scoutPipeline = null,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  hideSubNav = false,
  onOpenMarket,
  onOpenFacilities,
  onOpenPlayer,
  queueEntries = [],
  focusEtaLabel = null,
  wishlistSlotLimit = null,
  onReorderQueue,
  onRemoveFromQueue,
  report = null,
  selectedReportPlayerId = null,
  onSelectReportPlayer,
}: ScoutingHubV2ClientProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<ScoutingHubV2TabId>("overview");
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = (tab: ScoutingHubV2TabId) => {
    onActiveTabChange?.(tab);
    if (controlledActiveTab == null) {
      setInternalActiveTab(tab);
    }
  };

  const rosterGap = rosterMinimum != null && rosterCount < rosterMinimum ? rosterMinimum - rosterCount : 0;
  const readyToBuyEntries = queueEntries.filter((entry) => entry.isFullyScouted);
  const focusEntry = queueEntries.find((entry) => entry.isFocusTarget && !entry.isFullyScouted) ?? null;

  return (
    <div className="nl-scout" data-testid="foundation-scouting-hub-v2" id="foundation-scouting-hub-v2" data-new-look="true">
      <NlCard
        className="nl-scout-header-card"
        eyebrow="Scouting"
        title={teamName}
        actions={
          <div className="nl-scout-header-actions">
            <VeloStarRating value={scoutingFacilityLevel} label={scoutingFacilityLabel} compact />
          </div>
        }
      >
        <p className="nl-scout-header-meta">
          {scoutingFacilityLabel} · L{scoutingFacilityLevel}
          {rosterGap > 0 ? ` · −${rosterGap} Kader` : ""}
        </p>
      </NlCard>

      {!hideSubNav ? (
        <NlSubTabs
          className="nl-scout-subtabs"
          aria-label="Scouting-Bereiche"
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id as ScoutingHubV2TabId)}
          items={[
            { id: "overview", label: "Übersicht", count: queueEntries.length || undefined },
            { id: "reports", label: "Scouting Report" },
            { id: "recommended", label: "Empfehlungen", count: readyToBuyEntries.length || undefined },
          ]}
        />
      ) : null}

      {activeTab === "overview" || activeTab === "recommended" ? (
        <StatChipRow className="nl-scout-stats" aria-label="Scouting-Kennzahlen">
          <StatChip label="Budget" value={recruitmentBudget} tone="accent" title={draftContextNote} />
          <StatChip
            label="Kader"
            value={rosterMinimum != null ? `${rosterCount}/${rosterMinimum}` : rosterCount}
            tone={rosterGap > 0 ? "warn" : "good"}
            sub={rosterGap > 0 ? `−${rosterGap} bis Minimum` : "Minimum erreicht"}
            title={draftContextNote}
          />
          <StatChip
            label="Scouting-Stufe"
            value={`L${disclosureLevel}/5`}
            tone="men"
            sub={scoutingFacilityLabel}
            title="Progressive Enthüllung im Transfermarkt — Base-Infos bleiben für Rekrutierung sichtbar."
          />
        </StatChipRow>
      ) : null}

      {activeTab === "overview" ? (
        <>
          <NlCard className="nl-scout-office-card" eyebrow="Scouting Office" title="Slots & Speed pro Spieltag">
            {scoutingFacilityLevel <= 0 ? (
              <>
                <p className="nl-scout-muted">
                  Noch kein Scouting Office gebaut — die Warteschlange läuft ohne Fortschritt. Bau eins, damit
                  Fokus-Ziele Intel sammeln.
                </p>
                {onOpenFacilities ? (
                  <button type="button" className="nl-scout-primary-action" onClick={onOpenFacilities}>
                    Scouting Office bauen
                  </button>
                ) : null}
              </>
            ) : (
              <>
                {scoutPipeline ? (
                  <>
                    {scoutPipeline.draftSuspended ? (
                      <p className="nl-scout-muted">
                        Draft-Phase — Slots ohne Limit ({scoutPipeline.occupiedSlots} belegt)
                      </p>
                    ) : (
                      <NlProgressBar
                        value={scoutPipeline.occupiedSlots}
                        max={Math.max(1, scoutPipeline.maxSlots)}
                        label="Scouting-Slots belegt"
                        tone="accent"
                        format={(value, max) => `${Math.round(value)}/${Math.round(max)}`}
                      />
                    )}
                    <div className="nl-scout-rate-row">
                      <StatChip label="Fokus · Platz 1" value={`+${scoutPipeline.focusTickGain}%`} tone="accent" sub="pro Spieltag" />
                      <StatChip label="Rest der Wishlist" value={`+${scoutPipeline.wishlistTickGain}%`} tone="neutral" sub="pro Spieltag" />
                      <StatChip
                        label="Passive Scouts"
                        value={`${scoutPipeline.passiveActive}/${scoutPipeline.passiveSlots}`}
                        tone="neutral"
                        sub={`+${scoutPipeline.passiveTickGain}%/Spieltag`}
                      />
                    </div>
                  </>
                ) : null}
                {scoutingFacilityLevel < 5 ? (
                  onOpenFacilities ? (
                    <button type="button" className="nl-scout-inline-action" onClick={onOpenFacilities}>
                      Facility upgraden für mehr Speed
                    </button>
                  ) : null
                ) : (
                  <span className="nl-scout-status-pill is-ready">Max-Level erreicht</span>
                )}
              </>
            )}
          </NlCard>

          <NlCard className="nl-scout-reveal-card" eyebrow="Fog of War" title={`Enthüllung bei Scouting L${disclosureLevel}`}>
            <div className="nl-scout-reveal-ladder" role="list" aria-label="Scouting-Enthüllungsstufe">
              {NL_SCOUT_REVEAL_STEP_LABELS.map((label, level) => (
                <div
                  key={label}
                  role="listitem"
                  className={`nl-scout-reveal-step${level <= disclosureLevel ? " is-reached" : ""}${level === disclosureLevel ? " is-current" : ""}`}
                  title={`L${level} · ${label}`}
                >
                  <span className="nl-scout-reveal-dot nl-tnum">{level}</span>
                  <small>{label}</small>
                </div>
              ))}
            </div>
            <div className="nl-scout-reveal-pills">
              {baseInfoAlwaysVisible.map((entry) => (
                <span key={entry} className="nl-scout-reveal-pill is-base" title={entry}>
                  ✓ {entry}
                </span>
              ))}
              {visibleAtTier.map((entry) => (
                <span key={entry} className="nl-scout-reveal-pill is-visible" title={entry}>
                  ✓ {entry}
                </span>
              ))}
              {hiddenAtTier.map((entry) => (
                <span key={entry} className="nl-scout-reveal-pill is-hidden" title={entry}>
                  🔒 {entry}
                </span>
              ))}
            </div>
          </NlCard>

          <NlCard
            className="nl-scout-queue-card"
            eyebrow="Scouting-Warteschlange"
            title="Wishlist — per Drag & Drop sortieren"
          >
            <p className="nl-scout-muted">
              {scoutPipeline
                ? scoutPipeline.draftSuspended
                  ? `${queueEntries.length} auf der Wishlist · Draft ohne Limit`
                  : `${queueEntries.length} auf der Wishlist · ${scoutPipeline.maxSlots} aktive Slots`
                : `${queueEntries.length} auf der Wishlist`}
              {" — Platz 1 zuerst, Rest folgt automatisch."}
            </p>
            <ScoutingPriorityQueue
              entries={queueEntries}
              focusEtaLabel={focusEtaLabel}
              slotLimit={scoutPipeline?.draftSuspended ? null : (scoutPipeline?.maxSlots ?? wishlistSlotLimit)}
              selectedReportPlayerId={selectedReportPlayerId}
              onReorder={(playerId, targetIndex) => onReorderQueue?.(playerId, targetIndex)}
              onOpenPlayer={onOpenPlayer}
              onRemove={(playerId) => onRemoveFromQueue?.(playerId)}
              onSelectReport={(playerId) => {
                onSelectReportPlayer?.(playerId);
                setActiveTab("reports");
              }}
              onOpenMarket={onOpenMarket}
            />
          </NlCard>
        </>
      ) : null}

      {activeTab === "reports" ? (
        <NlCard className="nl-scout-report-card">
          <ScoutingReportPanel
            report={report}
            onOpenPlayer={onOpenPlayer}
            onPromoteToFocus={(playerId) => onReorderQueue?.(playerId, 0)}
            onRemove={(playerId) => onRemoveFromQueue?.(playerId)}
            canPromoteToFocus={queueEntries.length > 1}
          />
          {queueEntries.length > 1 ? (
            <div className="nl-scout-report-picker">
              <span className="nl-scout-eyebrow">Andere Wishlist-Spieler</span>
              <div className="nl-scout-report-picker-chips">
                {queueEntries
                  .filter((entry) => entry.playerId !== report?.playerId)
                  .map((entry) => (
                    <button
                      key={entry.playerId}
                      type="button"
                      className="nl-scout-picker-chip"
                      onClick={() => onSelectReportPlayer?.(entry.playerId)}
                    >
                      {entry.playerName}
                    </button>
                  ))}
              </div>
            </div>
          ) : null}
        </NlCard>
      ) : null}

      {activeTab === "recommended" ? (
        <NlCard
          className="nl-scout-recommend-card"
          eyebrow="Empfehlungen"
          title="Nächste Schritte"
          data-testid="scouting-recommendations"
        >
          <p className="nl-scout-muted">
            Voll gescoutete Wishlist-Spieler sind kaufbereit. Der Fokus in der Übersicht scoutet den nächsten Kandidaten
            automatisch weiter.
          </p>

          {focusEntry ? (
            <div className="nl-scout-focus-strip">
              <span className="nl-scout-eyebrow">Aktueller Fokus</span>
              <NlScoutPortraitCard
                entry={focusEntry}
                statusLabel={`${focusEntry.certainty}% Intel`}
                statusTone="focus"
                etaLabel={focusEtaLabel}
                onOpenPlayer={onOpenPlayer}
                onOpenReport={() => {
                  onSelectReportPlayer?.(focusEntry.playerId);
                  setActiveTab("reports");
                }}
              />
            </div>
          ) : null}

          {readyToBuyEntries.length > 0 ? (
            <>
              <span className="nl-scout-eyebrow">Kaufbereit</span>
              <div className="nl-scout-ready-grid">
                {readyToBuyEntries.map((entry) => (
                  <NlScoutPortraitCard
                    key={entry.playerId}
                    entry={entry}
                    statusLabel="Kaufbereit"
                    statusTone="ready"
                    onOpenPlayer={onOpenPlayer}
                    onOpenReport={() => {
                      onSelectReportPlayer?.(entry.playerId);
                      setActiveTab("reports");
                    }}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="nl-scout-muted nl-scout-recommend-empty">Noch niemand vollständig gescoutet.</p>
          )}
        </NlCard>
      ) : null}

      {activeTab === "overview" || activeTab === "recommended" ? (
        <div className="nl-scout-footer-actions">
          <button type="button" className="nl-scout-primary-action" onClick={onOpenMarket}>
            Transfermarkt öffnen
          </button>
        </div>
      ) : null}
    </div>
  );
}
