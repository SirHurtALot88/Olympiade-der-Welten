"use client";

import { EmptyState } from "@/components/foundation/EmptyState";
import { NlCard, StatChip, StatChipRow, formatNlMoney } from "@/components/foundation/new-look";
import type { CreditsViewModel } from "@/lib/foundation/credits/credits-types";

export type FoundationCreditsNewLookProps = {
  teamName: string;
  model: CreditsViewModel;
  onTakeLoan: (offerId: string) => void;
  onRepayLoan: (loanId: string) => void;
};

function formatRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) {
    return "—";
  }
  return `${(rate * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })}%`;
}

/**
 * "Neuer Look" Kredite — UI scaffold for the (parallel-built) credit system.
 *
 * Renders unconditionally from `model` (a `CreditsViewModel`): while the
 * real credit system isn't connected yet, `model.status` is always
 * `"not_ready"` and this component shows a tasteful placeholder while still
 * proving out the full shell layout (KPI row, active-loan table, offer
 * cards). Once the seam (`buildCreditsViewModel` in
 * `lib/foundation/credits/use-credits-view-model.ts`) starts returning
 * `{ status: "ready", team }`, this same component renders the real data —
 * no changes needed here.
 */
export default function FoundationCreditsNewLook({ teamName, model, onTakeLoan, onRepayLoan }: FoundationCreditsNewLookProps) {
  const team = model.status === "ready" ? model.team : null;

  return (
    <div className="nl-credits" data-testid="foundation-credits" data-new-look="true">
      <NlCard className="nl-credits-header-card" eyebrow="Kredite" title={teamName}>
        <p className="nl-credits-header-hint">
          Kreditrahmen, laufende Kredite und Angebote für {teamName}.
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
        <StatChip label="Zinssatz" value={team ? formatRate(team.interestRate) : "—"} tone="neutral" />
        <StatChip
          label="Nächste Rate"
          value={team && team.nextInstalment != null ? formatNlMoney(team.nextInstalment) : "—"}
          tone="neutral"
        />
      </StatChipRow>

      <NlCard className="nl-credits-active-card" eyebrow="Kredite" title="Aktive Kredite">
        {team && team.activeLoans.length > 0 ? (
          <div className="nl-credits-table-shell">
            <table className="nl-credits-table" data-testid="nl-credits-active-loans-table">
              <thead>
                <tr>
                  <th>Kredit</th>
                  <th>Aufgenommen</th>
                  <th>Offen</th>
                  <th>Zinssatz</th>
                  <th>Restlaufzeit</th>
                  <th>Nächste Rate</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {team.activeLoans.map((loan) => (
                  <tr key={loan.id}>
                    <td>{loan.id}</td>
                    <td className="nl-tnum">{formatNlMoney(loan.principal)}</td>
                    <td className="nl-tnum">{formatNlMoney(loan.outstanding)}</td>
                    <td className="nl-tnum">{formatRate(loan.interestRate)}</td>
                    <td className="nl-tnum">{loan.remainingMatchdays} Spieltage</td>
                    <td className="nl-tnum">{formatNlMoney(loan.nextInstalment)}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button inline-button nl-credits-repay-loan"
                        onClick={() => onRepayLoan(loan.id)}
                      >
                        Tilgen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="nl-credits-empty-text muted">Keine aktiven Kredite.</p>
        )}
      </NlCard>

      <NlCard className="nl-credits-offers-card" eyebrow="Angebote" title="Verfügbare Angebote">
        {team && team.offers.length > 0 ? (
          <div className="nl-credits-offer-grid">
            {team.offers.map((offer) => (
              <article key={offer.id} className="nl-credits-offer-card">
                <strong>{offer.label}</strong>
                <span className="nl-credits-offer-range nl-tnum">
                  {formatNlMoney(offer.principalMin)} – {formatNlMoney(offer.principalMax)}
                </span>
                <span className="nl-credits-offer-terms">
                  {formatRate(offer.interestRate)} Zins · {offer.termMatchdays} Spieltage Laufzeit
                </span>
                <button
                  type="button"
                  className="primary-button inline-button nl-credits-take-loan"
                  onClick={() => onTakeLoan(offer.id)}
                >
                  Aufnehmen
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="nl-credits-empty-text muted">Aktuell keine Angebote verfügbar.</p>
        )}
      </NlCard>
    </div>
  );
}
