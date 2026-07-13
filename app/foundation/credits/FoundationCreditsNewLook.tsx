"use client";

import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/foundation/EmptyState";
import { NlCard, StatChip, StatChipRow, formatNlMoney } from "@/components/foundation/new-look";
import { computeLoanTerms } from "@/lib/finance/loan-service";
import type { LoanOriginateOutcome } from "@/app/foundation/credits/FoundationCreditsHost";
import type { CreditsViewModel, LoanQuote, TeamCreditState } from "@/lib/foundation/credits/credits-types";

export type FoundationCreditsNewLookProps = {
  teamName: string;
  model: CreditsViewModel;
  onBorrow: (principal: number, termSeasons: number) => Promise<LoanOriginateOutcome>;
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
      return "Die gewünschte Summe übersteigt euren aktuellen Kreditrahmen.";
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
    case "not_available":
      return "Kreditaufnahme ist gerade nicht verfügbar.";
    case null:
    case undefined:
      return "Kredit aufgenommen.";
    default:
      return `Kredit konnte nicht aufgenommen werden (${reason}).`;
  }
}

function BorrowCard({
  team,
  onBorrow,
}: {
  team: TeamCreditState;
  onBorrow: (principal: number, termSeasons: number) => Promise<LoanOriginateOutcome>;
}) {
  const capacity = Math.max(0, team.creditLimit);
  const [principal, setPrincipal] = useState<number>(() => Math.round((capacity / 2) * 10) / 10);
  const [principalInput, setPrincipalInput] = useState<string>(() => String(Math.round((capacity / 2) * 10) / 10));
  const [termSeasons, setTermSeasons] = useState<number>(team.minTermSeasons);
  const [borrowBusy, setBorrowBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  // Kapazität kann sich nach einer erfolgreichen Aufnahme (oder Team-Wechsel)
  // ändern — den gewählten Betrag dann in den neuen Rahmen klemmen statt
  // einen jetzt ungültigen Wert stehen zu lassen.
  useEffect(() => {
    setPrincipal((current) => {
      const clamped = Math.min(Math.max(0, current), capacity);
      setPrincipalInput(String(clamped));
      return clamped;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity]);

  const quote: LoanQuote = useMemo(() => {
    const terms = computeLoanTerms({ principal, termSeasons, finances: team.finances });
    const totalRepayment = terms.installmentPerSeason * termSeasons;
    return {
      interestRatePerSeason: terms.interestRatePerSeason,
      installmentPerSeason: terms.installmentPerSeason,
      totalRepayment,
      totalInterest: Math.max(0, totalRepayment - principal),
    };
  }, [principal, termSeasons, team.finances]);

  const sliderStep = capacity > 0 ? Math.max(0.1, Math.round((capacity / 200) * 10) / 10) : 0.1;

  function applyPrincipal(next: number) {
    const clamped = Math.min(Math.max(0, next), capacity);
    setPrincipal(clamped);
    setPrincipalInput(String(clamped));
  }

  const canSubmit = !borrowBusy && principal > 0 && principal <= capacity;

  return (
    <NlCard className="nl-credits-borrow-card" eyebrow="Neuer Kredit" title="Kreditsumme & Laufzeit wählen">
      <div className="nl-credits-borrow-amount">
        <div className="nl-credits-borrow-amount-row">
          <input
            type="range"
            className="nl-credits-slider"
            min={0}
            max={capacity}
            step={sliderStep}
            value={principal}
            disabled={capacity <= 0 || borrowBusy}
            onChange={(event) => applyPrincipal(Number(event.target.value))}
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
              value={principalInput}
              disabled={capacity <= 0 || borrowBusy}
              onChange={(event) => {
                const raw = event.target.value;
                setPrincipalInput(raw);
                const parsed = Number(raw);
                if (Number.isFinite(parsed)) {
                  setPrincipal(Math.min(Math.max(0, parsed), capacity));
                }
              }}
              onBlur={() => applyPrincipal(principal)}
              aria-label="Kreditsumme (genauer Betrag, Mio.)"
              data-testid="nl-credits-principal-input"
            />
            <span className="nl-credits-amount-unit">Mio.</span>
          </div>
        </div>
        <div className="nl-credits-amount-range">
          <span>0</span>
          <span>Kreditrahmen: {formatNlMoney(capacity)}</span>
        </div>
      </div>

      <label className="nl-credits-term-field">
        <span className="nl-credits-term-label">Laufzeit</span>
        <select
          className="nl-credits-term-select"
          value={termSeasons}
          disabled={borrowBusy}
          onChange={(event) => setTermSeasons(Number(event.target.value))}
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

      <div className="nl-credits-quote-panel" data-testid="nl-credits-quote">
        <div className="nl-credits-quote-row">
          <span className="nl-credits-quote-label">Zinssatz p. a.</span>
          <span className="nl-credits-quote-value nl-tnum">{formatRate(quote.interestRatePerSeason)}</span>
        </div>
        <div className="nl-credits-quote-row">
          <span className="nl-credits-quote-label">Jahresrate</span>
          <span className="nl-credits-quote-value nl-tnum">{formatNlMoney(quote.installmentPerSeason)}</span>
        </div>
        <div className="nl-credits-quote-row">
          <span className="nl-credits-quote-label">Gesamtrückzahlung</span>
          <span className="nl-credits-quote-value nl-tnum">{formatNlMoney(quote.totalRepayment)}</span>
        </div>
        <div className="nl-credits-quote-row">
          <span className="nl-credits-quote-label">Gesamtzinsen</span>
          <span className="nl-credits-quote-value nl-tnum">{formatNlMoney(quote.totalInterest)}</span>
        </div>
      </div>

      <button
        type="button"
        className="primary-button nl-credits-borrow-button"
        disabled={!canSubmit}
        onClick={() => {
          setLocalMessage(null);
          setBorrowBusy(true);
          void onBorrow(principal, termSeasons)
            .then((outcome) => {
              setLocalMessage(describeBorrowReason(outcome.reason));
            })
            .finally(() => setBorrowBusy(false));
        }}
        data-testid="nl-credits-borrow-submit"
      >
        {borrowBusy ? "Wird aufgenommen…" : "Kredit aufnehmen"}
      </button>

      {localMessage ? (
        <p className="nl-credits-borrow-message" role="status">
          {localMessage}
        </p>
      ) : null}
    </NlCard>
  );
}

/**
 * "Neuer Look" Kredite — wired to the real bank credit system
 * (`lib/finance/loan-service.ts`, see `docs/design/kredit-system.md`).
 *
 * Borrowing (slider + exact amount + Laufzeit + live quote) only renders
 * when `team.canBorrow` (preseason + free capacity). No manual repayment —
 * settlement is automatic at season end (`applyLoanSettlement`), so active
 * loans are display-only with a note that the annual rate is auto-deducted.
 */
export default function FoundationCreditsNewLook({ teamName, model, onBorrow }: FoundationCreditsNewLookProps) {
  const team = model.status === "ready" ? model.team : null;

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
          Kreditrahmen, laufende Kredite und Kreditaufnahme für {teamName}.
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
        <BorrowCard team={team} onBorrow={onBorrow} />
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
