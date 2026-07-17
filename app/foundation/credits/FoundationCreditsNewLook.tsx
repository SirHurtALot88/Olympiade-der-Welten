"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import { EmptyState } from "@/components/foundation/EmptyState";
import {
  NL_TONE_VAR,
  NlCard,
  NlEmptyState,
  NlTable,
  StatChip,
  StatChipRow,
  formatNlMoney,
  useCountUp,
  type NlTableColumn,
  type NlTone,
} from "@/components/foundation/new-look";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import { buildLoanOffers, computeLoanTerms, type LoanOffer } from "@/lib/finance/loan-service";
import type { LoanEarlyPayoffOutcome, LoanOriginateOutcome } from "@/app/foundation/credits/FoundationCreditsHost";
import type { ActiveLoan, CreditsViewModel, TeamCreditState } from "@/lib/foundation/credits/credits-types";

export type FoundationCreditsNewLookProps = {
  teamName: string;
  model: CreditsViewModel;
  /** Needed to recompute `buildLoanOffers` live as the amount/Laufzeit filter changes. */
  gameState: GameState;
  /** Active manager's own team id — fog of war: never another team's id. */
  teamId: string | null;
  onBorrow: (principal: number, termSeasons: number, lenderTeamId?: string | null) => Promise<LoanOriginateOutcome>;
  onEarlyPayoff: (loanId: string) => Promise<LoanEarlyPayoffOutcome>;
  adminOverride: boolean;
  onToggleAdminOverride: (next: boolean) => void;
};

function formatRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) {
    return "—";
  }
  return `${(rate * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })}%`;
}

function formatRateRange(minRate: number, maxRate: number): string {
  if (Math.abs(minRate - maxRate) < 0.0005) {
    return formatRate(minRate);
  }
  // Kürzere Laufzeit → höherer Satz (siehe computeLoanTerms), Range also
  // "niedrigster – höchster Satz" unabhängig davon welcher Wert größer ist.
  const low = Math.min(minRate, maxRate);
  const high = Math.max(minRate, maxRate);
  return `${formatRate(low)} – ${formatRate(high)}`;
}

/** Eine Zeile der Aktive-Kredite-Tabelle — `index` wird für das "Kredit N"-Label gebraucht. */
type NlCreditsLoanRow = { loan: ActiveLoan; index: number };

/** Spaltenkatalog der Aktive-Kredite-Tabelle (`NlTable`-Migrationsbeleg, siehe FOUNDATION-Audit). */
const NL_CREDITS_LOAN_COLUMNS: NlTableColumn<NlCreditsLoanRow>[] = [
  { key: "kredit", label: "Kredit" },
  { key: "lender", label: "Verleiher" },
  { key: "principal", label: "Aufgenommen", align: "right" },
  { key: "outstanding", label: "Restschuld", align: "right" },
  { key: "rate", label: "Zinssatz", align: "right" },
  { key: "term", label: "Restlaufzeit", align: "right" },
  { key: "instalment", label: "Jahresrate", align: "right" },
  { key: "action", label: "Aktion" },
];

function renderCreditsLoanCell(
  row: NlCreditsLoanRow,
  column: NlTableColumn<NlCreditsLoanRow>,
  canEarlyPayoff: boolean,
  onEarlyPayoff: (loanId: string) => Promise<LoanEarlyPayoffOutcome>,
) {
  const { loan, index } = row;
  switch (column.key) {
    case "kredit":
      return `Kredit ${index + 1}`;
    case "lender":
      return loan.lenderName;
    case "principal":
      return formatNlMoney(loan.principal);
    case "outstanding":
      return formatNlMoney(loan.outstanding);
    case "rate":
      return formatRate(loan.interestRate);
    case "term":
      return `${loan.remainingSeasons} / ${loan.termSeasons} Saisons`;
    case "instalment":
      return formatNlMoney(loan.nextInstalment);
    case "action":
      return <LoanEarlyPayoffAction loan={loan} canEarlyPayoff={canEarlyPayoff} onEarlyPayoff={onEarlyPayoff} />;
    default:
      return null;
  }
}

/** Grün/Amber/Rot-Ton nach Anteil (0..1) — geteilte Schwelle für Gauge, Slider und Belastungs-Badge. */
function riskTone(ratio: number): NlTone {
  const safeRatio = Number.isFinite(ratio) ? ratio : 0;
  if (safeRatio >= 0.85) return "risk";
  if (safeRatio >= 0.6) return "warn";
  return "good";
}

// --- Kreditrahmen-Gauge (Grafik-Welle 2) ------------------------------
// Handgerolltes, halbkreisförmiges SVG-Gauge, gleiche Bogen-Geometrie-Schule
// wie `NlGauge` (siehe components/foundation/new-look/NlGauge.tsx), aber ein
// echter 180°-Halbkreis (flache Grundlinie) statt des 240°-Bogens dort, plus
// bandierte Zonen (grün/amber/rot) statt eines einfarbigen Tracks — die Kredite-
// Ansicht bekommt hier bewusst ihre eigene, "cockpit"-artige Variante.
const GAUGE_W = 220;
const GAUGE_H = 132;
const GAUGE_CENTER_X = 110;
const GAUGE_CENTER_Y = 112;
const GAUGE_RADIUS = 92;
const GAUGE_STROKE = 16;
const GAUGE_START_DEG = -90;
const GAUGE_SWEEP_DEG = 180;
const GAUGE_WARN_RATIO = 0.6;
const GAUGE_DANGER_RATIO = 0.85;
const GAUGE_ZONE_COLORS = ["var(--heat-good-bg)", "var(--heat-neutral-bg)", "var(--heat-danger-light-bg)"];

function gaugePolarPoint(angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: GAUGE_CENTER_X + GAUGE_RADIUS * Math.cos(rad),
    y: GAUGE_CENTER_Y + GAUGE_RADIUS * Math.sin(rad),
  };
}

function gaugeArcPath(startDeg: number, endDeg: number): string {
  const start = gaugePolarPoint(startDeg);
  const end = gaugePolarPoint(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/**
 * Hero-Gauge: Schulden vs. Bank-Kreditrahmen (`creditCapacityTotal`,
 * `creditUtilizationRatio` aus dem View-Model). Bogenfarbe folgt der
 * Auslastung (grün → amber → rot), der Bogen selbst bleibt in einem
 * grün/amber/rot-bandierten Track sichtbar, damit die Zonen auch ohne
 * Bewegung erkennbar sind ("Cockpit"-Charakter statt Excel-Zeile).
 */
function CreditUtilizationGauge({ outstanding, capacity, ratio }: { outstanding: number; capacity: number; ratio: number }) {
  const safeRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  const tone = riskTone(safeRatio);
  const endDeg = GAUGE_START_DEG + Math.max(safeRatio * GAUGE_SWEEP_DEG, 0.001);
  const needle = gaugePolarPoint(endDeg);
  const pct = Math.round(safeRatio * 1000) / 10;
  const zoneBounds = [0, GAUGE_WARN_RATIO, GAUGE_DANGER_RATIO, 1];
  const ariaLabel = `Kreditrahmen-Auslastung: ${formatNlMoney(outstanding)} Schulden von ${formatNlMoney(capacity)} Bank-Rahmen, ${pct.toLocaleString("de-DE", { maximumFractionDigits: 1 })}%`;

  return (
    <div className="nl-credits-gauge" role="img" aria-label={ariaLabel} title={ariaLabel}>
      <svg viewBox={`0 0 ${GAUGE_W} ${GAUGE_H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {zoneBounds.slice(0, -1).map((from, index) => (
          <path
            key={`zone-${index}`}
            d={gaugeArcPath(GAUGE_START_DEG + from * GAUGE_SWEEP_DEG, GAUGE_START_DEG + zoneBounds[index + 1] * GAUGE_SWEEP_DEG)}
            className="nl-credits-gauge-zone"
            fill="none"
            stroke={GAUGE_ZONE_COLORS[index]}
            strokeWidth={GAUGE_STROKE}
          />
        ))}
        <path
          d={gaugeArcPath(GAUGE_START_DEG, endDeg)}
          className="nl-credits-gauge-fill"
          fill="none"
          stroke={NL_TONE_VAR[tone]}
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
        />
        <circle cx={needle.x} cy={needle.y} r={GAUGE_STROKE * 0.55} className="nl-credits-gauge-needle" fill={NL_TONE_VAR[tone]} />
      </svg>
      <div className="nl-credits-gauge-copy">
        <span className="nl-credits-gauge-value nl-tnum">{pct.toLocaleString("de-DE", { maximumFractionDigits: 1 })}%</span>
        <span className="nl-credits-gauge-label">Auslastung</span>
        <span className="nl-credits-gauge-sub nl-tnum">
          {formatNlMoney(outstanding)} / {formatNlMoney(capacity)}
        </span>
      </div>
    </div>
  );
}

// --- Tilgung-vs-Cashflow (Grafik-Welle 2) -----------------------------
// Gestapelter Belastungs-Balken: Kreditrate (hervorgehoben) + Gehälter +
// Gebäude-Unterhalt, optional mit Einnahmen-Marker. Degradiert bewusst
// graceful, siehe Kommentare unten (nie ein All-Null/NaN-Chart rendern).
const BURDEN_W = 320;
const BURDEN_H = 60;
const BURDEN_PAD_X = 10;
const BURDEN_BAR_Y = 16;
const BURDEN_BAR_H = 22;
/** Anteil der Kreditrate am Cash, ab dem ohne Einnahmen-Referenz die "Belastung"-Warnung greift. */
const BURDEN_CASH_SHARE_DANGER = 0.25;

type BurdenSegment = { key: string; label: string; value: number; color: string };

function LoanBurdenChart({
  installment,
  salary,
  upkeep,
  revenue,
  cash,
}: {
  installment: number;
  salary: number;
  upkeep: number;
  revenue: number;
  cash: number;
}) {
  const safe = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);
  const segments: BurdenSegment[] = [
    { key: "loan", label: "Kreditraten", value: safe(installment), color: NL_TONE_VAR.risk },
    { key: "salary", label: "Gehälter", value: safe(salary), color: NL_TONE_VAR.men },
    { key: "upkeep", label: "Gebäude-Unterhalt", value: safe(upkeep), color: NL_TONE_VAR.soc },
  ];
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const safeRevenue = safe(revenue);
  const safeCash = safe(cash);

  // Nie ein All-Null/NaN-Chart rendern (z. B. Team ohne Kredit, Gehälter UND
  // Gebäude) — stattdessen ein knapper Fallback statt eines leeren SVGs.
  if (total <= 0) {
    return <NlEmptyState className="nl-credits-burden-empty" title="Keine laufenden Ausgaben bekannt." />;
  }

  const hasIncome = safeRevenue > 0;
  const scale = Math.max(total, safeRevenue, 0.0001);
  const barWidth = BURDEN_W - BURDEN_PAD_X * 2;
  let cursor = BURDEN_PAD_X;
  const rects = segments
    .filter((seg) => seg.value > 0)
    .map((seg) => {
      const width = (seg.value / scale) * barWidth;
      const rect = { ...seg, x: cursor, width };
      cursor += width;
      return rect;
    });
  const incomeX = hasIncome ? BURDEN_PAD_X + Math.min(1, safeRevenue / scale) * barWidth : null;
  const covered = hasIncome && safeRevenue >= total;

  // Ohne verlässliche Einnahmen (oft 0 vor Sponsorvertrag/Season 1, siehe
  // `estimateTeamAnnualRevenue`) statt eines kaputten/leeren Einnahmen-
  // Overlays lieber die Cash-Belastung der Kreditrate selbst bewerten.
  const cashShare = safeCash > 0 ? installment / safeCash : installment > 0 ? 1 : 0;
  const isDanger = !hasIncome && cashShare >= BURDEN_CASH_SHARE_DANGER;

  const ariaLabel =
    `Jährliche Belastung: ${formatNlMoney(installment)} Kreditrate, ${formatNlMoney(salary)} Gehälter, ` +
    `${formatNlMoney(upkeep)} Gebäude-Unterhalt, Summe ${formatNlMoney(total)}` +
    (hasIncome ? `, Einnahmen ${formatNlMoney(safeRevenue)}` : "");

  return (
    <div className={`nl-credits-burden${isDanger ? " is-danger" : ""}`} data-testid="nl-credits-burden-chart">
      <svg
        className="nl-credits-burden-chart"
        viewBox={`0 0 ${BURDEN_W} ${BURDEN_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
      >
        <rect x={BURDEN_PAD_X} y={BURDEN_BAR_Y} width={barWidth} height={BURDEN_BAR_H} rx={6} className="nl-credits-burden-track" />
        {rects.map((rect) => (
          <rect
            key={rect.key}
            x={rect.x}
            y={BURDEN_BAR_Y}
            width={Math.max(0, rect.width)}
            height={BURDEN_BAR_H}
            fill={rect.color}
            className={`nl-credits-burden-seg${rect.key === "loan" ? " is-loan" : ""}`}
          >
            <title>
              {rect.label}: {formatNlMoney(rect.value)}
            </title>
          </rect>
        ))}
        {hasIncome && incomeX != null ? (
          <g className="nl-credits-burden-marker">
            <line x1={incomeX} y1={BURDEN_BAR_Y - 6} x2={incomeX} y2={BURDEN_BAR_Y + BURDEN_BAR_H + 6} />
            <text x={incomeX} y={BURDEN_BAR_Y - 9} textAnchor="middle">
              Einnahmen
            </text>
          </g>
        ) : null}
      </svg>
      <div className="nl-credits-burden-legend">
        {segments.map((seg) => (
          <span key={seg.key} className="nl-credits-burden-legend-item">
            <span className="nl-credits-burden-legend-dot" style={{ background: seg.color }} aria-hidden="true" />
            <span className="nl-credits-burden-legend-label">{seg.label}</span>
            <span className="nl-credits-burden-legend-value nl-tnum">{formatNlMoney(seg.value)}</span>
          </span>
        ))}
        <span className="nl-credits-burden-legend-item is-total">
          <span className="nl-credits-burden-legend-label">Summe</span>
          <span className="nl-credits-burden-legend-value nl-tnum">{formatNlMoney(total)}</span>
        </span>
        {hasIncome ? (
          <span className={`nl-credits-burden-badge ${covered ? "is-good" : "is-risk"}`}>{covered ? "Gedeckt" : "Deckungslücke"}</span>
        ) : isDanger ? (
          <span className="nl-credits-burden-badge is-risk">Belastung</span>
        ) : null}
      </div>
    </div>
  );
}

// --- Season-1 Vault-Empty-State (Grafik-Welle 2) -----------------------
// Reines inline-SVG, kein externes Asset: Tresor-Rad + Vorhängeschloss-
// Badge statt der früheren zwei grauen Textboxen.
const VAULT_SPOKE_ANGLES = [0, 60, 120, 180, 240, 300];

function LockedVaultIllustration() {
  const cx = 60;
  const cy = 58;
  const spokeInner = 15;
  const spokeOuter = 42;
  return (
    <svg className="nl-credits-vault" viewBox="0 0 120 116" aria-hidden="true">
      <circle cx={cx} cy={cy} r={48} className="nl-credits-vault-rim" />
      {VAULT_SPOKE_ANGLES.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = cx + spokeInner * Math.cos(rad);
        const y1 = cy + spokeInner * Math.sin(rad);
        const x2 = cx + spokeOuter * Math.cos(rad);
        const y2 = cy + spokeOuter * Math.sin(rad);
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} className="nl-credits-vault-spoke" />;
      })}
      <circle cx={cx} cy={cy} r={15} className="nl-credits-vault-hub" />
      <g className="nl-credits-vault-lock" transform="translate(84, 84)">
        <path d="M -8 1 A 8 8 0 0 1 8 1" className="nl-credits-vault-lock-shackle" fill="none" />
        <rect x={-10} y={0} width={20} height={15} rx={4} className="nl-credits-vault-lock-body" />
      </g>
    </svg>
  );
}

/** Deutschsprachige Erklärung für die vom Server/Service gemeldeten `reason`-Codes. */
function describeBorrowReason(reason: string | null): string {
  switch (reason) {
    case "not_preseason":
      return "Kreditaufnahme ist nur in der Vorbereitung (Preseason) möglich.";
    case "season_one_no_loans":
      return "In Season 1 sind noch keine Kredite möglich.";
    case "over_capacity":
      return "Die gewünschte Summe übersteigt den Rahmen dieses Anbieters.";
    case "invalid_principal":
      return "Bitte eine gültige Kreditsumme größer als 0 eingeben.";
    case "invalid_term_seasons":
      return "Bitte eine Laufzeit zwischen 1 und 10 Saisons wählen.";
    case "invalid_lender":
      return "Ungültiger Verleiher.";
    case "lender_not_found":
      return "Verleiher-Team konnte nicht gefunden werden.";
    case "lender_hostile_relationship":
      return "Dieses Team leiht euch aufgrund der Beziehung nichts.";
    case "lender_insufficient_cash":
      return "Der Verleiher hat gerade nicht genug freies Cash für diese Summe.";
    case "borrower_not_found":
      return "Team konnte nicht gefunden werden.";
    case "stale_season":
      return "Die Saison hat sich geändert — bitte neu laden und erneut versuchen.";
    case "save_not_found":
      return "Spielstand konnte nicht gefunden werden.";
    case "missing_fields":
      return "Unvollständige Anfrage — bitte erneut versuchen.";
    case "prisma_read_only":
      return "Im Referenzmodus (Prisma/Supabase) ist die Kreditaufnahme schreibgeschützt.";
    case "not_available":
      return "Kreditaufnahme ist gerade nicht verfügbar.";
    case null:
    case undefined:
      return "Kredit aufgenommen.";
    default:
      return `Kredit konnte nicht aufgenommen werden (${reason}).`;
  }
}

/** Deutschsprachige Erklärung für die vom Server/Service gemeldeten Vorab-Ablösung-`reason`-Codes. */
function describeEarlyPayoffReason(reason: string | null): string {
  switch (reason) {
    case "not_preseason":
      return "Vorzeitige Ablösung ist nur in der Vorbereitung/Verkaufsphase möglich.";
    case "loan_not_found":
      return "Kredit konnte nicht gefunden werden.";
    case "loan_not_own_team":
      return "Dieser Kredit gehört nicht eurem Team.";
    case "loan_not_active":
      return "Dieser Kredit ist nicht mehr aktiv.";
    case "insufficient_cash":
      return "Nicht genug Cash für die Ablösesumme.";
    case "borrower_not_found":
      return "Team konnte nicht gefunden werden.";
    case "stale_season":
      return "Die Saison hat sich geändert — bitte neu laden und erneut versuchen.";
    case "save_not_found":
      return "Spielstand konnte nicht gefunden werden.";
    case "missing_fields":
      return "Unvollständige Anfrage — bitte erneut versuchen.";
    case "prisma_read_only":
      return "Im Referenzmodus (Prisma/Supabase) ist die Ablösung schreibgeschützt.";
    case "not_available":
      return "Vorzeitige Ablösung ist gerade nicht verfügbar.";
    case null:
    case undefined:
      return "Kredit vorzeitig abgelöst.";
    default:
      return `Kredit konnte nicht abgelöst werden (${reason}).`;
  }
}

/** One card per lender offer — cheapest interest first (see `buildLoanOffers`). */
function LoanOfferCard({
  offer,
  lenderTeam,
  amount,
  termSeasons,
  isBest,
  amountTone,
  onBorrow,
}: {
  offer: LoanOffer;
  /** Nur bei `offer.lenderType === "team"` gesetzt — für Logo/Initialen, siehe `getTeamLogoModel`. */
  lenderTeam: Team | null;
  amount: number;
  termSeasons: number;
  /** Erstes (günstigstes) Angebot, nur wenn mehr als eines existiert. */
  isBest: boolean;
  /** Slider-Farbfeedback (siehe `riskTone`) — färbt den Zinssatz nach Anteil der Kreditsumme am Rahmen ein. */
  amountTone: NlTone;
  onBorrow: (principal: number, termSeasons: number, lenderTeamId?: string | null) => Promise<LoanOriginateOutcome>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const totalRepayment = offer.installmentPerSeason * termSeasons;
  const totalInterest = Math.max(0, totalRepayment - amount);
  // The bank card is always present regardless of the requested amount (see
  // `buildLoanOffers`) — it renders disabled once the amount exceeds its
  // `maxAmount`. Team cards are already pre-filtered by the service (a team
  // whose offer < principal is omitted entirely, "drops out" as the slider
  // rises) so `eligible` is trivially true for them, but deriving it the
  // same way for both keeps this a single, uniform rule.
  const eligible = amount <= offer.maxAmount;
  const canSubmit = eligible && amount > 0 && !busy;

  const teamLogo = offer.lenderType === "team" && lenderTeam ? getTeamLogoModel(lenderTeam, { variant: "thumb" }) : null;

  return (
    <div
      className={`nl-credits-offer-card${eligible ? "" : " is-disabled"}${isBest ? " is-best" : ""}`}
      data-testid="nl-credits-offer-card"
      data-lender-type={offer.lenderType}
    >
      <div className="nl-credits-offer-header">
        {offer.lenderType === "bank" ? (
          <span className="nl-credits-offer-crest is-bank" aria-hidden="true">
            ₤
          </span>
        ) : (
          <span className="nl-credits-offer-crest is-team">
            {teamLogo?.src ? (
              <BudgetedMediaImage
                className="nl-credits-offer-crest-img"
                src={teamLogo.src}
                alt=""
                width={28}
                height={28}
                loading="lazy"
                fetchPriority="low"
                fallback={<span aria-hidden="true">{teamLogo.initials}</span>}
              />
            ) : (
              <span aria-hidden="true">{teamLogo?.initials ?? "?"}</span>
            )}
          </span>
        )}
        <span className="nl-credits-offer-name">{offer.lenderName}</span>
        {isBest ? <span className="nl-credits-offer-best-badge">Bestes Angebot</span> : null}
        {offer.lenderType === "team" && offer.relationshipValue != null ? (
          <span className="nl-credits-offer-badge" title="Beziehung zum Verleiher-Team">
            Beziehung {offer.relationshipValue > 0 ? `+${offer.relationshipValue}` : offer.relationshipValue}
          </span>
        ) : null}
      </div>

      <div className="nl-credits-offer-rate nl-tnum" style={{ color: NL_TONE_VAR[amountTone] }}>
        {formatRate(offer.interestRatePerSeason)}
      </div>

      <div className="nl-credits-offer-stats">
        <div className="nl-credits-offer-stat">
          <span className="nl-credits-offer-stat-label">Jahresrate</span>
          <span className="nl-credits-offer-stat-value nl-tnum">{formatNlMoney(offer.installmentPerSeason)}</span>
        </div>
        <div className="nl-credits-offer-stat">
          <span className="nl-credits-offer-stat-label">Gesamtrückzahlung</span>
          <span className="nl-credits-offer-stat-value nl-tnum">{formatNlMoney(totalRepayment)}</span>
        </div>
        <div className="nl-credits-offer-stat">
          <span className="nl-credits-offer-stat-label">Gesamtzinsen</span>
          <span className="nl-credits-offer-stat-value nl-tnum">{formatNlMoney(totalInterest)}</span>
        </div>
        <div className="nl-credits-offer-stat">
          <span className="nl-credits-offer-stat-label">Max. verfügbar</span>
          <span className="nl-credits-offer-stat-value nl-tnum">{formatNlMoney(offer.maxAmount)}</span>
        </div>
      </div>

      {!eligible ? <p className="nl-credits-offer-note">Reicht für diese Summe nicht.</p> : null}

      <button
        type="button"
        className="primary-button nl-credits-offer-button"
        disabled={!canSubmit}
        onClick={() => {
          setMessage(null);
          setBusy(true);
          void onBorrow(amount, termSeasons, offer.lenderTeamId)
            .then((outcome) => {
              setMessage(describeBorrowReason(outcome.reason));
            })
            .finally(() => setBusy(false));
        }}
        data-testid="nl-credits-offer-submit"
      >
        {busy ? "Wird aufgenommen…" : "Aufnehmen"}
      </button>

      {message ? (
        <p className="nl-credits-borrow-message" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Amount slider + exact input + Laufzeit dropdown — a FILTER, not a direct borrow action. */
function LoanOfferFilterPanel({
  team,
  amount,
  amountInput,
  termSeasons,
  onAmountChange,
  onAmountInputChange,
  onAmountBlur,
  onTermSeasonsChange,
}: {
  team: TeamCreditState;
  amount: number;
  amountInput: string;
  termSeasons: number;
  onAmountChange: (next: number) => void;
  onAmountInputChange: (raw: string) => void;
  onAmountBlur: () => void;
  onTermSeasonsChange: (next: number) => void;
}) {
  const maxAmount = Math.max(0, team.maxOfferAmount);
  const sliderStep = maxAmount > 0 ? Math.max(0.1, Math.round((maxAmount / 200) * 10) / 10) : 0.1;
  // Slider-Farbfeedback (Grafik-Welle 2): reiner Anteils-Wert, keine eigene
  // Wirtschaftslogik — färbt Slider-Füllung, Betragsfeld und Prozent-Chip
  // grün→amber→rot je näher der Betrag an `maxOfferAmount` heranrückt.
  const amountFraction = maxAmount > 0 ? Math.max(0, Math.min(1, amount / maxAmount)) : 0;
  const amountTone = riskTone(amountFraction);
  const amountToneColor = NL_TONE_VAR[amountTone];
  const amountPct = Math.round(amountFraction * 100);

  return (
    <NlCard className="nl-credits-borrow-card" eyebrow="Kredit-Filter" title="Kreditsumme & Laufzeit wählen">
      <div className="nl-credits-borrow-amount">
        <div className="nl-credits-borrow-amount-row">
          <input
            type="range"
            className="nl-credits-slider"
            min={0}
            max={maxAmount}
            step={sliderStep}
            value={amount}
            disabled={maxAmount <= 0}
            onChange={(event) => onAmountChange(Number(event.target.value))}
            aria-label="Kreditsumme (Slider)"
            data-testid="nl-credits-principal-slider"
            style={{
              accentColor: amountToneColor,
              background: `linear-gradient(90deg, ${amountToneColor} ${amountPct}%, var(--nl-line) ${amountPct}%)`,
            }}
          />
          <div className="nl-credits-amount-field" style={{ borderColor: maxAmount > 0 ? amountToneColor : undefined }}>
            <input
              type="number"
              className="nl-credits-amount-input nl-tnum"
              min={0}
              max={maxAmount}
              step={0.1}
              value={amountInput}
              disabled={maxAmount <= 0}
              onChange={(event) => onAmountInputChange(event.target.value)}
              onBlur={onAmountBlur}
              aria-label="Kreditsumme (genauer Betrag, Mio.)"
              data-testid="nl-credits-principal-input"
              style={{ color: maxAmount > 0 ? amountToneColor : undefined }}
            />
            <span className="nl-credits-amount-unit">Mio.</span>
          </div>
          {maxAmount > 0 ? (
            <span
              className="nl-credits-amount-tier nl-tnum"
              style={{ color: amountToneColor, borderColor: amountToneColor }}
              title="Anteil der Kreditsumme am größten verfügbaren Angebot"
              data-testid="nl-credits-amount-tier"
            >
              {amountPct}% des Rahmens
            </span>
          ) : null}
        </div>
        <div className="nl-credits-amount-range">
          <span>0</span>
          <span>Max. Angebot: {formatNlMoney(maxAmount)}</span>
        </div>
      </div>

      <label className="nl-credits-term-field">
        <span className="nl-credits-term-label">Laufzeit</span>
        <select
          className="nl-credits-term-select"
          value={termSeasons}
          onChange={(event) => onTermSeasonsChange(Number(event.target.value))}
          data-testid="nl-credits-term-select"
        >
          {Array.from(
            { length: team.maxTermSeasons - team.minTermSeasons + 1 },
            (_, index) => team.minTermSeasons + index,
          ).map((seasons) => (
            <option key={seasons} value={seasons}>
              {seasons} {seasons === 1 ? "Saison" : "Saisons"}
            </option>
          ))}
        </select>
      </label>

      <p className="nl-credits-empty-text muted">
        Betrag und Laufzeit filtern die Angebote unten — sie nehmen noch keinen Kredit auf.
      </p>
    </NlCard>
  );
}

/**
 * Per-row "Vorzeitig ablösen" (early payoff) action for the active-loans
 * table. Shows the `computeEarlyPayoff` quote (already computed by the view
 * model, see `use-credits-view-model.ts`) inline before asking for
 * confirmation — own-team only (the loan comes from `team.activeLoans`,
 * fog-of-war-safe by construction), hidden outside the allowed phase.
 */
function LoanEarlyPayoffAction({
  loan,
  canEarlyPayoff,
  onEarlyPayoff,
}: {
  loan: ActiveLoan;
  canEarlyPayoff: boolean;
  onEarlyPayoff: (loanId: string) => Promise<LoanEarlyPayoffOutcome>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!canEarlyPayoff) {
    return <span className="nl-credits-empty-text muted">Nur in der Verkaufsphase möglich.</span>;
  }

  if (!expanded) {
    return (
      <button
        type="button"
        className="secondary-button nl-credits-payoff-button"
        onClick={() => {
          setMessage(null);
          setExpanded(true);
        }}
        data-testid="nl-credits-payoff-open"
      >
        Vorzeitig ablösen
      </button>
    );
  }

  const quote = loan.earlyPayoffQuote;
  const remainingScheduled = loan.nextInstalment * loan.remainingSeasons;

  return (
    <div className="nl-credits-payoff-panel" data-testid="nl-credits-payoff-panel">
      <div className="nl-credits-payoff-quote">
        <div className="nl-credits-quote-row">
          <span className="nl-credits-quote-label">Ablösesumme</span>
          <span className="nl-credits-quote-value nl-tnum">{formatNlMoney(quote.payoff)}</span>
        </div>
        <div className="nl-credits-quote-row">
          <span className="nl-credits-quote-label">davon Vorfälligkeits-Gebühr</span>
          <span className="nl-credits-quote-value nl-tnum">{formatNlMoney(quote.feePortion)}</span>
        </div>
        <div className="nl-credits-quote-row">
          <span className="nl-credits-quote-label">gesparte Zinsen</span>
          <span className="nl-credits-quote-value nl-tnum">
            {formatNlMoney(Math.max(0, quote.foregoneInterest - quote.feePortion))}
          </span>
        </div>
        <div className="nl-credits-quote-row">
          <span className="nl-credits-quote-label">volle Restrate (Vergleich)</span>
          <span className="nl-credits-quote-value nl-tnum">{formatNlMoney(remainingScheduled)}</span>
        </div>
      </div>
      <div className="nl-credits-payoff-actions">
        <button
          type="button"
          className="primary-button nl-credits-payoff-confirm"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setMessage(null);
            void onEarlyPayoff(loan.id)
              .then((outcome) => {
                setMessage(describeEarlyPayoffReason(outcome.reason));
                if (outcome.ok) {
                  setExpanded(false);
                }
              })
              .finally(() => setBusy(false));
          }}
          data-testid="nl-credits-payoff-confirm"
        >
          {busy ? "Wird abgelöst…" : "Bestätigen"}
        </button>
        <button
          type="button"
          className="secondary-button nl-credits-payoff-cancel"
          disabled={busy}
          onClick={() => setExpanded(false)}
        >
          Abbrechen
        </button>
      </div>
      {message ? (
        <p className="nl-credits-borrow-message" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * "Neuer Look" Kredite — Angebots-Marktplatz, wired to the real bank + team
 * credit system (`lib/finance/loan-service.ts`, `buildLoanOffers`), see
 * `docs/design/kredit-system.md` §"Phase 3 — Team-zu-Team-Kredite
 * (Detailkonzept)" / §"Angebots-UI".
 *
 * The amount slider + Laufzeit dropdown are a FILTER that parametrizes a
 * live offer list (one card per lender, cheapest interest first — the
 * service already returns offers pre-sorted by `interestRatePerSeason`);
 * borrowing happens per-card via "Aufnehmen", not via the filter itself.
 * Bank + eligible team offers render side by side; as the amount rises,
 * team cards whose `maxAmount` falls below the request simply drop out of
 * the list returned by `buildLoanOffers` — no client-side filtering needed.
 * Season 1 is a hard rule (`buildLoanOffers` → `[]`), surfaced as a
 * dedicated note instead of an empty grid.
 *
 * No manual repayment — settlement is automatic at season end
 * (`applyLoanSettlement`); active loans instead offer a "Vorzeitig ablösen"
 * (early payoff) action per row, see `computeEarlyPayoff`/`applyEarlyPayoff`.
 */
export default function FoundationCreditsNewLook({
  teamName,
  model,
  gameState,
  teamId,
  onBorrow,
  onEarlyPayoff,
  adminOverride,
  onToggleAdminOverride,
}: FoundationCreditsNewLookProps) {
  const team = model.status === "ready" ? model.team : null;
  const maxAmount = Math.max(0, team?.maxOfferAmount ?? 0);

  const [amount, setAmount] = useState<number>(() => Math.round((maxAmount / 2) * 10) / 10);
  const [amountInput, setAmountInput] = useState<string>(() => String(Math.round((maxAmount / 2) * 10) / 10));
  const [termSeasons, setTermSeasons] = useState<number>(team?.minTermSeasons ?? 1);

  // Anders als früher (die Slider-Form mountete erst, sobald `team.canBorrow`
  // feststand) mountet der Filter jetzt immer — `model` kann also nach dem
  // ersten Render noch von "not_ready" auf "ready" wechseln. Den
  // Default-Betrag (Kapazitätsmitte) daher einmalig setzen, sobald zum
  // ersten Mal eine echte Kapazität > 0 bekannt ist, statt bei 0 hängen zu
  // bleiben; danach nur noch in den (ggf. neuen) Rahmen klemmen.
  const didInitializeAmountRef = useRef(false);
  useEffect(() => {
    if (!didInitializeAmountRef.current && maxAmount > 0) {
      didInitializeAmountRef.current = true;
      const initial = Math.round((maxAmount / 2) * 10) / 10;
      setAmount(initial);
      setAmountInput(String(initial));
      return;
    }
    setAmount((current) => {
      const clamped = Math.min(Math.max(0, current), maxAmount);
      setAmountInput(String(clamped));
      return clamped;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxAmount]);

  function applyAmount(next: number) {
    const clamped = Math.min(Math.max(0, next), maxAmount);
    setAmount(clamped);
    setAmountInput(String(clamped));
  }

  // #182: Liga-Kreditübersicht — welche Teams aktuell wie viel Kredit laufen
  // haben. Aggregiert aktive Kredite (`gameState.loans`) je Borrower-Team;
  // Rest reines Read-Modell, absteigend nach Restschuld sortiert.
  const leagueCreditRows = useMemo(() => {
    const loans = gameState.seasonState.loans ?? [];
    const byTeam = new Map<string, { outstanding: number; installment: number; count: number; missed: number }>();
    for (const loan of loans) {
      if (loan.status !== "active") continue;
      const agg = byTeam.get(loan.borrowerTeamId) ?? { outstanding: 0, installment: 0, count: 0, missed: 0 };
      agg.outstanding += loan.principalOutstanding;
      agg.installment += loan.installmentPerSeason;
      agg.count += 1;
      agg.missed += loan.missedPayments;
      byTeam.set(loan.borrowerTeamId, agg);
    }
    return gameState.teams
      .map((team) => {
        const agg = byTeam.get(team.teamId) ?? null;
        return {
          teamId: team.teamId,
          teamName: team.name,
          shortCode: team.shortCode,
          outstanding: agg?.outstanding ?? 0,
          installment: agg?.installment ?? 0,
          count: agg?.count ?? 0,
          missed: agg?.missed ?? 0,
        };
      })
      .filter((row) => row.count > 0)
      .sort((left, right) => right.outstanding - left.outstanding);
  }, [gameState.seasonState.loans, gameState.teams]);
  const leagueCreditMaxOutstanding = leagueCreditRows[0]?.outstanding ?? 0;
  const leagueCreditTotal = leagueCreditRows.reduce((sum, row) => sum + row.outstanding, 0);

  // Live offer recompute on every filter change — pure/derived, no mutation,
  // never cached across renders so team cards appear/disappear immediately
  // as the amount/Laufzeit filter moves. Empty until a real team is known
  // (not_ready / fog-of-war-safe: teamId is always the active manager's own
  // id here, see FoundationCreditsHost). Also empty in Season 1 (hard rule,
  // see `isSeasonOneBlocked` below) — `buildLoanOffers` itself returns `[]`.
  const offers = useMemo(() => {
    if (!team || !teamId || amount <= 0) return [];
    return buildLoanOffers(gameState, teamId, amount, termSeasons, {
      allowSeason1: adminOverride,
    });
  }, [gameState, team, teamId, amount, termSeasons, adminOverride]);

  const isSeasonOneBlocked = team?.borrowBlockedReason === "season_one";
  // Kredite ohne aktive Kredite in Season 1 → ein einzelner Tresor-Empty-State
  // statt zweier grauer Boxen (Angebots-Sperre + leere Aktive-Kredite-Tabelle),
  // siehe `LockedVaultIllustration`. Admin-Override kann in Season 1 trotzdem
  // Kredite anlegen — bleiben die dann sichtbar, zeigt die normale Tabelle.
  const showVaultEmptyState = isSeasonOneBlocked && (team?.activeLoans.length ?? 0) === 0;

  const rateRange = team
    ? formatRateRange(
        computeLoanTerms({ principal: 1, termSeasons: team.minTermSeasons, finances: team.finances }).interestRatePerSeason,
        computeLoanTerms({ principal: 1, termSeasons: team.maxTermSeasons, finances: team.finances }).interestRatePerSeason,
      )
    : "—";

  // Slider-Farbfeedback (Grafik-Welle 2), gespiegelt auf den Zinssatz jeder
  // Angebotskarte — reiner Anteils-Wert, keine eigene Wirtschaftslogik.
  const amountFraction = maxAmount > 0 ? Math.max(0, Math.min(1, amount / maxAmount)) : 0;
  const amountTone = riskTone(amountFraction);

  // KPI-Hero (Header-Karte): Cash, Ausstehend, Kapazität, Ø-Zins — Ø-Zins als
  // nach Restschuld gewichteter Durchschnitt der bereits aufgenommenen
  // aktiven Kredite (keine neue Berechnung im Service nötig).
  const avgInterestRate = useMemo(() => {
    if (!team || team.activeLoans.length === 0) return null;
    const totalOutstanding = team.activeLoans.reduce((sum, loan) => sum + loan.outstanding, 0);
    if (totalOutstanding <= 0) return null;
    const weightedSum = team.activeLoans.reduce((sum, loan) => sum + loan.outstanding * loan.interestRate, 0);
    return weightedSum / totalOutstanding;
  }, [team]);
  const animatedKpiCash = useCountUp(team?.cash ?? null);
  const animatedKpiOutstanding = useCountUp(team?.outstandingDebt ?? null);
  const animatedKpiCapacity = useCountUp(team?.creditCapacityTotal ?? null);
  const animatedKpiAvgRate = useCountUp(avgInterestRate);

  return (
    <div className="nl-credits" data-testid="foundation-credits" data-new-look="true">
      <NlCard className="nl-credits-header-card" eyebrow="Kredite" title={teamName}>
        {team ? (
          <StatChipRow className="nl-credits-kpi-hero" aria-label="Kredit-Kennzahlen">
            <StatChip label="Cash" value={formatNlMoney(animatedKpiCash ?? team.cash)} tone="neutral" />
            <StatChip
              label="Ausstehend"
              value={formatNlMoney(animatedKpiOutstanding ?? team.outstandingDebt)}
              tone={riskTone(team.creditUtilizationRatio)}
            />
            <StatChip
              label="Kapazität"
              value={formatNlMoney(animatedKpiCapacity ?? team.creditCapacityTotal)}
              tone="neutral"
            />
            <StatChip
              label="Ø-Zins"
              value={avgInterestRate != null ? formatRate(animatedKpiAvgRate ?? avgInterestRate) : "—"}
              sub={team.activeLoans.length > 0 ? `${team.activeLoans.length} aktive Kredite` : "keine aktiven Kredite"}
              tone="neutral"
            />
          </StatChipRow>
        ) : null}
      </NlCard>

      {model.status === "not_ready" ? (
        <EmptyState
          className="nl-credits-empty"
          title="Kreditsystem in Vorbereitung"
          text="Das Kreditsystem wird gerade vorbereitet und in Kürze freigeschaltet."
        />
      ) : null}

      {team ? (
        <NlCard
          className="nl-credits-gauge-card"
          eyebrow="Kreditrahmen"
          title="Auslastung"
          data-testid="nl-credits-gauge-card"
        >
          <div className="nl-credits-gauge-row">
            <CreditUtilizationGauge
              outstanding={team.outstandingDebt}
              capacity={team.creditCapacityTotal}
              ratio={team.creditUtilizationRatio}
            />
            <div className="nl-credits-gauge-stats">
              <StatChip label="Cash" value={formatNlMoney(team.cash)} tone="neutral" />
              <StatChip label="Zins-Range" value={rateRange} tone="neutral" />
            </div>
          </div>
        </NlCard>
      ) : null}

      {team ? (
        <NlCard
          className="nl-credits-burden-card"
          eyebrow="Tilgung vs. Cashflow"
          title="Jährliche Belastung"
          data-testid="nl-credits-burden-card"
        >
          <LoanBurdenChart
            installment={team.annualLoanInstallment}
            salary={team.annualSalaryTotal}
            upkeep={team.annualFacilityUpkeep}
            revenue={team.estimatedAnnualRevenue}
            cash={team.cash}
          />
        </NlCard>
      ) : null}

      <div className="nl-credits-admin-toggle" data-testid="nl-credits-admin-toggle">
        <label className="nl-credits-admin-toggle-label">
          <input
            type="checkbox"
            checked={adminOverride}
            onChange={(event) => onToggleAdminOverride(event.target.checked)}
            data-testid="nl-credits-admin-toggle-input"
          />
          <span>Admin-Vorschau: Kredite trotz Season-1- &amp; Phasen-Sperre freischalten</span>
        </label>
        {adminOverride ? (
          <p className="nl-credits-admin-toggle-note">
            Admin-Modus aktiv — nur zum Testen/Ansehen. In Singleplayer-Spielständen kannst du hier
            Angebote und Abläufe unabhängig von Saison und Spielphase durchspielen.
          </p>
        ) : null}
      </div>

      {team && team.canBorrow ? (
        <>
          <LoanOfferFilterPanel
            team={team}
            amount={amount}
            amountInput={amountInput}
            termSeasons={termSeasons}
            onAmountChange={applyAmount}
            onAmountInputChange={(raw) => {
              setAmountInput(raw);
              const parsed = Number(raw);
              if (Number.isFinite(parsed)) {
                setAmount(Math.min(Math.max(0, parsed), maxAmount));
              }
            }}
            onAmountBlur={() => applyAmount(amount)}
            onTermSeasonsChange={setTermSeasons}
          />

          <NlCard className="nl-credits-offers-card" eyebrow="Angebote" title="Verfügbare Angebote">
            {offers.length > 0 ? (
              <div className="nl-credits-offer-grid" data-testid="nl-credits-offer-grid">
                {offers.map((offer, index) => (
                  <LoanOfferCard
                    key={`${offer.lenderType}:${offer.lenderTeamId ?? "bank"}`}
                    offer={offer}
                    lenderTeam={
                      offer.lenderType === "team"
                        ? (gameState.teams.find((candidate) => candidate.teamId === offer.lenderTeamId) ?? null)
                        : null
                    }
                    amount={amount}
                    termSeasons={termSeasons}
                    isBest={index === 0 && offers.length > 1}
                    amountTone={amountTone}
                    onBorrow={onBorrow}
                  />
                ))}
              </div>
            ) : (
              <NlEmptyState title="Keine Angebote verfügbar." />
            )}
          </NlCard>
        </>
      ) : team && showVaultEmptyState ? (
        <NlCard
          className="nl-credits-vault-card"
          eyebrow="Neuer Kredit"
          title="Kredit-Tresor gesperrt"
          data-testid="nl-credits-vault-card"
        >
          <div className="nl-credits-vault-wrap">
            <LockedVaultIllustration />
            <span className="nl-credits-vault-chip">Ab Season 2</span>
          </div>
        </NlCard>
      ) : team ? (
        <NlCard
          className="nl-credits-blocked-card"
          eyebrow="Neuer Kredit"
          title={isSeasonOneBlocked ? "Season 1: noch keine Kredite" : "Kreditaufnahme aktuell nicht möglich"}
        >
          <NlEmptyState
            title={
              isSeasonOneBlocked
                ? "Ab Season 2 verfügbar."
                : team.borrowBlockedReason === "not_preseason"
                  ? "Neue Kredite könnt ihr nur in der Vorbereitung (Preseason) aufnehmen."
                  : "Euer Kreditrahmen ist aktuell ausgeschöpft."
            }
          />
        </NlCard>
      ) : null}

      {showVaultEmptyState ? null : (
        <NlCard className="nl-credits-active-card" eyebrow="Kredite" title="Aktive Kredite">
          {team && team.activeLoans.length > 0 ? (
            <>
              <NlTable
                columns={NL_CREDITS_LOAN_COLUMNS}
                rows={team.activeLoans.map((loan, index) => ({ loan, index }))}
                rowKey={(row) => row.loan.id}
                renderCell={(row, column) => renderCreditsLoanCell(row, column, team.canEarlyPayoff, onEarlyPayoff)}
                data-testid="nl-credits-active-loans-table"
                aria-label="Aktive Kredite"
              />
              <p className="nl-credits-empty-text muted">
                Die Jahresrate wird am Saisonabschluss automatisch von eurem Cash abgebucht — keine manuelle Tilgung nötig.
              </p>
            </>
          ) : (
            <NlEmptyState title="Keine aktiven Kredite." />
          )}
        </NlCard>
      )}

      {/* #182: Liga-Kreditübersicht — welche Teams wie viel Kredit laufen haben. */}
      <NlCard
        className="nl-credits-league-card"
        eyebrow="Liga"
        title={`Kreditübersicht · ${leagueCreditRows.length} Team${leagueCreditRows.length === 1 ? "" : "s"} mit Kredit`}
        actions={
          leagueCreditRows.length > 0 ? (
            <span className="nl-credits-league-total nl-tnum" title="Gesamte Restschuld aller Teams">
              Σ {formatNlMoney(leagueCreditTotal)}
            </span>
          ) : undefined
        }
      >
        {leagueCreditRows.length > 0 ? (
          <div className="nl-credits-league-list" role="list" aria-label="Kredite aller Teams">
            {leagueCreditRows.map((row) => {
              const isCurrent = row.teamId === teamId;
              const barPct =
                leagueCreditMaxOutstanding > 0
                  ? Math.max(4, (row.outstanding / leagueCreditMaxOutstanding) * 100)
                  : 0;
              const classes = [
                "nl-credits-league-row",
                isCurrent ? "is-current" : "",
                row.missed > 0 ? "is-risk" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div key={row.teamId} role="listitem" className={classes}>
                  <span className="nl-credits-league-team">
                    <span className="nl-credits-league-code">{row.shortCode}</span>
                    <span className="nl-credits-league-name" title={row.teamName}>
                      {row.teamName}
                    </span>
                    {isCurrent ? <span className="nl-credits-league-you">Dein Team</span> : null}
                    {row.missed > 0 ? (
                      <span className="nl-credits-league-missed" title={`${row.missed} verpasste Rate(n)`}>
                        ⚠ {row.missed}
                      </span>
                    ) : null}
                  </span>
                  <span className="nl-credits-league-bartrack" aria-hidden="true">
                    <span className="nl-credits-league-bar" style={{ width: `${barPct}%` }} />
                  </span>
                  <span className="nl-credits-league-figures">
                    <span className="nl-credits-league-outstanding nl-tnum" title="Restschuld">
                      {formatNlMoney(row.outstanding)}
                    </span>
                    <span className="nl-credits-league-sub nl-tnum">
                      {formatNlMoney(row.installment)}/Saison · {row.count} Kredit{row.count === 1 ? "" : "e"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <NlEmptyState title="Aktuell hat kein Team einen laufenden Kredit." />
        )}
      </NlCard>
    </div>
  );
}
