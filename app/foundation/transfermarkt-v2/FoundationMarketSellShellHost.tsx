"use client";

import type { Dispatch, SetStateAction } from "react";

import ClassColorChip from "@/app/foundation/ClassColorChip";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import {
  describeSellPreviewIssue,
  formatBoardTrustMoodLabel,
  formatBoardTrustPolicyLabel,
  formatDoctrinePersonaLabel,
  formatGmArchetypeLabel,
  formatGmPressureLabel,
  formatMatchdayShortLabel,
  formatReadinessAfterSellLabel,
  formatRosterRoleTagLabel,
  translateSellBlockingReason,
  translateSellWarning,
} from "@/app/foundation/transfermarkt-v2/transfer-sell-view-labels";
import { NlMarketBeforeAfterRow } from "@/app/foundation/transfermarkt-v2/TransfermarktV2NewLook";
import { NlCard, NlCountUpValue, StatChip, StatChipRow } from "@/components/foundation/new-look";
import type { Team } from "@/lib/data/olyDataTypes";
import { formatLocalePoints } from "@/lib/foundation/tabs/home-v2-ui-helpers";
import {
  useMarketSellDerivations,
  type MarketSellPlayerPerformance,
  type MarketSellPlayerRatingsById,
  type TransfermarktSellPreviewSubject,
  type TransfermarktSellSummary,
  type UseMarketSellDerivationsInput,
} from "@/lib/foundation/tabs/use-market-sell-derivations";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
import {
  formatPpsValue,
  formatSignedTransfermarktCurrency,
  formatWholeNumber,
} from "@/lib/foundation/tabs/foundation-format-render-helpers";

function getTransferTypePillClass(type: "buy" | "sell" | "contract_exit") {
  return `transfer-status-pill ${type === "buy" ? "is-ready" : "is-warning"}`;
}

/** Ampel-Ton für den projizierten Aufstellungs-Status nach Verkauf. */
function getReadinessTone(status: string | null | undefined): "good" | "neutral" | "risk" {
  if (!status || status === "unknown") return "neutral";
  return status === "ready" ? "good" : "risk";
}

export type FoundationMarketSellShellHostProps = {
  readMetaSource: "sqlite" | "prisma";
  selectedTeam: Team | null;
  marketSellPreview: TransfermarktSellSummary | null;
  marketSellSubject: TransfermarktSellPreviewSubject | null;
  marketSellBusy: boolean;
  marketSellError: string | null;
  marketSellSuccess: string | null;
  marketSellRiskAcknowledged: boolean;
  onMarketSellRiskAcknowledgedChange: Dispatch<SetStateAction<boolean>>;
  playerRatingsById: MarketSellPlayerRatingsById;
  playerSeasonPerformanceMap: Map<string, MarketSellPlayerPerformance>;
  derivationsInput: Omit<
    UseMarketSellDerivationsInput,
    | "marketSellPreview"
    | "marketSellSubject"
    | "playerRatingsById"
    | "playerSeasonPerformanceMap"
  >;
  closeMarketSellModal: () => void;
  confirmTransfermarktSell: () => void | Promise<void>;
  /** Lädt die Verkaufsvorschau erneut (Fehlerzustand: konkreter nächster Schritt). */
  retryMarketSellPreview?: () => void;
};

/**
 * Market sell drilldown shell host (Strangler Phase 5.3) — Neuer Look.
 *
 * Zustandsmaschine statt Meldungs-Stapel: genau EIN Zustand trägt den Screen —
 * lädt (Skeleton) · Transferfenster zu (ruhiger Info-Screen, kein Fehler) ·
 * Fehler (eine Meldung + Retry) · blockiert (Grund groß nach vorn, Vorschau
 * bleibt lesbar) · bereit (Entscheidungsvorlage) · verkauft (Abschlussmoment).
 *
 * Kontext: Die Sell-Route lehnt Previews außerhalb des Verkaufsfensters mit
 * `phase_blocked:sell_players:<phase>` und `summary: null` ab — das ist ein
 * regulärer Spielzustand (verkauft wird am Saisonende), siehe
 * `describeSellPreviewIssue` in transfer-sell-view-labels.
 */
export default function FoundationMarketSellShellHost({
  readMetaSource,
  selectedTeam,
  marketSellPreview,
  marketSellSubject,
  marketSellBusy,
  marketSellError,
  marketSellSuccess,
  marketSellRiskAcknowledged,
  onMarketSellRiskAcknowledgedChange,
  playerRatingsById,
  playerSeasonPerformanceMap,
  derivationsInput,
  closeMarketSellModal,
  confirmTransfermarktSell,
  retryMarketSellPreview,
}: FoundationMarketSellShellHostProps) {
  const { marketSellPlayerContext } = useMarketSellDerivations({
    ...derivationsInput,
    marketSellPreview,
    marketSellSubject,
    playerRatingsById,
    playerSeasonPerformanceMap,
  });

  const preview = marketSellPreview;
  const context = marketSellPlayerContext;

  // --- Zustands-Ableitung: genau ein tragender Zustand pro Render. ---
  const issue = marketSellError ? describeSellPreviewIssue(marketSellError) : null;
  const isLoading = marketSellBusy && !preview && !marketSellSuccess;
  const showIssueScreen = !isLoading && !marketSellSuccess && !preview && issue != null;
  // Preview vorhanden, aber ein Folge-Fehler (z. B. Bestätigung fehlgeschlagen):
  // eine Banner-Meldung über der weiterhin lesbaren Vorschau.
  const showInlineError = !isLoading && preview != null && issue != null && issue.kind === "error";

  // Friction fix (Generalprobe #4): der Bestätigen-Button war ohne sichtbare
  // Begründung deaktiviert. Der konkrete Grund steht neben dem Button, nicht
  // nur im Tooltip. Kader-Minimum wird zusätzlich immer markiert.
  const rosterAtMinimum =
    (preview?.warnings ?? []).some(
      (warning) => warning === "team_would_fall_under_7" || warning === "team_would_fall_under_player_min",
    );
  const strongAckRequired =
    preview?.coaching != null &&
    (preview.coaching.boardReaction.requiresStrongAcknowledgment ||
      (preview.coaching.gmSoftBlockStarSell && (preview.coaching.keepIntentScore ?? 0) >= 55));
  const strongAckPending = strongAckRequired && !marketSellRiskAcknowledged;
  const sellDisabled = readMetaSource === "prisma" || !preview?.canSell || marketSellBusy || strongAckPending;
  const sellDisabledReason = !sellDisabled
    ? null
    : readMetaSource === "prisma"
      ? "Im Referenzmodus bleibt der Verkauf gesperrt."
      : !preview
        ? issue?.kind === "window_closed"
          ? "Das Verkaufsfenster ist geschlossen — verkauft wird im Verkaufsfenster am Saisonende."
          : issue
            ? "Die Verkaufsvorschau ist nicht verfügbar — bitte neu laden."
            : "Verkaufsvorschau wird noch geladen."
        : !preview.canSell
          ? rosterAtMinimum
            ? "Kader ist am Minimum — verkaufen würde die Aufstellung unmöglich machen. Kaufe zuerst Ersatz, bevor du hier verkaufst."
            : preview.blockingReasons?.[0]
              ? translateSellBlockingReason(preview.blockingReasons[0])
              : "Dieser Verkauf ist gerade noch blockiert."
          : marketSellBusy
            ? "Der Verkauf wird gerade vorbereitet."
            : strongAckPending
              ? "Bitte bestätige zuerst die Board-/GM-Warnung oben, dann kannst du final verkaufen."
              : null;

  // --- Hero-Basisdaten (auch ohne Preview vorhanden: Identität statt Striche). ---
  const playerName = preview?.player?.name ?? marketSellSubject?.playerName ?? "Spieler verkaufen";
  const className = preview?.player?.className ?? marketSellSubject?.className ?? "—";
  const race = preview?.player?.race ?? marketSellSubject?.race ?? "—";
  const portraitSrc = marketSellSubject?.portraitUrl ?? null;
  const teamLabel = preview?.team
    ? `${preview.team.shortCode} · ${preview.team.name}`
    : selectedTeam
      ? `${selectedTeam.shortCode} · ${selectedTeam.name}`
      : "Kein Team gewählt";

  const buyoutCost = preview?.buyoutCost ?? 0;
  const hasBuyout = buyoutCost > 0;
  const netProceeds = preview?.netProceeds ?? preview?.salePrice ?? null;
  const saleVsMarketValue =
    preview?.salePrice != null && preview.marketValueReference != null
      ? preview.salePrice - preview.marketValueReference
      : null;
  const saleProfit = context?.saleProfit ?? preview?.profit ?? null;

  const statusPill =
    readMetaSource === "prisma"
      ? { className: "", label: "nur Ansicht" }
      : marketSellSuccess
        ? { className: " is-ready", label: "verkauft" }
        : isLoading
          ? { className: " is-warning", label: "wird geprüft" }
          : preview
            ? preview.canSell
              ? { className: " is-ready", label: "bereit" }
              : { className: " is-blocked", label: "geblockt" }
            : issue?.kind === "window_closed"
              ? { className: " is-warning", label: "Fenster zu" }
              : { className: " is-blocked", label: "nicht verfügbar" };

  return (
    <section className="foundation-drilldown-page transfer-sell-page" data-testid="transfer-sell-page" aria-label="Verkaufsdialog">
      <header className="foundation-drilldown-header">
        <div>
          <span className="market-v2-kicker">Verkauf</span>
          <h1>{playerName}</h1>
        </div>
        <button className="secondary-button" type="button" onClick={closeMarketSellModal} disabled={marketSellBusy && preview != null}>
          Zurück
        </button>
      </header>

      <div className="foundation-drilldown-body foundation-modal-body transfer-buy-modal-body">
        {/* Hero: Identität + Verkaufs-KPIs im Kit-Vokabular des Kaufmodals.
            Ohne Preview zeigt der Hero nur die Identität — keine Wand aus „—". */}
        <NlCard
          className="market-v2-buy-hero-card transfer-sell-hero-card"
          eyebrow="Verkaufskandidat"
          title={playerName}
          actions={<span className={`transfer-status-pill${statusPill.className}`}>{statusPill.label}</span>}
        >
          <div className="market-v2-buy-hero">
            <OptimizedMediaImage
              className="transfermarkt-portrait market-v2-buy-hero-portrait"
              src={portraitSrc}
              alt={playerName}
              width={72}
              height={72}
              loading="lazy"
              fetchPriority="low"
              fallback={
                <div
                  className="transfermarkt-portrait transfermarkt-portrait-placeholder market-v2-buy-hero-portrait"
                  aria-label={`${playerName} placeholder`}
                >
                  {playerName.slice(0, 2).toUpperCase()}
                </div>
              }
            />
            <div className="market-v2-buy-hero-copy">
              <div className="market-v2-buy-hero-meta">
                <ClassColorChip className={className} />
                <span>{race}</span>
                <span className="market-v2-buy-hero-tag">{teamLabel}</span>
                {preview?.activePlayer ? (
                  <span className="market-v2-buy-hero-tag">
                    Rolle {formatRosterRoleTagLabel(preview.activePlayer.roleTag)}
                  </span>
                ) : null}
              </div>
              {preview ? (
                <StatChipRow className="market-v2-buy-hero-stats" aria-label="Verkaufs-Kennzahlen">
                  <StatChip
                    label="Netto-Erlös"
                    value={formatTransfermarktCurrency(netProceeds)}
                    tone="accent"
                    sub={
                      hasBuyout
                        ? `Brutto ${formatTransfermarktCurrency(preview.salePrice)} − Buyout ${formatTransfermarktCurrency(buyoutCost)}`
                        : `Brutto ${formatTransfermarktCurrency(preview.salePrice)} · kein Buyout`
                    }
                  />
                  <StatChip
                    label="Verkaufspreis"
                    value={formatTransfermarktCurrency(preview.salePrice)}
                    tone="neutral"
                    sub={`vs. MW ${saleVsMarketValue != null ? formatSignedTransfermarktCurrency(saleVsMarketValue) : "—"}`}
                  />
                  <StatChip
                    label="Faktor"
                    value={preview.saleFactor != null ? `${formatLocalePoints(preview.saleFactor, 2)}x` : "—"}
                    tone="neutral"
                    sub="auf den Marktwert"
                  />
                  <StatChip
                    label="GuV"
                    value={saleProfit != null ? formatSignedTransfermarktCurrency(saleProfit) : "—"}
                    tone={saleProfit != null ? (saleProfit >= 0 ? "good" : "risk") : "neutral"}
                    sub="Netto minus Einstieg"
                  />
                  <StatChip
                    label="OVR"
                    value={formatWholeNumber(context?.rating?.ovrNormalized ?? context?.player?.ovr ?? null)}
                    tone="neutral"
                    sub={`PPs ${formatPpsValue(context?.rating?.ppsSeason ?? context?.performance?.totalPoints ?? null)}`}
                  />
                </StatChipRow>
              ) : null}
            </div>
          </div>
        </NlCard>

        {/* --- Zustandsschicht: genau EIN tragender Zustand. --- */}

        {marketSellSuccess ? (
          // Abschlussmoment analog zum „VERPFLICHTET"-Moment des Kaufmodals:
          // Netto-Erlös und Cash danach zählen hoch (NlCountUpValue respektiert
          // prefers-reduced-motion), die Karte fährt über `.nl-reveal` ein.
          <div
            className="transfer-feedback-banner is-success market-v2-buy-signed nl-reveal"
            data-testid="transfer-sell-sold"
            role="status"
            aria-live="polite"
          >
            <strong>Verkauf abgeschlossen</strong>
            <span>{marketSellSuccess}</span>
            {preview ? (
              <div className="market-v2-buy-signed-figures" aria-label="Erlös und Cash">
                <span className="market-v2-buy-signed-figure">
                  <small>Netto-Erlös</small>
                  <NlCountUpValue
                    value={netProceeds}
                    format={(value) => formatTransfermarktCurrency(value)}
                    className="market-v2-buy-signed-value nl-tnum"
                  />
                </span>
                <span className="market-v2-buy-signed-figure">
                  <small>Cash danach</small>
                  <NlCountUpValue
                    value={preview.cashAfter}
                    format={(value) => formatTransfermarktCurrency(value)}
                    className="market-v2-buy-signed-value nl-tnum"
                  />
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {isLoading ? (
          // Echter Ladezustand statt leerer Kacheln mit „—".
          <div
            className="transfer-buy-preview-skeleton"
            data-testid="transfer-sell-preview-skeleton"
            aria-busy="true"
            aria-label="Verkaufsvorschau lädt"
          >
            <div className="transfer-buy-preview-skeleton__banner">
              <strong>Verkaufsvorschau lädt</strong>
              <span>Preis, Erlös und Team-Auswirkung werden berechnet.</span>
            </div>
            <div className="transfer-buy-preview-skeleton__grid">
              <div className="transfer-buy-preview-skeleton__block" />
              <div className="transfer-buy-preview-skeleton__block" />
              <div className="transfer-buy-preview-skeleton__block" />
              <div className="transfer-buy-preview-skeleton__block is-wide" />
            </div>
          </div>
        ) : null}

        {showIssueScreen && issue ? (
          issue.kind === "window_closed" ? (
            // Regulärer Spielzustand, kein Fehler: ruhig erklären, wann verkauft wird.
            <div className="transfer-callout is-info transfer-sell-state-callout" data-testid="transfer-sell-window-closed" role="status">
              <span className="transfer-sell-state-kicker">{issue.title}</span>
              <strong className="transfer-sell-state-headline">{issue.message}</strong>
              {issue.hint ? <span className="transfer-sell-state-hint">{issue.hint}</span> : null}
            </div>
          ) : (
            // Echter Fehler: EINE Meldung, ein konkreter nächster Schritt.
            <div className="transfer-callout is-blocked transfer-sell-state-callout" data-testid="transfer-sell-preview-error" role="alert">
              <span className="transfer-sell-state-kicker">{issue.title}</span>
              <strong className="transfer-sell-state-headline">{issue.message}</strong>
              {issue.hint ? <span className="transfer-sell-state-hint">{issue.hint}</span> : null}
              {retryMarketSellPreview ? (
                <div className="transfer-sell-state-actions">
                  <button
                    className="secondary-button inline-button"
                    type="button"
                    data-testid="transfer-sell-retry-button"
                    onClick={retryMarketSellPreview}
                  >
                    Vorschau neu laden
                  </button>
                </div>
              ) : null}
            </div>
          )
        ) : null}

        {showInlineError && issue ? (
          <div className="transfer-feedback-banner is-error" data-testid="transfer-sell-inline-error" role="alert">
            <strong>{issue.title}</strong>
            <span>{issue.message}</span>
          </div>
        ) : null}

        {preview ? (
          <>
            {!preview.canSell ? (
              // Blockiert mit Grund: der Grund groß und einzeln nach vorn.
              <div className="transfer-callout is-blocked transfer-sell-state-callout" data-testid="transfer-sell-blocked-callout">
                <span className="transfer-sell-state-kicker">Verkauf blockiert</span>
                <strong className="transfer-sell-state-headline">
                  {preview.blockingReasons[0]
                    ? translateSellBlockingReason(preview.blockingReasons[0])
                    : "Dieser Verkauf ist gerade nicht möglich."}
                </strong>
                {preview.blockingReasons.length > 1 ? (
                  <ul className="warning-list">
                    {preview.blockingReasons.slice(1).map((reason) => (
                      <li key={reason}>{translateSellBlockingReason(reason)}</li>
                    ))}
                  </ul>
                ) : null}
                <span className="transfer-sell-state-hint">
                  Die Vorschau unten bleibt vollständig lesbar — nur der letzte Klick ist gesperrt.
                </span>
              </div>
            ) : null}

            {preview.warnings.length ? (
              <div className="transfer-callout is-warning" data-testid="transfer-sell-warnings">
                <div className="transfer-callout-title">
                  <strong>Warnungen</strong>
                  <span className="muted">{preview.warnings.length}</span>
                </div>
                <ul className="warning-list">
                  {preview.warnings.map((warning) => (
                    <li key={warning}>{translateSellWarning(warning)}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Team-Auswirkung: Vorher→Nachher in derselben Delta-Chip-Sprache
                wie Deal-Desk und Kaufmodal (NlMarketBeforeAfterRow). */}
            <NlCard
              className="market-v2-buy-impact-card transfer-sell-impact-card"
              eyebrow="Vorher → Nachher beim Verkauf"
              title="Team-Auswirkung"
            >
              <div className="nl-market-deal-rows" aria-label="Vorher-Nachher mit Verkauf">
                <NlMarketBeforeAfterRow
                  label="Cash"
                  before={preview.cashBefore}
                  after={preview.cashAfter}
                  format={(value) => formatTransfermarktCurrency(value)}
                />
                <NlMarketBeforeAfterRow
                  label="Teamgehalt"
                  before={preview.teamSalaryBefore}
                  after={preview.teamSalaryAfter}
                  format={(value) => formatTransfermarktCurrency(value)}
                  invert
                />
                <NlMarketBeforeAfterRow
                  label="Kader"
                  before={preview.rosterBefore}
                  after={preview.rosterAfter}
                  format={(value) => (value != null ? String(Math.round(value)) : "—")}
                />
              </div>
              <StatChipRow className="transfer-sell-impact-stats" aria-label="Aufstellung und Entlastung">
                <StatChip
                  label="Aufstellung danach"
                  value={formatReadinessAfterSellLabel(preview.projectedReadinessAfterSell)}
                  tone={getReadinessTone(preview.projectedReadinessAfterSell)}
                  sub="Aufstellungs-Check"
                />
                <StatChip
                  label="Entlastung p.a."
                  value={formatTransfermarktCurrency(preview.salaryReduction)}
                  tone="good"
                  sub="Gehalt fällt weg"
                />
              </StatChipRow>
            </NlCard>

            {preview.coaching ? (
              <NlCard
                className="transfer-sell-coaching-card"
                eyebrow={`Doktrin: ${formatDoctrinePersonaLabel(preview.coaching.doctrinePersona)}`}
                title="Strategie & Board"
                data-testid="transfer-sell-coaching-panel"
              >
                <p className="nl-market-muted">{preview.coaching.strategyFitSummary}</p>
                <div className="metric-grid compact transfer-sell-metric-grid">
                  <article className="metric-card">
                    <span>Auto-Empfehlung</span>
                    <strong>{preview.coaching.sellDecisionLabel ?? "—"}</strong>
                    <small>Priorität {preview.coaching.sellPriority ?? "—"}</small>
                  </article>
                  <article className="metric-card">
                    <span>GM</span>
                    <strong>{preview.coaching.gmName ?? "—"}</strong>
                    <small>
                      {formatGmArchetypeLabel(preview.coaching.gmArchetype)} ·{" "}
                      {formatGmPressureLabel(preview.coaching.gmPressureLevel)}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>Board</span>
                    <strong>{preview.coaching.boardReaction.title}</strong>
                    <small>
                      Stimmung {formatBoardTrustMoodLabel(preview.coaching.boardTrustSmiley)} ·{" "}
                      {formatBoardTrustPolicyLabel(preview.coaching.boardTrustPolicy)}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>Marktsperre</span>
                    <strong>1 Saison</strong>
                    <small>{preview.coaching.soldPlayerSeasonBanNote}</small>
                  </article>
                </div>
                {preview.coaching.gmWarning ? (
                  <div className="transfer-feedback-banner is-warning">
                    <strong>GM-Hinweis</strong>
                    <span>{preview.coaching.gmWarning}</span>
                    {preview.coaching.gmDetail ? <small className="muted">{preview.coaching.gmDetail}</small> : null}
                  </div>
                ) : null}
                {preview.coaching.replacementSlot ? (
                  <div className="transfer-callout is-warning">
                    <strong>Nachfolger-Slot</strong>
                    <p>{preview.coaching.replacementSlot.slotLabel}</p>
                    <small className="muted">
                      Budget bis {formatTransfermarktCurrency(preview.coaching.replacementSlot.maxBuyPrice)} · Ziel-OVR{" "}
                      {preview.coaching.replacementSlot.minOvrBand ?? "—"}
                    </small>
                  </div>
                ) : null}
                {/* Sichtbarkeit der Risiko-Bestätigung MUSS exakt der
                    `strongAckRequired`-Bedingung entsprechen, die oben den Verkauf
                    sperrt (strongAckPending): sobald die Bestätigung sperrt, muss
                    die Checkbox erscheinen — sonst gäbe es einen stillen Dead-End
                    (kritische Board-Reaktion + keepIntent < 55: gesperrt, aber ohne
                    Checkbox und ohne Weg nach vorn). Der keepIntent≥55-Gate gilt
                    nur für den GM-Soft-Block, nicht für die zwingende
                    Board-Bestätigung. */}
                {strongAckRequired ? (
                  <label className="transfer-sell-risk-ack" data-testid="transfer-sell-risk-ack">
                    <input
                      type="checkbox"
                      checked={marketSellRiskAcknowledged}
                      onChange={(event) => onMarketSellRiskAcknowledgedChange(event.target.checked)}
                    />
                    <span>
                      Ich bestätige den Verkauf trotz Board-/GM-Warnung ({preview.coaching.boardReaction.title})
                    </span>
                  </label>
                ) : null}
                <details className="transfer-sell-disclosure">
                  <summary>
                    Gründe für & gegen den Verkauf
                    <span className="muted">
                      {preview.coaching.reasonsToSell.length} dafür · {preview.coaching.reasonsToKeep.length} dagegen
                    </span>
                  </summary>
                  <div className="transfer-sell-disclosure-body">
                    <div className="transfer-buy-meta-grid">
                      <div className="transfer-callout">
                        <strong>Gründe für Verkauf</strong>
                        {preview.coaching.reasonsToSell.length ? (
                          <ul className="warning-list">
                            {preview.coaching.reasonsToSell.map((reason) => (
                              <li key={`sell-${reason}`}>{reason}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted">Keine Verkaufsgründe.</p>
                        )}
                      </div>
                      <div className="transfer-callout">
                        <strong>Gründe dagegen</strong>
                        {preview.coaching.reasonsToKeep.length ? (
                          <ul className="warning-list">
                            {preview.coaching.reasonsToKeep.map((reason) => (
                              <li key={`keep-${reason}`}>{reason}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted">Keine Haltegründe.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              </NlCard>
            ) : null}

            <details className="transfer-sell-disclosure">
              <summary>
                Leistung & PP-Profil
                <span className="muted">
                  {context?.performance?.appearances ?? 0} Einsätze · Season-PPs{" "}
                  {formatPpsValue(context?.rating?.ppsSeason ?? context?.performance?.totalPoints ?? null)}
                </span>
              </summary>
              <div className="transfer-sell-disclosure-body">
                <div className="metric-grid compact transfer-sell-metric-grid">
                  <article className="metric-card">
                    <span>OVR</span>
                    <strong>{formatWholeNumber(context?.rating?.ovrNormalized ?? context?.player?.ovr ?? null)}</strong>
                    <small>Rang {context?.rating?.ovrRank ?? "—"}</small>
                  </article>
                  <article className="metric-card">
                    <span>MVS</span>
                    <strong>{formatPpsValue(context?.rating?.mvs ?? null)}</strong>
                    <small>Rang {context?.rating?.mvsRank ?? "—"}</small>
                  </article>
                  <article className="metric-card">
                    <span>Season PPs</span>
                    <strong>{formatPpsValue(context?.rating?.ppsSeason ?? context?.performance?.totalPoints ?? null)}</strong>
                    <small>Rang {context?.rating?.ppsSeasonRank ?? "—"}</small>
                  </article>
                  <article className="metric-card">
                    <span>Einsätze</span>
                    <strong>{context?.performance?.appearances ?? "—"}</strong>
                    <small>
                      Top 10 {context?.performance?.top10Count ?? "—"} · MVP {context?.performance?.mvpCount ?? "—"}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>Letzter Einsatz</span>
                    <strong>{context?.performance?.latestDisciplineLabel ?? "—"}</strong>
                    <small>
                      Score {formatPpsValue(context?.performance?.latestFinalScore ?? null)} · Rang{" "}
                      {context?.performance?.latestRankInDiscipline ?? "—"}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>Beste Diszi</span>
                    <strong>{context?.performance?.bestDisciplineLabel ?? "—"}</strong>
                    <small>{formatPpsValue(context?.performance?.bestDisciplineScore ?? null)} Score</small>
                  </article>
                </div>
                <div className="transfer-sell-area-grid">
                  {(context?.areaRows ?? []).map((area) => (
                    <article className={`transfer-sell-area-card is-${area.tone}`} key={area.key}>
                      <span>{area.key}</span>
                      <strong>{formatPpsValue(area.value)}</strong>
                    </article>
                  ))}
                </div>
              </div>
            </details>

            <details className="transfer-sell-disclosure">
              <summary>
                Entwicklung & Vertrag
                <span className="muted">
                  MW {formatTransfermarktCurrency(context?.currentMarketValue ?? preview.marketValueReference)} · Gehalt{" "}
                  {formatTransfermarktCurrency(context?.salary ?? preview.activePlayer?.salary ?? null)}
                </span>
              </summary>
              <div className="transfer-sell-disclosure-body">
                <div className="metric-grid compact transfer-sell-metric-grid">
                  <article className="metric-card">
                    <span>MW aktuell</span>
                    <strong>{formatTransfermarktCurrency(context?.currentMarketValue ?? preview.marketValueReference)}</strong>
                    <small>
                      Kaderwert{" "}
                      {formatTransfermarktCurrency(context?.rosterMarketValue ?? preview.activePlayer?.currentValue ?? null)}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>MW Delta</span>
                    <strong
                      className={
                        context?.marketValueDelta != null
                          ? context.marketValueDelta >= 0
                            ? "text-positive"
                            : "text-negative"
                          : undefined
                      }
                    >
                      {context?.marketValueDelta != null ? formatSignedTransfermarktCurrency(context.marketValueDelta) : "—"}
                    </strong>
                    <small>aktuell vs. Kaderwert</small>
                  </article>
                  <article className="metric-card">
                    <span>Kaufpreis</span>
                    <strong>
                      {formatTransfermarktCurrency(context?.purchasePrice ?? preview.activePlayer?.purchasePrice ?? null)}
                    </strong>
                    <small>letzter Einstieg</small>
                  </article>
                  <article className="metric-card">
                    <span>GuV Verkauf</span>
                    <strong
                      className={
                        context?.saleProfit != null ? (context.saleProfit >= 0 ? "text-positive" : "text-negative") : undefined
                      }
                    >
                      {context?.saleProfit != null ? formatSignedTransfermarktCurrency(context.saleProfit) : "—"}
                    </strong>
                    <small>Netto minus Einstieg</small>
                  </article>
                  <article className="metric-card">
                    <span>Gehalt</span>
                    <strong>{formatTransfermarktCurrency(context?.salary ?? preview.activePlayer?.salary ?? null)}</strong>
                    <small
                      className={
                        context?.salaryDelta != null
                          ? context.salaryDelta <= 0
                            ? "text-positive"
                            : "text-negative"
                          : undefined
                      }
                    >
                      vs. normal {context?.salaryDelta != null ? formatSignedTransfermarktCurrency(context.salaryDelta) : "—"}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>Laufzeit</span>
                    <strong>{preview.activePlayer?.contractLength ?? "—"}</strong>
                    <small>Rolle {formatRosterRoleTagLabel(preview.activePlayer?.roleTag)}</small>
                  </article>
                </div>
              </div>
            </details>

            <details className="transfer-sell-disclosure">
              <summary>
                Einsätze, Diszis & Transferhistorie
                <span className="muted">
                  {context?.recentMatchdays.length ?? 0} Spieltage · {context?.topDisciplines.length ?? 0} Diszis ·{" "}
                  {context?.transferEvents.length ?? 0} Transfers
                </span>
              </summary>
              <div className="transfer-sell-disclosure-body">
                <div className="transfer-sell-history-grid">
                  <div className="transfer-modal-section">
                    <div className="transfer-callout-title">
                      <strong>Letzte Einsätze</strong>
                      <span className="muted">{context?.recentMatchdays.length ?? 0}</span>
                    </div>
                    {context?.recentMatchdays.length ? (
                      <div className="transfer-sell-mini-table">
                        {context.recentMatchdays.map((entry) => (
                          <div className="transfer-sell-mini-row" key={entry.matchdayId}>
                            <span>{formatMatchdayShortLabel(entry.matchdayId)}</span>
                            <strong>{formatPpsValue(entry.totalContribution)}</strong>
                            <small>
                              {entry.bestDisciplineLabel ?? "—"} · Score {formatPpsValue(entry.averageFinalScore)}
                            </small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted transfer-empty-hint">Noch keine Matchday-Historie für diesen Spieler.</p>
                    )}
                  </div>

                  <div className="transfer-modal-section">
                    <div className="transfer-callout-title">
                      <strong>Top-Diszis</strong>
                      <span className="muted">{context?.topDisciplines.length ?? 0}</span>
                    </div>
                    {context?.topDisciplines.length ? (
                      <div className="transfer-sell-mini-table">
                        {context.topDisciplines.map((entry) => (
                          <div className="transfer-sell-mini-row" key={entry.disciplineId}>
                            <span>{entry.disciplineName}</span>
                            <strong>{formatPpsValue(entry.totalContribution)}</strong>
                            <small>
                              Ø Beitrag {formatPpsValue(entry.averageContribution)} · Ø Score{" "}
                              {formatPpsValue(entry.averageFinalScore)}
                            </small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted transfer-empty-hint">Noch keine Disziplin-Historie verfügbar.</p>
                    )}
                  </div>

                  <div className="transfer-modal-section">
                    <div className="transfer-callout-title">
                      <strong>Transferhistorie</strong>
                      <span className="muted">{context?.transferEvents.length ?? 0}</span>
                    </div>
                    {context?.transferEvents.length ? (
                      <div className="transfer-sell-mini-table">
                        {context.transferEvents.map((entry) => (
                          <div className="transfer-sell-mini-row" key={entry.id}>
                            <span className={getTransferTypePillClass(entry.type)}>{entry.label}</span>
                            <strong>{formatTransfermarktCurrency(entry.fee)}</strong>
                            <small>
                              {entry.seasonLabel} · {entry.fromTeam} → {entry.toTeam} · Gehalt{" "}
                              {formatTransfermarktCurrency(entry.salary)}
                            </small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted transfer-empty-hint">Keine Transfers im Save gefunden.</p>
                    )}
                  </div>
                </div>
              </div>
            </details>
          </>
        ) : null}
      </div>

      {rosterAtMinimum ? (
        <p className="foundation-screen-action-reason" data-testid="transfer-sell-roster-min-note">
          Kader ist am Minimum — ein weiterer Verkauf würde die Aufstellung unmöglich machen. Kaufe zuerst Ersatz.
        </p>
      ) : null}

      {preview?.canSell && !marketSellSuccess ? (
        <p className="transfer-sell-final-note" data-testid="transfer-sell-final-note">
          Ein Verkauf ist endgültig und lässt sich nicht rückgängig machen.{" "}
          {preview.coaching?.soldPlayerSeasonBanNote ?? "Der Spieler ist danach 1 Saison für dein Team gesperrt."}
        </p>
      ) : null}

      <div className="foundation-modal-actions">
        <button className="secondary-button" type="button" onClick={closeMarketSellModal}>
          Abbrechen
        </button>
        <button
          className="primary-button"
          type="button"
          data-testid="transfer-sell-confirm-button"
          disabled={sellDisabled}
          title={sellDisabledReason ?? "Bestätigt den Verkauf jetzt endgültig."}
          onClick={() => {
            void confirmTransfermarktSell();
          }}
        >
          {marketSellBusy && preview ? "Verkauf läuft…" : "Endgültig verkaufen"}
        </button>
      </div>
      {sellDisabledReason ? (
        <p className="foundation-screen-action-reason" data-testid="transfer-sell-disabled-reason">
          Warum nicht: {sellDisabledReason}
        </p>
      ) : null}
    </section>
  );
}
