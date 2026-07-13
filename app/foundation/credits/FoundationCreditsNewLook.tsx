"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import { EmptyState } from "@/components/foundation/EmptyState";
import { NlCard, StatChip, StatChipRow, formatNlMoney } from "@/components/foundation/new-look";
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
  onBorrow,
}: {
  offer: LoanOffer;
  /** Nur bei `offer.lenderType === "team"` gesetzt — für Logo/Initialen, siehe `getTeamLogoModel`. */
  lenderTeam: Team | null;
  amount: number;
  termSeasons: number;
  /** Erstes (günstigstes) Angebot, nur wenn mehr als eines existiert. */
  isBest: boolean;
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

      <div className="nl-credits-offer-rate nl-tnum">{formatRate(offer.interestRatePerSeason)}</div>

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
          />
          <div className="nl-credits-amount-field">
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
            />
            <span className="nl-credits-amount-unit">Mio.</span>
          </div>
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
      ignoreRevenueCap: adminOverride,
    });
  }, [gameState, team, teamId, amount, termSeasons, adminOverride]);

  const isSeasonOneBlocked = team?.borrowBlockedReason === "season_one";

  const rateRange = team
    ? formatRateRange(
        computeLoanTerms({ principal: 1, termSeasons: team.minTermSeasons, finances: team.finances }).interestRatePerSeason,
        computeLoanTerms({ principal: 1, termSeasons: team.maxTermSeasons, finances: team.finances }).interestRatePerSeason,
      )
    : "—";

  return (
    <div className="nl-credits" data-testid="foundation-credits" data-new-look="true">
      <NlCard className="nl-credits-header-card" eyebrow="Kredite" title={teamName} />

      {model.status === "not_ready" ? (
        <EmptyState
          className="nl-credits-empty"
          title="Kreditsystem in Vorbereitung"
          text="Das Kreditsystem wird gerade vorbereitet und in Kürze freigeschaltet."
        />
      ) : null}

      <StatChipRow className="nl-credits-kpi-row" aria-label="Kredit-Kennzahlen">
        <StatChip label="Kreditrahmen" value={team ? formatNlMoney(team.creditLimit) : "—"} tone="neutral" />
        <StatChip label="Schulden" value={team ? formatNlMoney(team.outstandingDebt) : "—"} tone="neutral" />
        <StatChip label="Cash" value={team ? formatNlMoney(team.cash) : "—"} tone="neutral" />
        <StatChip label="Zins-Range" value={rateRange} tone="neutral" />
      </StatChipRow>

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
                    onBorrow={onBorrow}
                  />
                ))}
              </div>
            ) : (
              <p className="nl-credits-empty-text muted">Keine Angebote verfügbar.</p>
            )}
          </NlCard>
        </>
      ) : team ? (
        <NlCard
          className="nl-credits-blocked-card"
          eyebrow="Neuer Kredit"
          title={isSeasonOneBlocked ? "Season 1: noch keine Kredite" : "Kreditaufnahme aktuell nicht möglich"}
        >
          <p className="nl-credits-empty-text muted">
            {isSeasonOneBlocked
              ? "Ab Season 2 verfügbar."
              : team.borrowBlockedReason === "not_preseason"
                ? "Neue Kredite könnt ihr nur in der Vorbereitung (Preseason) aufnehmen."
                : "Euer Kreditrahmen ist aktuell ausgeschöpft."}
          </p>
        </NlCard>
      ) : null}

      <NlCard className="nl-credits-active-card" eyebrow="Kredite" title="Aktive Kredite">
        {team && team.activeLoans.length > 0 ? (
          <>
            <div className="nl-credits-table-shell">
              <table className="nl-credits-table" data-testid="nl-credits-active-loans-table">
                <thead>
                  <tr>
                    <th>Kredit</th>
                    <th>Verleiher</th>
                    <th>Aufgenommen</th>
                    <th>Restschuld</th>
                    <th>Zinssatz</th>
                    <th>Restlaufzeit</th>
                    <th>Jahresrate</th>
                    <th>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {team.activeLoans.map((loan, index) => (
                    <tr key={loan.id}>
                      <td>Kredit {index + 1}</td>
                      <td>{loan.lenderName}</td>
                      <td className="nl-tnum">{formatNlMoney(loan.principal)}</td>
                      <td className="nl-tnum">{formatNlMoney(loan.outstanding)}</td>
                      <td className="nl-tnum">{formatRate(loan.interestRate)}</td>
                      <td className="nl-tnum">
                        {loan.remainingSeasons} / {loan.termSeasons} Saisons
                      </td>
                      <td className="nl-tnum">{formatNlMoney(loan.nextInstalment)}</td>
                      <td>
                        <LoanEarlyPayoffAction
                          loan={loan}
                          canEarlyPayoff={team.canEarlyPayoff}
                          onEarlyPayoff={onEarlyPayoff}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="nl-credits-empty-text muted">
              Die Jahresrate wird am Saisonabschluss automatisch von eurem Cash abgebucht — keine manuelle Tilgung nötig.
            </p>
          </>
        ) : (
          <p className="nl-credits-empty-text muted">Keine aktiven Kredite.</p>
        )}
      </NlCard>
    </div>
  );
}
