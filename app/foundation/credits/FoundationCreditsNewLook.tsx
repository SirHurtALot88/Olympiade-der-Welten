"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/foundation/EmptyState";
import { NlCard, StatChip, StatChipRow, formatNlMoney } from "@/components/foundation/new-look";
import type { GameState } from "@/lib/data/olyDataTypes";
import { computeLoanTerms } from "@/lib/finance/loan-service";
import type { LoanOriginateOutcome } from "@/app/foundation/credits/FoundationCreditsHost";
import { buildLoanOffers, type LoanOffer } from "@/lib/foundation/credits/loan-offers";
import type { CreditsViewModel, TeamCreditState } from "@/lib/foundation/credits/credits-types";

export type FoundationCreditsNewLookProps = {
  teamName: string;
  model: CreditsViewModel;
  /** Needed to recompute `buildLoanOffers` live as the amount/Laufzeit filter changes. */
  gameState: GameState;
  /** Active manager's own team id — fog of war: never another team's id. */
  teamId: string | null;
  onBorrow: (principal: number, termSeasons: number, lenderTeamId?: string | null) => Promise<LoanOriginateOutcome>;
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
    case "over_capacity":
      return "Die gewünschte Summe übersteigt den Rahmen dieses Anbieters.";
    case "invalid_principal":
      return "Bitte eine gültige Kreditsumme größer als 0 eingeben.";
    case "invalid_term_seasons":
      return "Bitte eine Laufzeit zwischen 1 und 10 Saisons wählen.";
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
    case "team_lending_not_available":
      return "Team-zu-Team-Kredite sind noch nicht verfügbar.";
    case "not_available":
      return "Kreditaufnahme ist gerade nicht verfügbar.";
    case null:
    case undefined:
      return "Kredit aufgenommen.";
    default:
      return `Kredit konnte nicht aufgenommen werden (${reason}).`;
  }
}

/** One card per lender offer — cheapest interest first (see `buildLoanOffers`). */
function LoanOfferCard({
  offer,
  amount,
  termSeasons,
  onBorrow,
}: {
  offer: LoanOffer;
  amount: number;
  termSeasons: number;
  onBorrow: (principal: number, termSeasons: number, lenderTeamId?: string | null) => Promise<LoanOriginateOutcome>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const totalRepayment = offer.installmentPerSeason * termSeasons;
  const totalInterest = Math.max(0, totalRepayment - amount);
  const canSubmit = offer.eligible && amount > 0 && !busy;

  return (
    <div
      className={`nl-credits-offer-card${offer.eligible ? "" : " is-disabled"}`}
      data-testid="nl-credits-offer-card"
      data-lender-type={offer.lenderType}
    >
      <div className="nl-credits-offer-header">
        <span className="nl-credits-offer-name">{offer.lenderName}</span>
        {offer.lenderType === "team" && offer.relationship != null ? (
          <span className="nl-credits-offer-badge" title="Beziehung zum Verleiher-Team">
            Beziehung {offer.relationship > 0 ? `+${offer.relationship}` : offer.relationship}
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

      {!offer.eligible ? <p className="nl-credits-offer-note">Reicht für diese Summe nicht.</p> : null}

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
  const capacity = Math.max(0, team.creditLimit);
  const sliderStep = capacity > 0 ? Math.max(0.1, Math.round((capacity / 200) * 10) / 10) : 0.1;

  return (
    <NlCard className="nl-credits-borrow-card" eyebrow="Kredit-Filter" title="Kreditsumme & Laufzeit wählen">
      <div className="nl-credits-borrow-amount">
        <div className="nl-credits-borrow-amount-row">
          <input
            type="range"
            className="nl-credits-slider"
            min={0}
            max={capacity}
            step={sliderStep}
            value={amount}
            disabled={capacity <= 0}
            onChange={(event) => onAmountChange(Number(event.target.value))}
            aria-label="Kreditsumme (Slider)"
            data-testid="nl-credits-principal-slider"
          />
          <div className="nl-credits-amount-field">
            <input
              type="number"
              className="nl-credits-amount-input nl-tnum"
              min={0}
              max={capacity}
              step={0.1}
              value={amountInput}
              disabled={capacity <= 0}
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
          <span>Bank-Kreditrahmen: {formatNlMoney(capacity)}</span>
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
 * "Neuer Look" Kredite — Angebots-Marktplatz, wired to the real bank credit
 * system (`lib/finance/loan-service.ts`) plus the loan-offer seam
 * (`lib/foundation/credits/loan-offers.ts`), see
 * `docs/design/kredit-system.md` §"Phase 3 — Team-zu-Team-Kredite
 * (Detailkonzept)" / §"Angebots-UI".
 *
 * The amount slider + Laufzeit dropdown are a FILTER that parametrizes a
 * live offer list (one card per lender, cheapest interest first); borrowing
 * happens per-card via "Aufnehmen", not via the filter itself. Only the
 * bank renders today — team offers are a clean empty seam (`buildLoanOffers`
 * returns none yet) that will populate the same grid with zero further UI
 * work once Phase 3 lands.
 *
 * No manual repayment — settlement is automatic at season end
 * (`applyLoanSettlement`), so active loans are display-only with a note
 * that the annual rate is auto-deducted.
 */
export default function FoundationCreditsNewLook({ teamName, model, gameState, teamId, onBorrow }: FoundationCreditsNewLookProps) {
  const team = model.status === "ready" ? model.team : null;
  const capacity = Math.max(0, team?.creditLimit ?? 0);

  const [amount, setAmount] = useState<number>(() => Math.round((capacity / 2) * 10) / 10);
  const [amountInput, setAmountInput] = useState<string>(() => String(Math.round((capacity / 2) * 10) / 10));
  const [termSeasons, setTermSeasons] = useState<number>(team?.minTermSeasons ?? 1);

  // Anders als früher (die Slider-Form mountete erst, sobald `team.canBorrow`
  // feststand) mountet der Filter jetzt immer — `model` kann also nach dem
  // ersten Render noch von "not_ready" auf "ready" wechseln. Den
  // Default-Betrag (Kapazitätsmitte) daher einmalig setzen, sobald zum
  // ersten Mal eine echte Kapazität > 0 bekannt ist, statt bei 0 hängen zu
  // bleiben; danach nur noch in den (ggf. neuen) Rahmen klemmen.
  const didInitializeAmountRef = useRef(false);
  useEffect(() => {
    if (!didInitializeAmountRef.current && capacity > 0) {
      didInitializeAmountRef.current = true;
      const initial = Math.round((capacity / 2) * 10) / 10;
      setAmount(initial);
      setAmountInput(String(initial));
      return;
    }
    setAmount((current) => {
      const clamped = Math.min(Math.max(0, current), capacity);
      setAmountInput(String(clamped));
      return clamped;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity]);

  function applyAmount(next: number) {
    const clamped = Math.min(Math.max(0, next), capacity);
    setAmount(clamped);
    setAmountInput(String(clamped));
  }

  // Live offer recompute on every filter change — pure/derived, no mutation.
  // Empty until a real team is known (not_ready / fog-of-war-safe: teamId is
  // always the active manager's own id here, see FoundationCreditsHost).
  const offers = useMemo(() => {
    if (!team || !teamId) return [];
    return buildLoanOffers(gameState, teamId, { amount, termSeasons });
  }, [gameState, team, teamId, amount, termSeasons]);

  const rateRange = team
    ? formatRateRange(
        computeLoanTerms({ principal: 1, termSeasons: team.minTermSeasons, finances: team.finances }).interestRatePerSeason,
        computeLoanTerms({ principal: 1, termSeasons: team.maxTermSeasons, finances: team.finances }).interestRatePerSeason,
      )
    : "—";

  return (
    <div className="nl-credits" data-testid="foundation-credits" data-new-look="true">
      <NlCard className="nl-credits-header-card" eyebrow="Kredite" title={teamName}>
        <p className="nl-credits-header-hint">
          Kreditrahmen, laufende Kredite und Kreditangebote für {teamName}.
        </p>
      </NlCard>

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
                setAmount(Math.min(Math.max(0, parsed), capacity));
              }
            }}
            onAmountBlur={() => applyAmount(amount)}
            onTermSeasonsChange={setTermSeasons}
          />

          <NlCard className="nl-credits-offers-card" eyebrow="Angebote" title="Verfügbare Angebote">
            {offers.length > 0 ? (
              <div className="nl-credits-offer-grid" data-testid="nl-credits-offer-grid">
                {offers.map((offer) => (
                  <LoanOfferCard
                    key={`${offer.lenderType}:${offer.lenderTeamId ?? "bank"}`}
                    offer={offer}
                    amount={amount}
                    termSeasons={termSeasons}
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
        <NlCard className="nl-credits-blocked-card" eyebrow="Neuer Kredit" title="Kreditaufnahme aktuell nicht möglich">
          <p className="nl-credits-empty-text muted">
            {team.borrowBlockedReason === "not_preseason"
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
                    <th>Aufgenommen</th>
                    <th>Restschuld</th>
                    <th>Zinssatz</th>
                    <th>Restlaufzeit</th>
                    <th>Jahresrate</th>
                  </tr>
                </thead>
                <tbody>
                  {team.activeLoans.map((loan, index) => (
                    <tr key={loan.id}>
                      <td>Kredit {index + 1}</td>
                      <td className="nl-tnum">{formatNlMoney(loan.principal)}</td>
                      <td className="nl-tnum">{formatNlMoney(loan.outstanding)}</td>
                      <td className="nl-tnum">{formatRate(loan.interestRate)}</td>
                      <td className="nl-tnum">
                        {loan.remainingSeasons} / {loan.termSeasons} Saisons
                      </td>
                      <td className="nl-tnum">{formatNlMoney(loan.nextInstalment)}</td>
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
