"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";

import ClassColorChip from "@/app/foundation/ClassColorChip";
import {
  FoundationDecisionSurface,
  type DecisionSurfaceStatusTone,
} from "@/app/foundation/decision-surface/FoundationDecisionSurface";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { vertragLaeuftAus } from "@/lib/contracts/vertragslaufzeit";
import { getPlayerPortraitInitials } from "@/lib/data/mediaAssets";
import {
  classifySellPricingNoteWeight,
  classifySellWarningWeight,
  describeSellPreviewIssue,
  formatGmArchetypeLabel,
  formatGmPressureLabel,
  formatMatchdayShortLabel,
  formatReadinessAfterSellLabel,
  formatRosterRoleTagLabel,
  translateSellBlockingReason,
  translateSellWarning,
  type SellNoticeWeight,
} from "@/app/foundation/transfermarkt-v2/transfer-sell-view-labels";
import TransferSellBoardBalance from "@/app/foundation/transfermarkt-v2/TransferSellBoardBalance";
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
import { SAISON_MW_ERKLAERUNG } from "@/lib/market/transfermarkt-sale-factor";
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

/** Deutsche Kurz-Beschriftung je Hinweis-Gewichtsklasse (Zone E). */
const NOTICE_BADGE_LABEL: Record<SellNoticeWeight, string> = {
  blocker: "Blocker",
  warn: "Achtung",
  info: "Hinweis",
  good: "Stärkt den Deal",
};

/** Eine Zeile in den 3-Sekunden-Kacheln (Zone C): Label links, Wert rechts, optional getönt. */
function SellTileRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "good" | "risk" | "warn";
}) {
  return (
    <div className="transfer-sell-tile-row">
      <span className="k">{label}</span>
      <span className={`v nl-tnum${tone ? ` is-${tone}` : ""}`}>{value}</span>
    </div>
  );
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
 * Verkaufs-Popup (Strangler Phase 5.3+) — Neuer Look, Redesign nach
 * docs/design/verkauf-popup.md (abgesegnetes Mockup).
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
 *
 * Architektur-Kontrakt (siehe tests/foundation-page-surfaces-contract.test.ts,
 * tests/foundation-performance-architecture.test.ts): diese Seite bleibt eine
 * Drilldown-Seite mit der Klasse "foundation-drilldown-page" und
 * data-testid="transfer-sell-page" — beides liefert seit der Zusammenführung
 * mit Kauf und Gebäude `FoundationDecisionSurface` über die Props unten
 * (testId="transfer-sell-page"), nicht mehr dieser Host selbst. Kopf,
 * Zustands-Pill, Fußleiste, Zweiklick-Bestätigung ("Bestätigen"-Schritt) und
 * die "Warum nicht"-Zeile kommen ebenfalls von dort — hier stehen nur noch
 * die Zonen B-G (Hero bis "Mehr zum Spieler"), die inhaltlich dem Verkauf
 * gehören, nicht der Hülle.
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

  // Läuft die eigentliche Buchung gerade? Nur DANN — nicht schon während die
  // Vorschau lädt — sperrt die Hülle den X-Knopf: sonst könnte ein Klick das
  // Popup mitten in der endgültigen Verkaufs-Anfrage schließen (der Zweiklick,
  // das Esc-Verhalten und die Fußleiste selbst kommen jetzt komplett aus
  // FoundationDecisionSurface, siehe Kopfkommentar).
  const bookingInFlight = marketSellBusy && preview != null;

  // Friction fix (Generalprobe #4, unverändert aus dem Bestand): der
  // Bestätigen-Button war ohne sichtbare Begründung deaktiviert. Der konkrete
  // Grund steht neben dem Button, nicht nur im Tooltip. Kader-Minimum wird
  // zusätzlich immer markiert.
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
  const saleProfit = context?.saleProfit ?? preview?.profit ?? null; // GuV vs. KAUFPREIS (Kachel C1)

  // GEMELDET: „hier sehe ich, dass trotz positivem Verkaufswert im Save nur ein Nettoerlös von
  // 21,6 raus kommen soll und somit ein verlust?"
  //
  // Verglichen wurde der NETTO-Erlös mit dem Marktwert — also nach Abzug des Rest-Buyouts. Der
  // Buyout ist aber eine Kosten des VERTRAGS, kein Abschlag auf den Wert des Spielers. Ergebnis
  // im gemeldeten Fall: Faktor 1,21× auf 24,9 Mio, Bruttopreis 30,1 Mio — und direkt darunter
  // „−14,5 % unter Marktwert". Zwei Zeilen, die sich widersprachen.
  //
  // Die frühere Begründung („sonst würde ein offener Buyout die Farbe verfälschen") war genau
  // verkehrt herum: den Buyout HINEINZURECHNEN verfälscht die Aussage, weil er mit dem Marktwert
  // nichts zu tun hat. Wie sich der Buyout aufs Cash auswirkt, steht ohnehin eine Zeile höher
  // („brutto X − Buyout Y") und in der GuV-Kachel.
  //
  // Verglichen wird deshalb der BRUTTOPREIS — dieselbe Größe, aus der auch der Faktor stammt.
  //
  // WOGEGEN verglichen wird, hat Chris gemeldet: „IN der Erklärung steht auch Gekauft für 18,8
  // jetzt MW 19,1". Beide Zahlen sind echt und beide hießen hier „Marktwert" — nur meinten sie
  // Verschiedenes. `preview.marketValueReference` ist der zum SAISONENDE EINGEFRORENE Marktwert
  // (`frozenValuationSnapshot.frozenMw`, gebaut in `matchday-progress-service` nach dem letzten
  // Spieltag); die Kachel „MW aktuell" weiter unten zeigt den LAUFENDEN Wert, der durch Training
  // noch steigt. Am Live-Abbild gemessen gingen im eingefrorenen Save 335 von 336 Kaderspielern
  // auseinander (im Mittel 0,39, bis 1,70) — in den vier Saves vor dem Freeze kein einziger,
  // weil dort beide auf dieselbe Live-Rechnung fallen. Zwei Zahlen unter einem Namen.
  //
  // Der eingefrorene Wert IST der Verkaufswert der Saison (Chris' Entscheidung), an der Rechnung
  // ändert sich deshalb nichts. Nur der Name sagt jetzt, welcher der beiden gemeint ist.
  const grossSalePrice = preview?.salePrice ?? null;
  const saleVsMarketValue =
    grossSalePrice != null && preview?.marketValueReference != null
      ? grossSalePrice - preview.marketValueReference
      : null;
  const saleVsMarketValuePct =
    saleVsMarketValue != null && preview?.marketValueReference
      ? (saleVsMarketValue / preview.marketValueReference) * 100
      : null;
  const mwDiffTone: "good" | "risk" | null = saleVsMarketValue == null ? null : saleVsMarketValue >= 0 ? "good" : "risk";
  const mwDiffText =
    saleVsMarketValue == null
      ? null
      : `${formatSignedTransfermarktCurrency(saleVsMarketValue)}${
          saleVsMarketValuePct != null
            ? ` (${saleVsMarketValuePct >= 0 ? "+" : ""}${formatLocalePoints(saleVsMarketValuePct, 1)} %)`
            : ""
        } ${saleVsMarketValue >= 0 ? "über" : "unter"} Saison-MW`;

  // Buyout-Herleitung unter dem Netto-Erlös: sagt explizit, ob ein Buyout
  // absetzt UND wie viel — statt der bisherigen "kein Buyout"-Nebenbemerkung.
  const buyoutSubText = !preview
    ? null
    : hasBuyout
      ? `Verkaufspreis brutto ${formatTransfermarktCurrency(preview.salePrice)} − Buyout ${formatTransfermarktCurrency(buyoutCost)}`
      : `Kein Buyout fällig — Verkaufspreis brutto ${formatTransfermarktCurrency(preview.salePrice)} bleibt komplett Netto`;

  const pricingNotes = preview?.coaching?.pricingPolicyNotes ?? [];
  const hasNotices = (preview?.warnings.length ?? 0) > 0 || pricingNotes.length > 0;

  // Status-Pille im Kopf (Zone A) — die Töne heißen jetzt wie in der Hülle
  // (FoundationDecisionSurface), nicht mehr wie die alten CSS-Klassen.
  const statusPill: { tone: DecisionSurfaceStatusTone; label: string } =
    readMetaSource === "prisma"
      ? { tone: "neutral", label: "nur Ansicht" }
      : marketSellSuccess
        ? { tone: "done", label: "verkauft" }
        : isLoading
          ? { tone: "warning", label: "wird geprüft" }
          : preview
            ? preview.canSell
              ? { tone: "ready", label: "bereit" }
              : { tone: "blocked", label: "blockiert" }
            : issue?.kind === "window_closed"
              ? { tone: "warning", label: "Fenster zu" }
              : { tone: "blocked", label: "nicht verfügbar" };

  // Beschriftung des Primärbuttons im ERSTEN Schritt (Entwurf Abschnitt 4).
  // Der Klick löst hier nur den Zweiklick der Hülle aus — der tatsächliche
  // Verkauf (confirmTransfermarktSell) passiert erst nach dem zweiten Klick.
  const primaryLabel = isLoading
    ? "Vorschau lädt…"
    : !preview
      ? issue?.kind === "window_closed"
        ? "Verkauf öffnet nach MD10"
        : "Verkauf nicht möglich"
      : !preview.canSell
        ? "Verkauf blockiert"
        : marketSellBusy
          ? "Verkauf läuft…"
          : "Verkaufen…";

  return (
    <FoundationDecisionSurface
      kicker="Transfermarkt · Verkauf"
      status={statusPill}
      ariaLabel="Verkaufsdialog"
      testId="transfer-sell-page"
      // Nur noch für die Zonen-B-G-Inhaltsregeln (z. B. die Metric-Grid-
      // Breakpoints), nicht mehr für Karte/Kopf/Fuß — die kommen aus der Hülle.
      className="transfer-sell-page"
      onClose={closeMarketSellModal}
      closeDisabled={bookingInFlight}
      done={!!marketSellSuccess}
      confirmNote={
        <>
          <strong>Wirklich verkaufen?</strong>
          <span>
            Endgültig — {playerName} verlässt den Kader.{" "}
            {preview?.coaching?.soldPlayerSeasonBanNote ?? "Der Spieler ist danach 1 Saison für dein Team gesperrt."}{" "}
            Netto-Erlös {formatTransfermarktCurrency(netProceeds)}.
          </span>
          {strongAckRequired ? (
            <span className="variant">
              Bestätige zuerst die Checkbox oben bei der Board-Bilanz — erst danach wird der Button aktiv.
            </span>
          ) : null}
        </>
      }
      primary={{
        label: primaryLabel,
        confirmLabel: "Ja, endgültig verkaufen",
        busyLabel: "Verkauf läuft…",
        busy: bookingInFlight,
        disabled: sellDisabled,
        disabledReason: sellDisabledReason,
        danger: true, // ein Verkauf nimmt endgültig etwas weg — rot erst im Bestätigungsschritt
        // Stabile Testids aus docs/design/verkauf-popup.md Abschnitt 8 (u. a. von
        // scripts/full-season-ui-playthrough.ts verwendet) bleiben erhalten, auch
        // wenn der Knopf jetzt von der Hülle gerendert wird.
        buttonTestId: "transfer-sell-confirm-button",
        disabledReasonTestId: "transfer-sell-disabled-reason",
        onConfirm: () => {
          void confirmTransfermarktSell();
        },
      }}
    >
      {/* B: Hero — Identität links, Netto-Erlös als DIE Zahl rechts.
          Bewusst hier in `children` statt im `hero`-Slot der Hülle: der Slot
          setzt einen eigenen Rahmen mit Trennlinie darunter, den es im
          freigegebenen Entwurf nicht gibt — Zone B fließt nahtlos in Zone C. */}
      <section className="transfer-sell-hero" aria-label="Spieler und Erlös">
        <OptimizedMediaImage
          className="transfer-sell-hero-portrait"
          src={portraitSrc}
          alt={playerName}
          width={96}
          height={96}
          loading="lazy"
          fetchPriority="low"
          fallback={
            <div
              className="transfer-sell-hero-portrait transfer-sell-hero-portrait-placeholder"
              aria-label={`${playerName} Platzhalter`}
            >
              {getPlayerPortraitInitials(playerName)}
            </div>
          }
        />
        <div className="transfer-sell-hero-copy">
          <span className="transfer-sell-hero-eyebrow">Verkaufskandidat</span>
          <h2 className="transfer-sell-hero-name">{playerName}</h2>
          <div className="transfer-sell-hero-chips">
            <ClassColorChip className={className} />
            <span className="transfer-sell-hero-chip">{race}</span>
            <span className="transfer-sell-hero-chip">{teamLabel}</span>
            {preview?.activePlayer ? (
              <span className="transfer-sell-hero-chip">
                Rolle {formatRosterRoleTagLabel(preview.activePlayer.roleTag)}
              </span>
            ) : null}
            {preview?.activePlayer ? (
              <span className="transfer-sell-hero-chip">
                Vertrag{" "}
                {vertragLaeuftAus(preview.activePlayer.contractLength)
                  ? "läuft aus"
                  : `${preview.activePlayer.contractLength} Jahre`}
              </span>
            ) : null}
            {preview?.activePlayer?.salary != null ? (
              <span className="transfer-sell-hero-chip">
                Gehalt {formatTransfermarktCurrency(preview.activePlayer.salary)} p.a.
              </span>
            ) : null}
          </div>
        </div>
        {preview ? (
          <div className="transfer-sell-price">
            <span className="transfer-sell-price-label">Netto-Erlös</span>
            <span className="transfer-sell-price-value nl-tnum">{formatTransfermarktCurrency(netProceeds)}</span>
            {buyoutSubText ? <span className="transfer-sell-price-sub">{buyoutSubText}</span> : null}
            <span className="transfer-sell-price-sub" title={SAISON_MW_ERKLAERUNG}>
              Faktor {preview.saleFactor != null ? `${formatLocalePoints(preview.saleFactor, 2)}×` : "—"} auf Saison-MW{" "}
              {formatTransfermarktCurrency(preview.marketValueReference)}
            </span>
            {mwDiffText ? (
              <span
                className={`transfer-sell-price-mw-diff${mwDiffTone ? ` is-${mwDiffTone}` : ""}`}
                title={SAISON_MW_ERKLAERUNG}
              >
                vs. Saison-MW: {mwDiffText}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Sperr-Banner: nur im Zustand "Fenster zu". Amber, kein Alarm — das
          ist ein regulärer Spielzustand, kein Fehler. */}
      {showIssueScreen && issue && issue.kind === "window_closed" ? (
        <div className="transfer-sell-lock-banner" role="status" data-testid="transfer-sell-window-closed">
          <strong>{issue.title}</strong>
          <span>
            {issue.message} {issue.hint ?? ""}
          </span>
        </div>
      ) : null}

      {/* Erfolgskarte: ersetzt die Entscheidungs-Zonen C-F, sobald verkauft. */}
      {marketSellSuccess ? (
        <div
          className="market-v2-buy-signed nl-reveal"
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
          {preview?.coaching?.soldPlayerSeasonBanNote ? (
            <span>{preview.coaching.soldPlayerSeasonBanNote}</span>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        // Echter Ladezustand statt leerer Kacheln mit "—".
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

      {showIssueScreen && issue && issue.kind === "error" ? (
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
      ) : null}

      {showInlineError && issue ? (
        <div className="transfer-feedback-banner is-error" data-testid="transfer-sell-inline-error" role="alert">
          <strong>{issue.title}</strong>
          <span>{issue.message}</span>
        </div>
      ) : null}

      {preview && !marketSellSuccess ? (
        // Erfolgskarte ersetzt C-F (Entwurf Abschnitt 4, Zustand "Gebucht") —
        // nach dem Verkauf zählen nur noch Erlös und Cash danach.
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

          {/* C: 3-Sekunden-Zeile — wer nur diese Zeile liest, kann entscheiden. */}
          <section className="transfer-sell-triple" aria-label="Entscheidung in drei Sekunden">
            <article className="transfer-sell-tile">
              <span className="transfer-sell-tile-label">Du bekommst</span>
              <SellTileRow label="Netto-Erlös" value={formatTransfermarktCurrency(netProceeds)} />
              <SellTileRow
                label="Cash"
                value={
                  <>
                    {formatTransfermarktCurrency(preview.cashBefore)}{" "}
                    <span className="transfer-sell-tile-arrow" aria-hidden="true">
                      →
                    </span>{" "}
                    {formatTransfermarktCurrency(preview.cashAfter)}
                  </>
                }
              />
              <SellTileRow
                label="GuV vs. Kaufpreis"
                value={saleProfit != null ? formatSignedTransfermarktCurrency(saleProfit) : "—"}
                tone={saleProfit != null ? (saleProfit >= 0 ? "good" : "risk") : undefined}
              />
            </article>
            <article className="transfer-sell-tile">
              <span className="transfer-sell-tile-label">Dein Team danach</span>
              <SellTileRow
                label="Kader"
                value={
                  <>
                    {preview.rosterBefore ?? "—"}{" "}
                    <span className="transfer-sell-tile-arrow" aria-hidden="true">
                      →
                    </span>{" "}
                    {preview.rosterAfter ?? "—"}
                  </>
                }
              />
              <SellTileRow
                label="Entlastung p.a."
                value={`−${formatTransfermarktCurrency(preview.salaryReduction)}`}
                tone="good"
              />
              <SellTileRow
                label="Aufstellung danach"
                value={formatReadinessAfterSellLabel(preview.projectedReadinessAfterSell)}
                tone={getReadinessTone(preview.projectedReadinessAfterSell) === "risk" ? "warn" : undefined}
              />
            </article>
            <article className="transfer-sell-tile">
              <span className="transfer-sell-tile-label">Board &amp; GM</span>
              {preview.coaching ? (
                <>
                  <SellTileRow label="Auto-Empfehlung" value={preview.coaching.sellDecisionLabel ?? "—"} />
                  <SellTileRow
                    label="Board-Reaktion"
                    value={
                      <>
                        {preview.coaching.boardReaction.title} ·{" "}
                        <span
                          className={preview.coaching.boardReaction.confidenceDelta >= 0 ? "is-good" : "is-risk"}
                        >
                          {/* Vertrauens-Impuls ist kein Geldbetrag (typ. -1..+0.5) — eigene
                              Vorzeichen-Formatierung statt der Mio-Formatierung. */}
                          {preview.coaching.boardReaction.confidenceDelta >= 0 ? "+" : ""}
                          {formatLocalePoints(preview.coaching.boardReaction.confidenceDelta, 2)}
                        </span>{" "}
                        Vertrauen
                      </>
                    }
                  />
                  <SellTileRow
                    label="GM"
                    value={`${preview.coaching.gmName ?? "—"} · ${formatGmArchetypeLabel(preview.coaching.gmArchetype)} · ${formatGmPressureLabel(preview.coaching.gmPressureLevel)}`}
                  />
                </>
              ) : (
                <p className="transfer-sell-reason-empty">Keine Board-/GM-Daten verfügbar.</p>
              )}
            </article>
          </section>

          {/* Detaillierte Vorher→Nachher-Zahlen zur kompakten Kachel oben. */}
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

          {/* D: Board-Bilanz — der Kern, NIE zugeklappt. Die Karte selbst liegt in
              `TransferSellBoardBalance`, weil der Kader-Drawer dieselbe zeigt; hier bleibt nur,
              was zum VERKAUFEN gehört: die Risiko-Bestätigung. */}
          {preview.coaching ? (
            <TransferSellBoardBalance
              coaching={preview.coaching}
              footer={
                /* Sichtbarkeit der Risiko-Bestätigung MUSS exakt der
                   `strongAckRequired`-Bedingung entsprechen, die oben den Verkauf
                   sperrt (strongAckPending): sobald die Bestätigung sperrt, muss
                   die Checkbox erscheinen — sonst gäbe es einen stillen Dead-End. */
                strongAckRequired ? (
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
                ) : null
              }
            />
          ) : null}

          {/* E: Hinweise nach Gewicht — statt vier gleich lauter roter Balken. */}
          {hasNotices ? (
            <NlCard
              className="transfer-sell-notice-card"
              title="Hinweise"
              eyebrow="nach Gewicht — rot nur, wenn wirklich etwas blockiert"
              data-testid="transfer-sell-warnings"
            >
              <div className="transfer-sell-notice-list">
                {preview.warnings.map((warning) => {
                  const weight = classifySellWarningWeight(warning);
                  return (
                    <div className={`transfer-sell-notice is-${weight}`} key={warning}>
                      <span className="transfer-sell-notice-badge">{NOTICE_BADGE_LABEL[weight]}</span>
                      <span className="transfer-sell-notice-text">{translateSellWarning(warning)}</span>
                    </div>
                  );
                })}
                {pricingNotes.map((note, index) => {
                  const weight = classifySellPricingNoteWeight(note);
                  return (
                    <div className={`transfer-sell-notice is-${weight}`} key={`pricing-${index}-${note}`}>
                      <span className="transfer-sell-notice-badge">{NOTICE_BADGE_LABEL[weight]}</span>
                      <span className="transfer-sell-notice-text">{note}</span>
                    </div>
                  );
                })}
              </div>
            </NlCard>
          ) : null}

          {/* F: Konsequenzen — schmale Zeile, kein Balken-Drama. */}
          <div className="transfer-sell-consequences" aria-label="Konsequenzen">
            <span>
              <b>Marktsperre:</b> 1 Saison —{" "}
              {preview.coaching?.soldPlayerSeasonBanNote ?? "Der Spieler ist danach für dein Team gesperrt."}
            </span>
            {preview.canSell && !marketSellSuccess ? (
              <span data-testid="transfer-sell-final-note">
                <b>Endgültig:</b> Ein Verkauf lässt sich nicht rückgängig machen.
              </span>
            ) : null}
          </div>

          {preview.coaching?.gmWarning ? (
            <div className="transfer-feedback-banner is-warning">
              <strong>GM-Hinweis</strong>
              <span>{preview.coaching.gmWarning}</span>
              {preview.coaching.gmDetail ? <small className="muted">{preview.coaching.gmDetail}</small> : null}
            </div>
          ) : null}

          {preview.coaching?.replacementSlot ? (
            <div className="transfer-callout is-warning">
              <strong>Nachfolger-Slot</strong>
              <p>{preview.coaching.replacementSlot.slotLabel}</p>
              <small className="muted">
                Budget bis {formatTransfermarktCurrency(preview.coaching.replacementSlot.maxBuyPrice)} · Ziel-OVR{" "}
                {preview.coaching.replacementSlot.minOvrBand ?? "—"}
              </small>
            </div>
          ) : null}

          {/* G: Zweite Ebene — der EINZIGE zugeklappte Bereich. Leistung,
              Vertrag und Historie waren drei getrennte Disclosures; die
              Board-Bilanz war zugeklappt und die Statistik offen — das dreht
              der Entwurf exakt um: hier ist alles zusammengefasst, zugeklappt,
              weil es die Entscheidung informiert, aber nicht trägt. */}
          <details className="transfer-sell-disclosure transfer-sell-more">
            <summary>
              Mehr zum Spieler — Leistung, Vertrag, Historie
              <span className="muted">
                OVR {formatWholeNumber(context?.rating?.ovrNormalized ?? context?.player?.ovr ?? null)} · Season-PPs{" "}
                {formatPpsValue(context?.rating?.ppsSeason ?? context?.performance?.totalPoints ?? null)} ·{" "}
                {context?.performance?.appearances ?? 0} Einsätze
              </span>
            </summary>
            <div className="transfer-sell-disclosure-body">
              <p className="transfer-sell-more-section-title">Leistung &amp; PP-Profil</p>
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

              <p className="transfer-sell-more-section-title">Entwicklung &amp; Vertrag</p>
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

              <p className="transfer-sell-more-section-title">Einsätze, Diszis &amp; Transferhistorie</p>
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

      {/* Ambienter Kader-Minimum-Hinweis (unabhängig vom Bestätigen-Schritt) —
          bleibt am Ende des Inhalts, direkt vor der Fußleiste der Hülle, wie
          vorher direkt vor der eigenen Fußleiste. */}
      {rosterAtMinimum && !marketSellSuccess ? (
        <p className="foundation-screen-action-reason" data-testid="transfer-sell-roster-min-note">
          Kader ist am Minimum — ein weiterer Verkauf würde die Aufstellung unmöglich machen. Kaufe zuerst Ersatz.
        </p>
      ) : null}
    </FoundationDecisionSurface>
  );
}
