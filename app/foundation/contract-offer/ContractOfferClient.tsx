"use client";

import type { ReactNode } from "react";

import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
import type { ContractShape } from "@/lib/data/olyDataTypes";

export type ContractOfferClientProps = {
  playerName: string;
  portraitUrl?: string | null;
  expectedSalary: number | null;
  offeredSalary: number | null;
  contractLength: number;
  contractShape: ContractShape;
  roleLabel?: string | null;
  assistantHint?: string | null;
  budgetAvailable?: number | null;
  acceptChance?: number | null;
  counterChance?: number | null;
  rejectChance?: number | null;
  negotiationOutcome?: { title: string; message: string; tone?: string } | null;
  busy?: boolean;
  onContractLengthChange: (value: number) => void;
  onContractShapeChange: (value: ContractShape) => void;
  onSalaryChange: (value: number | null) => void;
  onResetSuggestion: () => void;
  onSendOffer: () => void;
  onCancel: () => void;
  extraActions?: ReactNode;
};

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

export default function ContractOfferClient({
  playerName,
  expectedSalary,
  offeredSalary,
  contractLength,
  contractShape,
  roleLabel,
  assistantHint,
  budgetAvailable,
  acceptChance,
  counterChance,
  rejectChance,
  negotiationOutcome,
  busy = false,
  onContractLengthChange,
  onContractShapeChange,
  onSalaryChange,
  onResetSuggestion,
  onSendOffer,
  onCancel,
  extraActions,
}: ContractOfferClientProps) {
  const sliderMin = Math.max(0, (expectedSalary ?? 0) * 0.5);
  const sliderMax = Math.max(sliderMin + 1, (expectedSalary ?? 0) * 1.8);
  const sliderValue = offeredSalary ?? expectedSalary ?? sliderMin;

  return (
    <section className="contract-offer-shell" data-testid="contract-offer-screen">
      <header className="contract-offer-header">
        <div>
          <span className="eyebrow">Vertrag</span>
          <h2>{playerName}</h2>
          {roleLabel ? <span className="pill">{roleLabel}</span> : null}
        </div>
        {assistantHint ? (
          <aside className="contract-offer-assistant">
            <strong>Assistent</strong>
            <p>{assistantHint}</p>
          </aside>
        ) : null}
      </header>

      <div className="contract-offer-grid">
        <section className="contract-offer-panel">
          <h3>Gehalt</h3>
          <label className="filter-field">
            <span>Monatsgehalt</span>
            <input
              className="input"
              type="number"
              min={0}
              step={0.1}
              value={offeredSalary ?? ""}
              onChange={(event) => {
                const next = event.target.value === "" ? null : Number(event.target.value);
                onSalaryChange(Number.isFinite(next as number) ? next : null);
              }}
            />
          </label>
          <label className="filter-field contract-offer-slider">
            <span>Gehaltsregler</span>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={0.1}
              value={Math.min(Math.max(sliderValue, sliderMin), sliderMax)}
              onChange={(event) => onSalaryChange(Number(event.target.value))}
            />
            <small className="muted">
              Forderung {formatTransfermarktCurrency(expectedSalary)} · Angebot {formatTransfermarktCurrency(offeredSalary)}
            </small>
          </label>
        </section>

        <section className="contract-offer-panel">
          <h3>Laufzeit</h3>
          <label className="filter-field">
            <span>Vertragslänge</span>
            <select className="input" value={contractLength} onChange={(event) => onContractLengthChange(Number(event.target.value))}>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={`contract-length-${value}`} value={value}>
                  {value} Saison{value > 1 ? "en" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Vertragsform</span>
            <select className="input" value={contractShape} onChange={(event) => onContractShapeChange(event.target.value as ContractShape)}>
              <option value="balanced">Ausgeglichen</option>
              <option value="front_loaded">Vorne schwer</option>
              <option value="back_loaded">Hinten schwer</option>
            </select>
          </label>
        </section>

        <section className="contract-offer-panel">
          <h3>Chancen</h3>
          <div className="contract-offer-chances">
            <span className="is-positive">Zusage {formatPercent(acceptChance)}</span>
            <span className="is-warning">Nachverhandlung {formatPercent(counterChance)}</span>
            <span className="is-negative">Absage {formatPercent(rejectChance)}</span>
          </div>
          {budgetAvailable != null ? (
            <p className="muted">Verfügbares Budget: {formatTransfermarktCurrency(budgetAvailable)}</p>
          ) : null}
        </section>
      </div>

      {negotiationOutcome ? (
        <div className={`contract-offer-outcome is-${negotiationOutcome.tone ?? "info"}`}>
          <strong>{negotiationOutcome.title}</strong>
          <span>{negotiationOutcome.message}</span>
        </div>
      ) : null}

      <div className="contract-offer-actions">
        <button type="button" className="secondary-button" onClick={onResetSuggestion}>
          Auto-Angebot
        </button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Abbrechen
        </button>
        <button type="button" className="primary-button" disabled={busy} onClick={onSendOffer}>
          {busy ? "Sende…" : "Angebot senden"}
        </button>
        {extraActions}
      </div>
    </section>
  );
}
