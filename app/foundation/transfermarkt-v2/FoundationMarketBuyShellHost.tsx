"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";

import ClassIcon from "@/app/foundation/ClassIcon";
import ContractOfferClient from "@/app/foundation/contract-offer/ContractOfferClient";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { appendMediaImageVariant, getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import type { ContractShape, Team, TransferWishlistEntry } from "@/lib/data/olyDataTypes";
import {
  useMarketBuyDerivations,
  type MarketBuyNegotiationOutcome,
  type UseMarketBuyDerivationsInput,
} from "@/lib/foundation/tabs/use-market-buy-derivations";
import type { TransfermarktBuyPreview } from "@/lib/market/transfermarkt-buy-service";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";

function formatCompactNumber(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercentLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${Math.round(value)}%`;
}

function formatSignedPercentDelta(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const formatted = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Math.abs(value) * 100);
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatted}%`;
}

function formatSignedPoints(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${value > 0 ? "+" : ""}${Math.round(value)}`;
}

function formatDemandPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function formatContractLengthPreference(value: "short" | "medium" | "long" | null | undefined) {
  if (value === "short") return "kurze Verträge";
  if (value === "long") return "lange Verträge";
  if (value === "medium") return "mittlere Verträge";
  return "offen";
}

function formatContractShapeLabel(value: ContractShape | null | undefined) {
  if (value === "front_loaded") return "vorne schwer";
  if (value === "back_loaded") return "hinten schwer";
  if (value === "balanced") return "ausgeglichen";
  return "offen";
}

function formatContractPreferenceCurrentStatus(
  contractPreference: {
    preferredMinLength: number;
    preferredMaxLength: number;
    shapePreference: ContractShape;
  },
  contractLength: number | null | undefined,
  contractShape: ContractShape | null | undefined,
) {
  const safeLength = typeof contractLength === "number" && Number.isFinite(contractLength) ? contractLength : null;
  const lengthMatches =
    safeLength != null &&
    safeLength >= contractPreference.preferredMinLength &&
    safeLength <= contractPreference.preferredMaxLength;
  const shapeMatches = contractShape === contractPreference.shapePreference;

  if (lengthMatches && shapeMatches) {
    return "Aktuell: Laufzeit und Form passen gut";
  }
  if (lengthMatches) {
    return `Aktuell: Laufzeit passt, Form stört (${formatContractShapeLabel(contractShape)})`;
  }
  if (shapeMatches) {
    return `Aktuell: Form passt, Laufzeit stört (${safeLength ?? "?"} Saisons)`;
  }
  return `Aktuell: Laufzeit (${safeLength ?? "?"}) und Form (${formatContractShapeLabel(contractShape)}) weichen ab`;
}

export type FoundationMarketBuyShellHostProps = {
  buyModalRef: RefObject<HTMLDivElement | null>;
  buyModalBodyRef: RefObject<HTMLDivElement | null>;
  source: "sqlite" | "prisma";
  selectedTeam: Team | null;
  selectedPlayer: TransfermarktFreeAgentItem | null;
  buyModalWishlistEntry: TransferWishlistEntry | null;
  selectedPortrait: { src: string | null; initials: string } | null;
  selectedTeamCanManage: boolean;
  selectedTeamId: string;
  buyPreview: TransfermarktBuyPreview | null;
  previewBusy: boolean;
  previewError: string | null;
  buyBusy: boolean;
  buySuccess: string | null;
  buyNegotiationOutcome: MarketBuyNegotiationOutcome | null;
  contractLength: number | null;
  contractShape: ContractShape | null;
  offeredSalary: number | null;
  salaryEditedManually: boolean;
  derivationsInput: Omit<
    UseMarketBuyDerivationsInput,
    | "buyPreview"
    | "contractLength"
    | "contractShape"
    | "offeredSalary"
    | "salaryEditedManually"
    | "selectedPlayer"
    | "buyModalWishlistEntry"
    | "buyNegotiationOutcome"
  >;
  onContractLengthChange: Dispatch<SetStateAction<number | null>>;
  onContractShapeChange: Dispatch<SetStateAction<ContractShape | null>>;
  onOfferedSalaryChange: Dispatch<SetStateAction<number | null>>;
  onSalaryEditedManuallyChange: Dispatch<SetStateAction<boolean>>;
  onBuyNegotiationOutcomeChange: Dispatch<SetStateAction<MarketBuyNegotiationOutcome | null>>;
  closeBuyModal: () => void;
  negotiateBuy: () => void | Promise<void>;
  confirmBuy: () => void | Promise<void>;
  resetBuyDemandFrame: () => void;
};

/**
 * Market buy drilldown shell host (Strangler Phase 5.3). Mounts offer panel JSX
 * and scoped derivations only while `offerPanelActive` / `buyModalOpen`.
 */
export default function FoundationMarketBuyShellHost({
  buyModalRef,
  buyModalBodyRef,
  source,
  selectedTeam,
  selectedPlayer,
  buyModalWishlistEntry,
  selectedPortrait,
  selectedTeamCanManage,
  selectedTeamId,
  buyPreview,
  previewBusy,
  previewError,
  buyBusy,
  buySuccess,
  buyNegotiationOutcome,
  contractLength,
  contractShape,
  offeredSalary,
  salaryEditedManually,
  derivationsInput,
  onContractLengthChange,
  onContractShapeChange,
  onOfferedSalaryChange,
  onSalaryEditedManuallyChange,
  onBuyNegotiationOutcomeChange,
  closeBuyModal,
  negotiateBuy,
  confirmBuy,
  resetBuyDemandFrame,
}: FoundationMarketBuyShellHostProps) {
  const {
    contractPreference,
    activeContractLength,
    activeContractShape,
    contractSalaryAdjustmentPct,
    contractScoreAdjustment,
    marketAndFitDelta,
    fitSalaryDiscountActive,
    modalPlayerName,
    modalPlayerClass,
    modalPlayerRace,
    modalPlayerBracket,
    modalPlayerMarketValue,
    modalPlayerSalary,
    modalOfferValue,
    compactNegotiationFeedback,
    priorBadExperienceDemandEntry,
    priorBadExperienceScoreEntry,
    priorBadExperienceActive,
    finalBuyDisabledReason,
    formatNegotiationSignalLabel,
  } = useMarketBuyDerivations({
    ...derivationsInput,
    buyPreview,
    contractLength,
    contractShape,
    offeredSalary,
    salaryEditedManually,
    selectedPlayer,
    buyModalWishlistEntry,
    buyNegotiationOutcome,
  });

  return (
    <section className="foundation-drilldown-page transfer-offer-page" data-testid="transfer-offer-page" ref={buyModalRef}>
      <header className="foundation-drilldown-header">
        <div>
          <span className="market-v2-kicker">Vertragsangebot</span>
          <h1>{selectedPlayer?.name ?? "Spieler prüfen"}</h1>
        </div>
        <button className="secondary-button" type="button" onClick={closeBuyModal} disabled={buyBusy}>
          Zurück
        </button>
      </header>

      <div className="foundation-drilldown-body transfer-buy-modal-body" ref={buyModalBodyRef}>
              <div className="transfer-buy-player-line">
                <div className="transfer-modal-player-hero">
                  {selectedPortrait?.src ? (
                    <OptimizedMediaImage
                      src={selectedPortrait.src}
                      alt={modalPlayerName}
                      width={72}
                      height={72}
                      className="transfermarkt-portrait"
                    />
                  ) : buyModalWishlistEntry ? (
                    (() => {
                      const buyModalPortraitBase = getPlayerPortraitBrowserUrl(buyModalWishlistEntry.playerId);
                      return (
                    <OptimizedMediaImage
                      src={appendMediaImageVariant(buyModalPortraitBase, "thumb") ?? buyModalPortraitBase}
                      alt={modalPlayerName}
                      width={72}
                      height={72}
                      className="transfermarkt-portrait"
                    />
                      );
                    })()
                  ) : (
                    <div className="transfermarkt-portrait transfermarkt-portrait-placeholder" aria-label={`${modalPlayerName} placeholder`}>
                      {(selectedPortrait?.initials ?? modalPlayerName.slice(0, 2)).toUpperCase()}
                    </div>
                  )}
                  <div className="transfer-modal-player-summary">
                    <div className="transfer-modal-player-head">
                      <strong>{modalPlayerName}</strong>
                      <div className="transfer-modal-player-meta">
                        <ClassIcon classNameValue={modalPlayerClass} showLabel={false} />
                        <span className="muted">{modalPlayerClass}</span>
                        <span className="muted">{modalPlayerRace}</span>
                        <span className="pill">Bracket {modalPlayerBracket != null ? formatCompactNumber(modalPlayerBracket, 0) : "—"}</span>
                        <span className="pill">{selectedTeam ? `${selectedTeam.shortCode} · ${selectedTeam.name}` : "Kein Team gewählt"}</span>
                      </div>
                    </div>
                    <div className="transfer-modal-player-kpis">
                      <article className="transfer-modal-kpi">
                        <span>Marktwert</span>
                        <strong>{formatTransfermarktCurrency(modalPlayerMarketValue)}</strong>
                      </article>
                      <article className="transfer-modal-kpi">
                        <span>Basisgehalt</span>
                        <strong>{formatTransfermarktCurrency(modalPlayerSalary)}</strong>
                      </article>
                      <article className="transfer-modal-kpi">
                        <span>Aktuelle Forderung</span>
                        <strong>{formatTransfermarktCurrency(buyPreview?.expectedSalary ?? null)}</strong>
                      </article>
                      <article className="transfer-modal-kpi">
                        <span>Zusage</span>
                        <strong>{formatPercentLabel(buyPreview?.acceptChance)}</strong>
                      </article>
                    </div>
                  </div>
                </div>
                <span className={`transfer-status-pill${buyPreview?.canBuy ? " is-ready" : " is-blocked"}`}>
                  {source !== "sqlite" ? "nur Ansicht" : buyPreview?.canBuy ? "bereit" : "prüfen"}
                </span>
              </div>

              {previewBusy && !buyPreview ? (
                <div className="transfer-buy-preview-skeleton" data-testid="transfer-buy-preview-skeleton" aria-busy="true" aria-label="Kaufvorschau lädt">
                  <div className="transfer-buy-preview-skeleton__banner">
                    <strong>Kaufvorschau lädt</strong>
                    <span>Forderung, Vertrag und Teamwirkung werden berechnet.</span>
                  </div>
                  <div className="transfer-buy-preview-skeleton__grid">
                    <div className="transfer-buy-preview-skeleton__block" />
                    <div className="transfer-buy-preview-skeleton__block" />
                    <div className="transfer-buy-preview-skeleton__block" />
                    <div className="transfer-buy-preview-skeleton__block is-wide" />
                  </div>
                </div>
              ) : null}
              {previewBusy && buyPreview ? (
                <div className="transfer-feedback-banner is-info" data-testid="transfer-buy-preview-refresh">
                  <strong>Vorschau aktualisiert</strong>
                  <span>Vertrag und Gehalt werden neu berechnet.</span>
                </div>
              ) : null}
              {previewError ? (
                <div className="transfer-feedback-banner is-error">
                  <strong>Vorschau blockiert</strong>
                  <span>{previewError}</span>
                </div>
              ) : null}
              {buySuccess ? (
                <div className="transfer-feedback-banner is-success">
                  <strong>Kauf erfolgreich</strong>
                  <span>{buySuccess}</span>
                </div>
              ) : null}
              {source !== "sqlite" ? (
                <div className="transfer-feedback-banner is-info">
                  <strong>Read-only</strong>
                  <span>Hier kannst du alles prüfen, aber in diesem Modus keinen Kauf final schreiben.</span>
                </div>
              ) : null}
              {priorBadExperienceActive ? (
                <div className="transfer-feedback-banner is-warning">
                  <strong>Spieler ist noch angefressen</strong>
                  <span>
                    {priorBadExperienceDemandEntry
                      ? `Die letzte Verhandlung mit diesem Team wirkt noch nach. Seine Forderung liegt dadurch aktuell bei ${formatDemandPercent(priorBadExperienceDemandEntry.percent)} und die Zusage ist spürbar schlechter.`
                      : "Die letzte Verhandlung mit diesem Team wirkt noch nach. Dadurch fordert der Spieler mehr und verhandelt misstrauischer."}
                  </span>
                </div>
              ) : null}

              <ContractOfferClient
                playerName={modalPlayerName}
                roleLabel={modalPlayerClass}
                expectedSalary={buyPreview?.expectedSalary ?? null}
                offeredSalary={modalOfferValue}
                contractLength={activeContractLength}
                contractShape={activeContractShape}
                budgetAvailable={buyPreview?.cashBefore ?? null}
                acceptChance={buyPreview?.acceptChance ?? null}
                counterChance={buyPreview?.counterChance ?? null}
                rejectChance={buyPreview?.rejectChance ?? null}
                negotiationOutcome={
                  buyNegotiationOutcome
                    ? {
                        title: buyNegotiationOutcome.title,
                        message: buyNegotiationOutcome.message,
                        tone: buyNegotiationOutcome.tone,
                      }
                    : null
                }
                busy={buyBusy}
                onContractLengthChange={(value) => {
                  onBuyNegotiationOutcomeChange(null);
                  onContractLengthChange(value);
                }}
                onContractShapeChange={(value) => {
                  onBuyNegotiationOutcomeChange(null);
                  onContractShapeChange(value);
                }}
                onSalaryChange={(value) => {
                  onBuyNegotiationOutcomeChange(null);
                  onOfferedSalaryChange(value);
                  onSalaryEditedManuallyChange(value != null);
                }}
                onResetSuggestion={resetBuyDemandFrame}
                onSendOffer={() => void negotiateBuy()}
                onCancel={closeBuyModal}
              />

              <div className="transfer-modal-section transfer-callout is-info transfer-compact-feedback-callout">
                <div className="transfer-callout-title">
                  <strong>Kompakt: Was er am Vertrag mag</strong>
                  <span className="muted">schneller Check ohne Scrollen</span>
                </div>
                <div className="transfer-compact-feedback-grid">
                    <div className="transfer-compact-feedback-column">
                      <span className="muted">Passt gut</span>
                      <div className="negotiation-factor-list">
                        {compactNegotiationFeedback.likes.length ? (
                          compactNegotiationFeedback.likes.map((entry) => (
                            <span className="negotiation-factor is-positive" key={`buy-like-${entry}`}>
                              {entry}
                            </span>
                          ))
                        ) : (
                          <span className="negotiation-factor is-neutral">Noch kein klarer Pluspunkt sichtbar</span>
                        )}
                      </div>
                    </div>
                    <div className="transfer-compact-feedback-column">
                      <span className="muted">Stoert ihn</span>
                      <div className="negotiation-factor-list">
                        {compactNegotiationFeedback.concerns.length ? (
                          compactNegotiationFeedback.concerns.map((entry) => (
                            <span className="negotiation-factor is-negative" key={`buy-concern-${entry}`}>
                              {entry}
                            </span>
                          ))
                        ) : (
                          <span className="negotiation-factor is-positive">Aktuell kein klarer Vertrags-Nachteil</span>
                        )}
                        {priorBadExperienceScoreEntry ? (
                          <span className="negotiation-factor is-negative">
                            {priorBadExperienceScoreEntry.label}: {priorBadExperienceScoreEntry.reason}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
              </div>

                {contractPreference ? (
                  <div className={`contract-preference-card is-${contractPreference.matchQuality}`}>
                    <div>
                      <span className="eyebrow">Spielerwunsch</span>
                      <strong>{formatContractLengthPreference(contractPreference.lengthPreference)}</strong>
                      <p className="muted">
                        Wunschfenster {contractPreference.preferredMinLength}-{contractPreference.preferredMaxLength} Saisons · am liebsten{" "}
                        {contractPreference.idealLength} · Form {formatContractShapeLabel(contractPreference.shapePreference)}
                      </p>
                      <p className="muted">
                        {formatContractPreferenceCurrentStatus(
                          contractPreference,
                          activeContractLength,
                          activeContractShape,
                        )}
                      </p>
                    </div>
                    <div className="contract-preference-impact">
                      <span className={contractSalaryAdjustmentPct != null && contractSalaryAdjustmentPct <= 0 ? "positive-value" : "negative-value"}>
                        {formatSignedPercentDelta(contractSalaryAdjustmentPct)} Gehalt
                      </span>
                      <span className={contractScoreAdjustment != null && contractScoreAdjustment >= 0 ? "positive-value" : "negative-value"}>
                        {formatSignedPoints(contractScoreAdjustment)} Score
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="metric-grid compact">
                  <article className="metric-card">
                    <span>Basisforderung</span>
                    <strong>{formatTransfermarktCurrency(buyPreview?.baseExpectedSalary ?? null)}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Aktuelle Forderung</span>
                    <strong>{formatTransfermarktCurrency(buyPreview?.expectedSalary ?? null)}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Forderungsfaktor</span>
                    <strong>{buyPreview?.demandMultiplier != null ? `${formatCompactNumber(buyPreview.demandMultiplier * 100, 0)}%` : "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Zusage / Nachf. / Absage</span>
                    <strong className="negotiation-chance-row">
                      <span className="is-positive">{formatPercentLabel(buyPreview?.acceptChance)}</span>
                      <span className="is-warning">{formatPercentLabel(buyPreview?.counterChance)}</span>
                      <span className="is-negative">{formatPercentLabel(buyPreview?.rejectChance)}</span>
                    </strong>
                  </article>
                  <article className="metric-card">
                    <span>Buyout</span>
                    <strong>{formatTransfermarktCurrency(buyPreview?.buyoutCost ?? null)}</strong>
                  </article>
                </div>
                {buyPreview?.demandBreakdown?.length ? (
                  <div className="transfer-demand-breakdown">
                    <div className="transfer-callout-title">
                      <strong>So entsteht die Forderung</strong>
                      <span className="muted">
                        {formatTransfermarktCurrency(buyPreview.baseExpectedSalary ?? null)} → {formatTransfermarktCurrency(buyPreview.expectedSalary ?? null)}
                      </span>
                    </div>
                    <ul className="warning-list negotiation-factor-list">
                      {buyPreview.demandBreakdown.map((entry) => (
                        <li className={`negotiation-factor is-${entry.tone}`} key={entry.key}>
                          <strong>{formatDemandPercent(entry.percent)}</strong>
                          <span>{entry.label}: {entry.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

              {buyPreview ? (
                <>
                  <div className="transfer-modal-section transfer-callout is-info">
                    <div className="transfer-callout-title">
                      <strong>Jahresplan</strong>
                      <span className="muted">
                        {formatContractShapeLabel(buyPreview.contractShape ?? activeContractShape)} · {buyPreview.contractLength} Saison{buyPreview.contractLength === 1 ? "" : "en"}
                      </span>
                    </div>
                    {buyPreview.yearlySalarySchedule?.length ? (
                      <div className="contract-schedule-table" role="table" aria-label="Vertrags-Jahresplan">
                        <div className="contract-schedule-row is-head" role="row">
                          <span>Jahr</span>
                          <span>Season</span>
                          <span>Gehalt</span>
                        </div>
                        {buyPreview.yearlySalarySchedule.map((entry) => (
                          <div className="contract-schedule-row" role="row" key={`${entry.label}-${entry.yearIndex}`}>
                            <span>Jahr {entry.yearIndex}</span>
                            <span>{entry.label}</span>
                            <strong>{formatTransfermarktCurrency(entry.salary)}</strong>
                          </div>
                        ))}
                        <div className="contract-schedule-row is-total" role="row">
                          <span>Summe</span>
                          <span>Buyout {formatTransfermarktCurrency(buyPreview.buyoutCost ?? null)}</span>
                          <strong>{formatTransfermarktCurrency(buyPreview.totalSalary ?? null)}</strong>
                        </div>
                      </div>
                    ) : (
                      <p className="muted">Noch kein Jahresplan verfügbar.</p>
                    )}
                    <p className="muted" style={{ marginTop: 8 }}>
                      Forderungsweg: Basis {formatTransfermarktCurrency(buyPreview.baseExpectedSalary ?? null)} · aktuelle Forderung{" "}
                      {formatTransfermarktCurrency(buyPreview.expectedSalary ?? null)} · Gesamtverschiebung {formatTransfermarktCurrency(marketAndFitDelta)}
                      {fitSalaryDiscountActive ? " · Fit-Bonus zuletzt aktiv" : ""}
                    </p>
                  </div>

                  <div className="transfer-modal-section">
                    <div className="transfer-callout-title">
                      <strong>Team-Auswirkung</strong>
                      <span className="muted">Sofort sichtbar, final erst beim Abschluss</span>
                    </div>
                    <div className="metric-grid compact">
                      <article className="metric-card">
                        <span>Kaufpreis / Ablöse</span>
                        <strong>{formatTransfermarktCurrency(buyPreview.purchasePrice)}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Cash vorher / nachher</span>
                        <strong>{formatTransfermarktCurrency(buyPreview.cashBefore)} / {formatTransfermarktCurrency(buyPreview.cashAfter)}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Kader vorher / nachher</span>
                        <strong>{buyPreview.rosterBefore ?? "—"} / {buyPreview.rosterAfter ?? "—"}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Gehalt vorher / nachher</span>
                        <strong>{formatTransfermarktCurrency(buyPreview.salaryBefore)} / {formatTransfermarktCurrency(buyPreview.salaryAfter)}</strong>
                      </article>
                      <article className="metric-card">
                        <span>MW vorher / nachher</span>
                        <strong>{formatTransfermarktCurrency(buyPreview.marketValueBefore)} / {formatTransfermarktCurrency(buyPreview.marketValueAfter)}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Rolle</span>
                        <strong>{buyPreview.promisedRole ?? "offen"}</strong>
                      </article>
                    </div>
                  </div>

                  <div className="transfer-buy-meta-grid">
                    <div className="transfer-callout is-blocked">
                      <div className="transfer-callout-title">
                        <strong>Blocker</strong>
                        <span className="muted">{buyPreview.blockingReasons.length}</span>
                      </div>
                      {buyPreview.blockingReasons.length > 0 ? (
                        <ul className="warning-list negotiation-factor-list">
                          {buyPreview.blockingReasons.map((reason) => (
                            <li className="negotiation-factor is-negative" key={reason}>{formatNegotiationSignalLabel(reason)}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Keine blockierenden Gruende.</p>
                      )}
                    </div>
                    <div className="transfer-callout is-warning">
                      <div className="transfer-callout-title">
                        <strong>Hinweise</strong>
                        <span className="muted">{buyPreview.warnings.length}</span>
                      </div>
                      {buyPreview.warnings.length > 0 ? (
                        <ul className="warning-list negotiation-factor-list">
                          {buyPreview.warnings.map((warning) => (
                            <li className="negotiation-factor is-negative" key={warning}>{formatNegotiationSignalLabel(warning)}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Keine Warnungen.</p>
                      )}
                    </div>
                    <div className="transfer-callout is-info">
                      <div className="transfer-callout-title">
                        <strong>Warum der Deal so ausfällt</strong>
                        <span className="muted">{buyPreview.negotiationScoreBreakdown?.length ?? 0} Faktoren</span>
                      </div>
                      {buyPreview.negotiationScoreBreakdown?.length ? (
                        <ul className="warning-list negotiation-factor-list">
                          {buyPreview.negotiationScoreBreakdown.map((entry) => (
                            <li className={`negotiation-factor is-${entry.tone}`} key={entry.key}>
                              <strong>{entry.points > 0 ? `+${entry.points}` : entry.points}</strong>
                              <span>{entry.label}: {entry.reason}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Noch keine Score-Faktoren verfügbar.</p>
                      )}
                      {buyPreview.negotiationReasons?.length ? (
                        <>
                          <p className="muted" style={{ marginTop: 8 }}>Treiber</p>
                          <ul className="warning-list negotiation-factor-list">
                            {buyPreview.negotiationReasons.map((reason) => (
                              <li className="negotiation-factor is-positive" key={reason}>{formatNegotiationSignalLabel(reason)}</li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                      {buyPreview.negotiationWarnings?.length ? (
                        <>
                          <p className="muted" style={{ marginTop: 8 }}>Risiken</p>
                          <ul className="warning-list negotiation-factor-list">
                            {buyPreview.negotiationWarnings.map((warning) => (
                              <li className="negotiation-factor is-negative" key={warning}>{formatNegotiationSignalLabel(warning)}</li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <p className="muted transfer-empty-hint">
                  Kaufvorschau wird geladen oder ist für diesen Kontext noch nicht verfügbar.
                </p>
              )}
            </div>

            <div className="foundation-modal-actions">
              <button className="secondary-button" type="button" onClick={closeBuyModal} disabled={buyBusy}>
                Abbrechen
              </button>
              <button
                className={buyNegotiationOutcome?.status === "accepted" ? "primary-button" : "secondary-button"}
                type="button"
                disabled={source !== "sqlite" || !selectedTeamCanManage || previewBusy || buyBusy || !selectedPlayer || !selectedTeamId || !buyPreview?.canBuy || buyNegotiationOutcome?.status === "rejected"}
                onClick={() => void negotiateBuy()}
                title={
                  source !== "sqlite"
                    ? "Im Referenzmodus bleibt die Verhandlung gesperrt."
                    : !buyPreview?.canBuy
                      ? buyPreview?.blockingReasons?.map(formatNegotiationSignalLabel).join(" · ") || "Der Deal ist noch nicht bereit."
                      : buyNegotiationOutcome?.status === "rejected"
                        ? "Nach einer Absage erst Angebot oder Vertrag anpassen."
                        : "Verhandlung starten und Reaktion der Gegenseite prüfen."
                }
              >
                {buyBusy ? "verhandelt..." : buyNegotiationOutcome?.status === "accepted" ? "Annahme liegt vor" : "Verhandeln"}
              </button>
              <button
                className="primary-button"
                type="button"
                data-testid="transfer-buy-confirm-button"
                disabled={source !== "sqlite" || !selectedTeamCanManage || previewBusy || buyBusy || !selectedPlayer || !selectedTeamId || !buyPreview?.canBuy || buyNegotiationOutcome?.status !== "accepted"}
                onClick={() => void confirmBuy()}
                title={finalBuyDisabledReason ?? "Bestätigt den Kauf jetzt final in deinem lokalen Spielstand."}
              >
                {buyBusy ? "kauft..." : "Kauf final abschließen"}
              </button>
            </div>
      {finalBuyDisabledReason ? <p className="foundation-screen-action-reason">Warum nicht: {finalBuyDisabledReason}</p> : null}
    </section>
  );
}
