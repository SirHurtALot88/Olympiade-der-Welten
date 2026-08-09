"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";

import ClassIcon from "@/app/foundation/ClassIcon";
import { FoundationDecisionSurface } from "@/app/foundation/decision-surface/FoundationDecisionSurface";
import ContractOfferClient from "@/app/foundation/contract-offer/ContractOfferClient";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import {
  NlMarketBeforeAfterRow,
  NlMarketChanceBar,
} from "@/app/foundation/transfermarkt-v2/TransfermarktV2NewLook";
import { NlCard, NlCountUpValue, StatChip, StatChipRow } from "@/components/foundation/new-look";
import { appendMediaImageVariant, getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import type { ContractShape, Team, TransferWishlistEntry } from "@/lib/data/olyDataTypes";
import {
  formatContractShapeLabel,
  useMarketBuyDerivations,
  type MarketBuyNegotiationOutcome,
  type UseMarketBuyDerivationsInput,
} from "@/lib/foundation/tabs/use-market-buy-derivations";
import type { TransfermarktBuyPreview } from "@/lib/market/transfermarkt-buy-service";
import { buildTransfermarktDealReceipt } from "@/lib/market/transfermarkt-deal-receipt";
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
  /** Bindend uebernehmen (verhandlung-rework.md Abschnitt 3.4) — die einzige Stelle, an der ein
   *  Gegenangebot direkt zur Zusage wird, statt erneut durch die Verdikt-Baender zu laufen. */
  acceptCounterOffer: () => void | Promise<void>;
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
  acceptCounterOffer,
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
    negotiationTooltip,
    finalBuyDisabledReason,
    formatNegotiationSignalLabel,
    visibleBuyWarnings,
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

  /**
   * M1/M2 — dieselbe Kassenzettel-Quelle wie der Deal-Desk (Begründung im Modul):
   * die Team-Auswirkung zeigt die Hypothese „wenn der Kauf durchgeht" statt der
   * bei blockiertem Deal auf ±0 geklemmten Server-`*After`-Felder.
   */
  const dealReceipt = buildTransfermarktDealReceipt(buyPreview);

  return (
    <FoundationDecisionSurface
      kicker={`Transfermarkt · Vertragsangebot${selectedPlayer?.name ? ` · ${selectedPlayer.name}` : ""}`}
      ariaLabel="Vertragsangebot"
      testId="transfer-offer-page"
      className="transfer-offer-page"
      containerRef={buyModalRef}
      status={
        source !== "sqlite"
          ? { label: "nur Ansicht", tone: "neutral" }
          : buyNegotiationOutcome?.status === "accepted"
            ? { label: "Annahme liegt vor", tone: "ready" }
            : buyNegotiationOutcome?.status === "rejected"
              ? { label: "abgelehnt", tone: "blocked" }
              : buyPreview?.canBuy
                ? { label: "bereit", tone: "ready" }
                : { label: "prüfen", tone: "warning" }
      }
      onClose={closeBuyModal}
      closeDisabled={buyBusy}
      /*
        Schritt 1 des Kaufs. Er ist KEIN zweiter Hauptknopf, sondern der vorgelagerte Schritt:
        solange keine Annahme vorliegt, ist der Abschluss gesperrt. Hervorgehoben wird deshalb
        genau der Knopf, der gerade dran ist.
      */
      secondary={{
        label:
          buyNegotiationOutcome?.status === "accepted"
            ? "Annahme liegt vor"
            : "Schritt 1: Verhandeln — Angebot senden",
        busyLabel: "verhandelt…",
        busy: buyBusy,
        emphasized: buyNegotiationOutcome?.status !== "accepted",
        disabled:
          source !== "sqlite" ||
          !selectedTeamCanManage ||
          previewBusy ||
          !selectedPlayer ||
          !selectedTeamId ||
          !buyPreview?.canBuy ||
          buyNegotiationOutcome?.status === "rejected",
        title:
          source !== "sqlite"
            ? "Im Referenzmodus bleibt die Verhandlung gesperrt."
            : !buyPreview?.canBuy
              ? buyPreview?.blockingReasons?.map(formatNegotiationSignalLabel).join(" · ") ||
                "Der Deal ist noch nicht bereit."
              : buyNegotiationOutcome?.status === "rejected"
                ? "Nach einer Absage erst Angebot oder Vertrag anpassen."
                : "Verhandlung starten und Reaktion der Gegenseite prüfen.",
        onAct: () => void negotiateBuy(),
      }}
      primary={{
        label: "Schritt 2: Kauf final abschließen",
        confirmLabel: "Schritt 2: Kauf final abschließen",
        busyLabel: "kauft…",
        busy: buyBusy,
        buttonTestId: "transfer-buy-confirm-button",
        disabledReasonTestId: "transfer-buy-disabled-reason",
        disabledReason: finalBuyDisabledReason ?? null,
        disabled:
          source !== "sqlite" ||
          !selectedTeamCanManage ||
          previewBusy ||
          !selectedPlayer ||
          !selectedTeamId ||
          !buyPreview?.canBuy ||
          buyNegotiationOutcome?.status !== "accepted",
        onConfirm: () => void confirmBuy(),
      }}
    >
      <div className="transfer-buy-modal-body" ref={buyModalBodyRef}>
              {/* Velo-Hero: Portrait + Meta + KPIs als StatChips (F1 — ersetzt die
                  alte transfer-modal-kpi/pill/muted-Sprache durch das Kit-Vokabular). */}
              <NlCard
                className="market-v2-buy-hero-card"
                eyebrow="Kandidat"
                title={modalPlayerName}
                actions={
                  <span className={`transfer-status-pill${buyPreview?.canBuy ? " is-ready" : " is-blocked"}`}>
                    {source !== "sqlite" ? "nur Ansicht" : buyPreview?.canBuy ? "bereit" : "prüfen"}
                  </span>
                }
              >
                <div className="market-v2-buy-hero">
                  {selectedPortrait?.src ? (
                    <OptimizedMediaImage
                      src={selectedPortrait.src}
                      alt={modalPlayerName}
                      width={72}
                      height={72}
                      className="transfermarkt-portrait market-v2-buy-hero-portrait"
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
                          className="transfermarkt-portrait market-v2-buy-hero-portrait"
                        />
                      );
                    })()
                  ) : (
                    <div
                      className="transfermarkt-portrait transfermarkt-portrait-placeholder market-v2-buy-hero-portrait"
                      aria-label={`${modalPlayerName} placeholder`}
                    >
                      {(selectedPortrait?.initials ?? modalPlayerName.slice(0, 2)).toUpperCase()}
                    </div>
                  )}
                  <div className="market-v2-buy-hero-copy">
                    <div className="market-v2-buy-hero-meta">
                      <ClassIcon classNameValue={modalPlayerClass} showLabel={false} />
                      <span>{modalPlayerClass}</span>
                      <span>{modalPlayerRace}</span>
                      <span className="market-v2-buy-hero-tag">
                        Bracket {modalPlayerBracket != null ? formatCompactNumber(modalPlayerBracket, 0) : "—"}
                      </span>
                      <span className="market-v2-buy-hero-tag">
                        {selectedTeam ? `${selectedTeam.shortCode} · ${selectedTeam.name}` : "Kein Team gewählt"}
                      </span>
                    </div>
                    <StatChipRow className="market-v2-buy-hero-stats" aria-label="Kandidaten-Kennzahlen">
                      <StatChip label="Marktwert" value={formatTransfermarktCurrency(modalPlayerMarketValue)} tone="accent" />
                      <StatChip label="Basisgehalt" value={formatTransfermarktCurrency(modalPlayerSalary)} tone="neutral" />
                      <StatChip
                        label="Forderung"
                        value={formatTransfermarktCurrency(buyPreview?.expectedSalary ?? null)}
                        tone="warn"
                      />
                      <StatChip label="Zusage" value={formatPercentLabel(buyPreview?.acceptChance)} tone="good" />
                    </StatChipRow>
                  </div>
                </div>
              </NlCard>

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
                // F2 — "VERPFLICHTET"-Moment: statt statischer Erfolgsmeldung
                // zählen Ablöse + Gehalt aus der Buy-Preview hoch (NlCountUpValue,
                // respektiert prefers-reduced-motion) und die Karte fährt über das
                // Kit-Primitiv `.nl-reveal` dezent ein.
                <div
                  className="transfer-feedback-banner is-success market-v2-buy-signed nl-reveal"
                  data-testid="market-v2-buy-signed"
                  role="status"
                  aria-live="polite"
                >
                  <strong>Kauf erfolgreich</strong>
                  <span>{buySuccess}</span>
                  {buyPreview ? (
                    <div className="market-v2-buy-signed-figures" aria-label="Ablöse und Gehalt">
                      <span className="market-v2-buy-signed-figure">
                        <small>Ablöse</small>
                        <NlCountUpValue
                          value={buyPreview.purchasePrice}
                          format={(value) => formatTransfermarktCurrency(value)}
                          className="market-v2-buy-signed-value nl-tnum"
                        />
                      </span>
                      <span className="market-v2-buy-signed-figure">
                        <small>Gehalt p.a.</small>
                        <NlCountUpValue
                          value={buyPreview.expectedSalary ?? null}
                          format={(value) => formatTransfermarktCurrency(value)}
                          className="market-v2-buy-signed-value nl-tnum"
                        />
                      </span>
                    </div>
                  ) : null}
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

              {/*
                Trotz (verhandlung-rework.md Abschnitt 9.1) — zwei getrennte Zustände, und die
                Trennung ist der Punkt: der obere Banner sagt, was SCHON gilt, der untere, was
                ein Klick auslösen WÜRDE. Ohne den zweiten wäre der Aufschlag eine Überraschung
                nach dem Klick; ohne den ersten wäre die erhöhte Forderung unerklärt.
              */}
              {(buyPreview?.defianceSurchargePct ?? 0) > 0 ? (
                <div className="transfer-feedback-banner is-warning" data-testid="transfer-buy-defiance-active">
                  <strong>Er trägt euch euer Lowball-Angebot nach</strong>
                  <span>
                    Seine Forderung steht für den Rest dieser Verhandlung bei{" "}
                    {formatTransfermarktCurrency(buyPreview?.expectedSalary ?? null)} statt{" "}
                    {formatTransfermarktCurrency(buyPreview?.baseDemandSalary ?? null)}
                    {" "}(+{Math.round((buyPreview?.defianceSurchargePct ?? 0) * 1000) / 10} %). Eine neue Season setzt das zurück.
                  </span>
                </div>
              ) : null}
              {(buyPreview?.pendingDefianceSurchargePct ?? 0) > (buyPreview?.defianceSurchargePct ?? 0) ? (
                <div className="transfer-feedback-banner is-warning" data-testid="transfer-buy-defiance-pending">
                  <strong>Dieses Angebot nimmt er persönlich</strong>
                  <span>
                    Wenn du so verhandelst, steigt seine Forderung auf{" "}
                    {formatTransfermarktCurrency(
                      buyPreview?.baseDemandSalary != null
                        ? Number((buyPreview.baseDemandSalary * (1 + (buyPreview.pendingDefianceSurchargePct ?? 0))).toFixed(2))
                        : null,
                    )}{" "}
                    (+{Math.round((buyPreview?.pendingDefianceSurchargePct ?? 0) * 1000) / 10} %) — und bleibt dort. Tippen ist frei, verhandeln nicht.
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
                /* M2 (Audit-Befund M8): kein zweites „Abbrechen" und kein zweiter
                   Sende-Primärknopf im Formular — Verhandeln (Schritt 1) und
                   Abbrechen stehen genau einmal in der Fußleiste der Hülle. */
                onSendOffer={null}
                onCancel={null}
              />

              {/* M2 (Chris): Gehaltsverteilung bei Mehrjahresverträgen direkt am Angebot —
                  der Jahresplan (buyPreview.yearlySalarySchedule, EINE Quelle, serverseitig
                  gerechnet) steht jetzt neben Laufzeit/Vertragsform statt unter dem Falz. */}
              {buyPreview ? (
                <NlCard
                  className="market-v2-buy-schedule-card"
                  eyebrow={`${formatContractShapeLabel(buyPreview.contractShape ?? activeContractShape)} · ${buyPreview.contractLength} Saison${buyPreview.contractLength === 1 ? "" : "en"}`}
                  title="Gehaltsverteilung je Saison"
                >
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
                    <p className="nl-market-muted">Noch kein Jahresplan verfügbar.</p>
                  )}
                  <p className="market-v2-buy-schedule-note">
                    Basis {formatTransfermarktCurrency(buyPreview.baseExpectedSalary ?? null)} · Forderung{" "}
                    {formatTransfermarktCurrency(buyPreview.expectedSalary ?? null)} · Δ {formatTransfermarktCurrency(marketAndFitDelta)}
                    {fitSalaryDiscountActive ? " · Fit-Bonus" : ""}
                  </p>
                </NlCard>
              ) : null}

              {/* F1 — Kompakt-Feedback als NlCard; die tonfarbigen negotiation-factor-Chips bleiben (bereits chip-artig). */}
              <NlCard
                className="market-v2-buy-feedback-card transfer-compact-feedback-callout"
                eyebrow="schneller Check ohne Scrollen"
                title="Kompakt: Was er am Vertrag mag"
              >
                <div className="transfer-compact-feedback-grid">
                    <div className="transfer-compact-feedback-column">
                      <span className="nl-market-eyebrow">Passt gut</span>
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
                      <span className="nl-market-eyebrow">Stört ihn</span>
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
              </NlCard>

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

                {/* F1 — Forderungs-KPIs als StatChips, Reaktion als segmentierte
                    Wahrscheinlichkeits-Bar (dieselbe NlMarketChanceBar wie im Deal-Desk). */}
                <NlCard className="market-v2-buy-demand-card" eyebrow="Verhandlung" title="Forderung & Reaktion">
                  <StatChipRow className="market-v2-buy-demand-stats" aria-label="Forderungs-Kennzahlen">
                    <StatChip
                      label="Basisforderung"
                      value={formatTransfermarktCurrency(buyPreview?.baseExpectedSalary ?? null)}
                      tone="neutral"
                    />
                    <StatChip
                      label="Aktuelle Forderung"
                      value={formatTransfermarktCurrency(buyPreview?.expectedSalary ?? null)}
                      tone="warn"
                    />
                    <StatChip
                      label="Forderungsfaktor"
                      value={buyPreview?.demandMultiplier != null ? `${formatCompactNumber(buyPreview.demandMultiplier * 100, 0)}%` : "—"}
                      tone="accent"
                    />
                    <StatChip
                      label="Buyout"
                      value={formatTransfermarktCurrency(buyPreview?.buyoutCost ?? null)}
                      tone="neutral"
                    />
                  </StatChipRow>
                  <div className="market-v2-buy-chance" aria-label="Zusage / Nachforderung / Absage">
                    <span className="nl-market-eyebrow">Zusage / Nachf. / Absage</span>
                    <NlMarketChanceBar
                      acceptChance={buyPreview?.acceptChance ?? null}
                      counterChance={buyPreview?.counterChance ?? null}
                      rejectChance={buyPreview?.rejectChance ?? null}
                      ariaLabel="Zusage / Nachforderung / Absage"
                    />
                  </div>
                  {buyPreview?.demandBreakdown?.length ? (
                    <div className="transfer-demand-breakdown">
                      <div className="market-v2-buy-subhead">
                        <strong>So entsteht die Forderung</strong>
                        <span className="nl-market-eyebrow">
                          {formatTransfermarktCurrency(buyPreview.baseExpectedSalary ?? null)} → {formatTransfermarktCurrency(buyPreview.expectedSalary ?? null)}
                        </span>
                      </div>
                      <ul className="negotiation-factor-list">
                        {buyPreview.demandBreakdown.map((entry) => (
                          <li className={`negotiation-factor is-${entry.tone}`} key={entry.key}>
                            <strong>{formatDemandPercent(entry.percent)}</strong>
                            <span>{entry.label}: {entry.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </NlCard>

              {buyPreview ? (
                <>
                  {/* F1/M1 — Team-Auswirkung: Vorher→Nachher exakt wie der Deal-Desk —
                      inklusive derselben Quelle (buildTransfermarktDealReceipt): bei
                      blockiertem Deal klemmen die Server-`*After`-Felder auf „nichts
                      passiert" — die Zeilen zeigen die Kassenzettel-Hypothese, die
                      Lücke steht ehrlich daneben. */}
                  <NlCard
                    className="market-v2-buy-impact-card"
                    eyebrow="Sofort sichtbar, final erst beim Abschluss"
                    title="Team-Auswirkung"
                  >
                    <StatChipRow className="market-v2-buy-impact-topline" aria-label="Ablöse">
                      <StatChip
                        label="Kaufpreis / Ablöse"
                        value={formatTransfermarktCurrency(buyPreview.purchasePrice)}
                        tone="accent"
                      />
                    </StatChipRow>
                    <div className="nl-market-deal-rows" aria-label="Vorher-Nachher, wenn der Kauf durchgeht">
                      <NlMarketBeforeAfterRow
                        label="Cash"
                        before={dealReceipt?.cashBefore ?? buyPreview.cashBefore}
                        after={dealReceipt?.cashAfterIfBought ?? null}
                        format={(value) => formatTransfermarktCurrency(value)}
                      />
                      <NlMarketBeforeAfterRow
                        label="Gehalt p.a."
                        before={dealReceipt?.salaryBefore ?? buyPreview.salaryBefore}
                        after={dealReceipt?.salaryAfterIfBought ?? null}
                        format={(value) => formatTransfermarktCurrency(value)}
                        invert
                      />
                      <NlMarketBeforeAfterRow
                        label="Kader"
                        before={dealReceipt?.rosterBefore ?? buyPreview.rosterBefore}
                        after={dealReceipt?.rosterAfterIfBought ?? null}
                        format={(value) => (value != null ? String(Math.round(value)) : "—")}
                      />
                      <NlMarketBeforeAfterRow
                        label="Team-MW"
                        before={dealReceipt?.marketValueBefore ?? buyPreview.marketValueBefore}
                        after={dealReceipt?.marketValueAfterIfBought ?? null}
                        format={(value) => formatTransfermarktCurrency(value)}
                      />
                    </div>
                    {dealReceipt?.missingCash != null && dealReceipt.missingCash > 0 ? (
                      <div className="nl-market-deal-shortfall" role="status">
                        <strong className="nl-tnum">
                          Noch nicht ausführbar — es fehlen {formatTransfermarktCurrency(dealReceipt.missingCash)}.
                        </strong>
                        <small className="nl-tnum">
                          Ablöse {formatTransfermarktCurrency(dealReceipt.purchasePrice)} · Cash heute{" "}
                          {formatTransfermarktCurrency(dealReceipt.cashBefore)}
                        </small>
                      </div>
                    ) : null}
                  </NlCard>

                  <div className="transfer-buy-meta-grid market-v2-buy-meta-grid">
                    <NlCard className="market-v2-buy-meta-card" eyebrow={String(buyPreview.blockingReasons.length)} title="Blocker">
                      {buyPreview.blockingReasons.length > 0 ? (
                        <ul className="negotiation-factor-list">
                          {buyPreview.blockingReasons.map((reason) => (
                            <li className="negotiation-factor is-negative" key={reason}>{formatNegotiationSignalLabel(reason)}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="nl-market-muted">Keine blockierenden Gruende.</p>
                      )}
                    </NlCard>
                    <NlCard className="market-v2-buy-meta-card" eyebrow={String(visibleBuyWarnings.length)} title="Hinweise">
                      {visibleBuyWarnings.length > 0 ? (
                        <ul className="negotiation-factor-list">
                          {visibleBuyWarnings.map((warning) => (
                            <li className="negotiation-factor is-negative" key={warning}>{formatNegotiationSignalLabel(warning)}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="nl-market-muted">Keine Warnungen.</p>
                      )}
                    </NlCard>
                    <NlCard
                      className="market-v2-buy-meta-card market-v2-buy-negotiation-tooltip"
                      eyebrow="Warum der Deal so ausfällt"
                      title={negotiationTooltip?.headline ?? "Warum er so reagiert"}
                      data-testid="transfer-negotiation-tooltip"
                    >
                      {/* Antwortet auf die Ausgangsfrage ("von was das abhängt — traits vom
                          spieler, oder ob er aus gründen lieber/weniger gern wechseln will"):
                          vier Bündel statt einer 15er-Rohliste aus scoreBreakdown
                          (verhandlung-rework.md Abschnitt 5). Jedes Bündel beantwortet EINE
                          menschliche Frage; leere Bündel fallen weg. */}
                      {negotiationTooltip?.bundles.length ? (
                        <div className="negotiation-tooltip-bundles">
                          {negotiationTooltip.bundles.map((bundle) => (
                            <div className={`negotiation-tooltip-bundle is-${bundle.id}`} key={bundle.id}>
                              <p className="negotiation-tooltip-bundle-title">{bundle.title}</p>
                              {bundle.items.length ? (
                                <ul className="negotiation-factor-list">
                                  {bundle.items.map((item, index) => (
                                    <li className="negotiation-factor is-neutral" key={`${bundle.id}-${index}`}>
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="nl-market-muted">Noch keine Verhandlungsdaten verfügbar.</p>
                      )}
                      {buyPreview.negotiationWarnings?.length ? (
                        <>
                          <p className="market-v2-buy-subhead-inline">Risiken</p>
                          <ul className="negotiation-factor-list">
                            {buyPreview.negotiationWarnings.map((warning) => (
                              <li className="negotiation-factor is-negative" key={warning}>{formatNegotiationSignalLabel(warning)}</li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </NlCard>
                  </div>
                </>
              ) : previewBusy ? (
                <p className="muted transfer-empty-hint">Kaufvorschau wird berechnet …</p>
              ) : !selectedPlayer ? (
                <p className="muted transfer-empty-hint">Wähle links einen Spieler, um die Kaufvorschau zu sehen.</p>
              ) : source !== "sqlite" ? (
                <p className="muted transfer-empty-hint">Nur-Ansicht-Modus — in diesem Kontext ist kein Kauf möglich.</p>
              ) : (
                <p className="muted transfer-empty-hint">Für diese Auswahl ist derzeit keine Kaufvorschau verfügbar.</p>
              )}
            </div>

            {/* Friction fix (Generalprobe #3): the two-step flow (erst
                verhandeln, dann abschließen) was non-obvious. Make the sequence
                explicit and, on a rejection, surface the reason right next to
                the confirm button instead of only disabling it silently. */}
            <div className="transfer-buy-step-hint" data-testid="transfer-buy-step-hint">
              <span className={`transfer-buy-step${buyNegotiationOutcome?.status === "accepted" ? " is-done" : " is-active"}`}>
                <strong>Schritt 1</strong>
                <span>Verhandeln — Reaktion der Gegenseite einholen</span>
              </span>
              <b aria-hidden="true">→</b>
              <span className={`transfer-buy-step${buyNegotiationOutcome?.status === "accepted" ? " is-active" : ""}`}>
                <strong>Schritt 2</strong>
                <span>Kauf final abschließen (erst nach Annahme möglich)</span>
              </span>
            </div>

            {buyNegotiationOutcome?.status === "countered" ? (
              // Bindend uebernehmen statt Ratsche (Abschnitt 3.4/4.1): das Gegenangebot steht
              // hier nur zur Ansicht — "Einschlagen" ist der einzige Weg, es zu uebernehmen.
              // Wer stattdessen das eigene Angebot aendert und erneut auf "Verhandeln" klickt,
              // bekommt ein neues, deterministisch aus (O, D, W, Traits) berechnetes Ergebnis.
              <div className="transfer-feedback-banner is-warning" data-testid="transfer-buy-counter-offer">
                <strong>{buyNegotiationOutcome.title}</strong>
                <span>{buyNegotiationOutcome.message}</span>
                {/* M2 — die Wirkung von „Abbrechen" steht VOR dem Klick da, nicht erst danach. */}
                <span className="muted">
                  Achtung: Wer den Dialog jetzt schließt oder abbricht, bricht die Verhandlung ab — das
                  gibt einen Malus für die nächste Runde.
                </span>
                <button
                  type="button"
                  className="secondary-button"
                  data-testid="transfer-buy-accept-counter-button"
                  disabled={source !== "sqlite" || !selectedTeamCanManage || buyBusy}
                  onClick={() => void acceptCounterOffer()}
                >
                  Gegenangebot einschlagen
                </button>
              </div>
            ) : null}

            {buyNegotiationOutcome?.status === "rejected" ? (
              <div className="transfer-feedback-banner is-error" data-testid="transfer-buy-rejection-reason">
                <strong>{buyNegotiationOutcome.title}</strong>
                <span>{buyNegotiationOutcome.message}</span>
                {buyPreview?.blockingReasons?.length ? (
                  <span className="muted">
                    Grund: {buyPreview.blockingReasons.map(formatNegotiationSignalLabel).join(" · ")}
                  </span>
                ) : null}
              </div>
            ) : null}
    </FoundationDecisionSurface>
  );
}
