"use client";

/**
 * Gehaltsverhandlungs-Fenster für "Verlängern" (Verträge-/Kader-Tab).
 *
 * Ersetzt den früheren Inline-Banner mit nacktem Zahlenfeld durch eine echte
 * Verhandlung: Angebot (Gehalt p.a.), Laufzeit (1–5) und Vertragsform sind
 * einstellbar, und ALLE Zahlen (Forderung, moral-adjustierte Erwartung,
 * Accept/Counter/Reject-Chancen, Gehaltstreppe, Gesamtkosten, Moral-Risiko)
 * kommen live per Dry-Run aus `/api/contracts/renewal` →
 * `previewContractRenewalAction` — exakt derselben Mathematik, die auch die
 * Season-End-Auto-Verlängerung benutzt. Es gibt bewusst KEIN paralleles
 * Client-Rechenmodell.
 *
 * Mid-Season ist das Fenster reine Vorschau: der Server phase-gated den
 * produktiven Write; der Gate-Grund wird als Blocker im Fenster angezeigt
 * (gleiches Graceful-Pattern wie der Verkaufsdialog).
 */

import { useEffect, useRef, useState } from "react";

import { formatNlMoney, formatNlNumber } from "@/components/foundation/new-look";
import type { ContractShape } from "@/lib/data/olyDataTypes";
import {
  formatContractShapeLabel,
  formatMoraleContractIntentLabel,
} from "@/lib/foundation/tabs/foundation-format-render-helpers";
import type { ContractRenewalApiResponse } from "@/lib/foundation/tabs/foundation-page-types";

type ContractRenewalSummary = NonNullable<ContractRenewalApiResponse["summary"]>;

export type ContractRenewalNegotiationSubject = {
  teamId: string;
  playerId: string;
  playerName: string;
  contractLength: number;
  offeredSalary: number | null;
  expectedSalary: number | null;
  confirmToken: string;
  contractShape?: ContractShape;
  currentSalary?: number | null;
  currentLength?: number | null;
  currentShape?: ContractShape | null;
  initialPreview?: ContractRenewalSummary | null;
};

export type ContractRenewalNegotiationDraft = {
  contractLength: number;
  offeredSalary: number | null;
  contractShape: ContractShape;
};

export type ContractRenewalNegotiationModalProps = {
  subject: ContractRenewalNegotiationSubject;
  busy: boolean;
  error: string | null;
  /** Dry-Run-Preview für angepasste Konditionen (kein Write). */
  requestPreview: (input: {
    teamId: string;
    playerId: string;
    contractLength: number;
    offeredSalary: number | null;
    contractShape?: ContractShape;
  }) => Promise<ContractRenewalApiResponse | null>;
  onConfirm: (draft: ContractRenewalNegotiationDraft) => void | Promise<void>;
  onClose: () => void;
};

const CONTRACT_SHAPES: ContractShape[] = ["balanced", "front_loaded", "back_loaded"];
const CONTRACT_LENGTHS = [1, 2, 3, 4, 5];
const PREVIEW_DEBOUNCE_MS = 350;

/** Bekannte Server-Codes → verständliches Deutsch (unbekannte Codes bleiben roh sichtbar). */
function translateRenewalReason(reason: string): string {
  if (reason.startsWith("phase_blocked:renew_contract")) {
    return "Gehaltsverhandlung öffnet am Season-End (nach MD10) — bis dahin nur Vorschau.";
  }
  if (reason === "renewal_only_allowed_at_lz_0") {
    return "Verlängert wird erst, wenn der Vertrag ausläuft (LZ 0 am Season-End) — bis dahin nur Vorschau.";
  }
  if (reason === "morale_refuses_extension") {
    return "Der Spieler lehnt eine Verlängerung aktuell ab (Moral).";
  }
  if (reason === "morale_contract_length_limited") {
    return "Die Moral begrenzt die Vertragslänge — wähle eine kürzere Laufzeit.";
  }
  if (reason === "morale_refuses_extension_risk") {
    return "Moral-Risiko: Der Spieler denkt über einen Abschied nach.";
  }
  if (reason === "morale_exit_risk") {
    return "Moral-Risiko: Wechselgedanken — Verlängerung unsicher.";
  }
  if (reason === "morale_limits_contract_length") {
    return "Moral begrenzt die maximale Laufzeit.";
  }
  if (reason === "offer_below_expected_salary") {
    return "Angebot liegt unter dem Erwartungsgehalt.";
  }
  if (reason === "confirm_required_before_contract_write") {
    return "Erst nach Bestätigung wird der Vertrag wirklich geschrieben.";
  }
  if (reason === "salary_expectation_high") {
    return "Die Gehaltsforderung liegt deutlich über dem aktuellen Gehalt.";
  }
  if (reason === "player_returns_to_free_agent_pool") {
    return "Ohne Verlängerung geht der Spieler in den Free-Agent-Pool.";
  }
  if (reason === "offer_salary_missing") {
    return "Bitte ein Angebotsgehalt eintragen.";
  }
  return reason;
}

/** Server-Chancen/-Risiken sind bereits 0..100 (normalizeChances / moraleRenewalRisk). */
function formatPercentValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${formatNlNumber(value, 0)}%`;
}

function toPercentWidth(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

export default function ContractRenewalNegotiationModal({
  subject,
  busy,
  error,
  requestPreview,
  onConfirm,
  onClose,
}: ContractRenewalNegotiationModalProps) {
  const [draftSalary, setDraftSalary] = useState<number | null>(subject.offeredSalary);
  const [draftLength, setDraftLength] = useState<number>(subject.contractLength);
  const [draftShape, setDraftShape] = useState<ContractShape>(subject.contractShape ?? "balanced");
  const [summary, setSummary] = useState<ContractRenewalSummary | null>(subject.initialPreview ?? null);
  const [previewBusy, setPreviewBusy] = useState<boolean>(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);
  const skipInitialRef = useRef(true);

  // Live-Refresh: jede Anpassung (Gehalt/Laufzeit/Form) holt eine frische
  // Server-Preview (debounced). Der Sequenz-Zähler verwirft überholte
  // Antworten, damit nie eine alte Preview eine neue überschreibt.
  useEffect(() => {
    if (skipInitialRef.current) {
      // Die Öffnen-Preview (initialPreview) deckt den Startzustand bereits ab —
      // aber nur, wenn das Start-Angebot dem Preview-Angebot entspricht. Das
      // Öffnen previews OHNE offeredSalary (keine Chancen) → einmal refreshen.
      skipInitialRef.current = false;
      if (subject.initialPreview?.negotiationPreview?.offeredSalary != null || draftSalary == null) {
        return;
      }
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    setPreviewBusy(true);
    debounceRef.current = setTimeout(() => {
      void requestPreview({
        teamId: subject.teamId,
        playerId: subject.playerId,
        contractLength: draftLength,
        offeredSalary: draftSalary,
        contractShape: draftShape,
      }).then((payload) => {
        if (requestSeqRef.current !== seq) {
          return;
        }
        if (payload?.summary) {
          setSummary(payload.summary);
        }
        setPreviewBusy(false);
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSalary, draftLength, draftShape]);

  const negotiation = summary?.negotiationPreview ?? null;
  const morale = summary?.morale ?? null;
  const expectedSalary = negotiation?.expectedSalary ?? subject.expectedSalary;
  const moraleExpectedSalary = summary?.moraleAdjustedExpectedSalary ?? null;
  const schedule = negotiation?.yearlySalarySchedule ?? [];
  const totalSalary = negotiation?.totalSalary ?? null;
  const blockingReasons = summary?.blockingReasons ?? [];
  const warnings = (summary?.warnings ?? []).filter(
    (warning) => warning !== "preview_only_contract_negotiation" && warning !== "confirm_required_before_contract_write",
  );
  const lengthLimit = morale?.contractLengthLimit ?? null;
  const offerRatio = negotiation?.offerRatio ?? null;
  const acceptChance = negotiation?.acceptChance ?? null;
  const counterChance = negotiation?.counterChance ?? null;
  const rejectChance = negotiation?.rejectChance ?? null;
  const scheduleMax = schedule.reduce((max, row) => Math.max(max, row.salary), 0);

  const confirmBlocked = summary != null && !summary.ok;
  const confirmDisabled = busy || previewBusy || draftSalary == null || confirmBlocked;
  const confirmDisabledReason = !confirmDisabled
    ? null
    : busy
      ? "Die Verlängerung wird gerade ausgeführt."
      : previewBusy
        ? "Die Verhandlungsvorschau wird aktualisiert."
        : draftSalary == null
          ? "Bitte ein Angebotsgehalt eintragen."
          : blockingReasons.length > 0
            ? translateRenewalReason(blockingReasons[0])
            : "Diese Verlängerung ist gerade blockiert.";

  const offerTone =
    offerRatio == null ? "" : offerRatio >= 1 ? " is-good" : offerRatio >= 0.9 ? " is-warn" : " is-risk";

  return (
    <div className="foundation-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="foundation-modal nl-negotiation-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Gehaltsverhandlung ${subject.playerName}`}
        data-testid="contract-renewal-negotiation"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="nl-negotiation-header">
          <div>
            <span className="nl-negotiation-eyebrow">Gehaltsverhandlung</span>
            <h2 className="nl-negotiation-title">{subject.playerName}</h2>
            <p className="nl-negotiation-sub">
              Aktueller Vertrag: {formatNlMoney(subject.currentSalary ?? null)} p.a. · LZ{" "}
              {subject.currentLength != null ? formatNlNumber(subject.currentLength, 0) : "—"} ·{" "}
              {formatContractShapeLabel(subject.currentShape ?? "balanced")}
            </p>
          </div>
          <button className="secondary-button inline-button" type="button" onClick={onClose}>
            Schließen
          </button>
        </header>

        {error ? (
          <div className="transfer-feedback-banner is-error">
            <strong>Verlängerung blockiert</strong>
            <span>{translateRenewalReason(error)}</span>
          </div>
        ) : null}

        <div className="nl-negotiation-grid">
          <section className="nl-negotiation-panel" aria-label="Angebot">
            <h3 className="nl-negotiation-panel-title">Dein Angebot</h3>
            <label className="nl-negotiation-field">
              <span>Gehalt p.a. (Mio)</span>
              <div className="nl-negotiation-salary-row">
                <input
                  className="nl-negotiation-salary-input"
                  type="number"
                  min={0}
                  step={0.1}
                  value={draftSalary ?? ""}
                  data-testid="negotiation-salary-input"
                  onChange={(event) =>
                    setDraftSalary(event.target.value === "" ? null : Number(event.target.value))
                  }
                />
                <button
                  className="nl-teams-action"
                  type="button"
                  disabled={expectedSalary == null}
                  title="Setzt das Angebot auf die (moral-adjustierte) Forderung des Spielers."
                  onClick={() => setDraftSalary(moraleExpectedSalary ?? expectedSalary)}
                >
                  Forderung übernehmen
                </button>
              </div>
            </label>
            <div className="nl-negotiation-field">
              <span>Laufzeit (Seasons)</span>
              <div className="nl-negotiation-choice-row" role="group" aria-label="Laufzeit wählen">
                {CONTRACT_LENGTHS.map((length) => {
                  const overLimit = lengthLimit != null && length > lengthLimit;
                  return (
                    <button
                      key={length}
                      type="button"
                      className={`nl-negotiation-choice${draftLength === length ? " is-active" : ""}${overLimit ? " is-limited" : ""}`}
                      title={
                        overLimit
                          ? `Moral begrenzt die Laufzeit auf ${formatNlNumber(lengthLimit, 0)} Seasons.`
                          : negotiation?.contractPreference?.idealLength === length
                            ? "Wunschlaufzeit des Spielers."
                            : undefined
                      }
                      onClick={() => setDraftLength(length)}
                    >
                      {formatNlNumber(length, 0)}
                      {negotiation?.contractPreference?.idealLength === length ? <small>★</small> : null}
                    </button>
                  );
                })}
              </div>
              {lengthLimit != null ? (
                <small className="nl-negotiation-hint is-risk">
                  Moral-Limit: max. {formatNlNumber(lengthLimit, 0)} Seasons Laufzeit.
                </small>
              ) : null}
            </div>
            <div className="nl-negotiation-field">
              <span>Vertragsform</span>
              <div className="nl-negotiation-choice-row" role="group" aria-label="Vertragsform wählen">
                {CONTRACT_SHAPES.map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    className={`nl-negotiation-choice${draftShape === shape ? " is-active" : ""}`}
                    title={
                      negotiation?.contractPreference?.shapePreference === shape
                        ? "Bevorzugte Vertragsform des Spielers."
                        : undefined
                    }
                    onClick={() => setDraftShape(shape)}
                  >
                    {formatContractShapeLabel(shape)}
                    {negotiation?.contractPreference?.shapePreference === shape ? <small>★</small> : null}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="nl-negotiation-panel" aria-label="Reaktion des Spielers">
            <h3 className="nl-negotiation-panel-title">
              Reaktion des Spielers
              {previewBusy ? <span className="nl-negotiation-busy"> · aktualisiert…</span> : null}
            </h3>
            <dl className="nl-negotiation-facts">
              <div>
                <dt>Forderung</dt>
                <dd>{formatNlMoney(expectedSalary)}</dd>
              </div>
              {moraleExpectedSalary != null && moraleExpectedSalary !== expectedSalary ? (
                <div>
                  <dt>Nach Moral</dt>
                  <dd>{formatNlMoney(moraleExpectedSalary)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Dein Angebot</dt>
                <dd className={`nl-negotiation-offer${offerTone}`}>
                  {formatNlMoney(draftSalary)}
                  {offerRatio != null ? (
                    <small> ({formatNlNumber(offerRatio * 100, 0)}% der Forderung)</small>
                  ) : null}
                </dd>
              </div>
              {morale ? (
                <>
                  <div>
                    <dt>Moral</dt>
                    <dd>
                      {morale.smiley} {formatNlNumber(morale.morale, 0)} ·{" "}
                      {formatMoraleContractIntentLabel(morale.contractIntent)}
                    </dd>
                  </div>
                  <div>
                    <dt>Renewal-Risiko</dt>
                    <dd>{formatPercentValue(morale.renewalRisk)}</dd>
                  </div>
                </>
              ) : null}
            </dl>
            {acceptChance != null || counterChance != null || rejectChance != null ? (
              <div className="nl-negotiation-chances" aria-label="Verhandlungschancen">
                <div className="nl-negotiation-chance-bar" role="img" aria-label={`Annahme ${formatPercentValue(acceptChance)}, Gegenangebot ${formatPercentValue(counterChance)}, Ablehnung ${formatPercentValue(rejectChance)}`}>
                  <span className="is-accept" style={{ width: `${toPercentWidth(acceptChance)}%` }} />
                  <span className="is-counter" style={{ width: `${toPercentWidth(counterChance)}%` }} />
                  <span className="is-reject" style={{ width: `${toPercentWidth(rejectChance)}%` }} />
                </div>
                <div className="nl-negotiation-chance-legend">
                  <span className="is-accept">Annahme {formatPercentValue(acceptChance)}</span>
                  <span className="is-counter">Gegenangebot {formatPercentValue(counterChance)}</span>
                  <span className="is-reject">Ablehnung {formatPercentValue(rejectChance)}</span>
                </div>
              </div>
            ) : (
              <p className="nl-negotiation-hint">
                Trage ein Angebotsgehalt ein, um die Annahme-Chancen zu sehen.
              </p>
            )}
          </section>

          <section className="nl-negotiation-panel" aria-label="Kosten">
            <h3 className="nl-negotiation-panel-title">Gehaltstreppe & Kosten</h3>
            {schedule.length > 0 ? (
              <ul className="nl-negotiation-schedule">
                {schedule.map((row) => (
                  <li key={row.label}>
                    <span className="nl-negotiation-schedule-label">{row.label}</span>
                    <span
                      className="nl-negotiation-schedule-bar"
                      style={{ width: `${scheduleMax > 0 ? Math.max(8, (row.salary / scheduleMax) * 100) : 0}%` }}
                    />
                    <span className="nl-negotiation-schedule-value">{formatNlMoney(row.salary)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nl-negotiation-hint">Noch keine Gehaltstreppe — Angebot eintragen.</p>
            )}
            <dl className="nl-negotiation-facts">
              <div>
                <dt>Gesamtkosten</dt>
                <dd>
                  <strong>{formatNlMoney(totalSalary)}</strong>
                  {totalSalary != null ? (
                    <small> über {formatNlNumber(draftLength, 0)} Season{draftLength === 1 ? "" : "s"}</small>
                  ) : null}
                </dd>
              </div>
              {subject.currentSalary != null && draftSalary != null ? (
                <div>
                  <dt>Δ p.a. vs. jetzt</dt>
                  <dd className={draftSalary - subject.currentSalary > 0 ? "nl-negotiation-offer is-risk" : "nl-negotiation-offer is-good"}>
                    {`${draftSalary - subject.currentSalary > 0 ? "+" : ""}${formatNlMoney(draftSalary - subject.currentSalary)}`}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        </div>

        {blockingReasons.length > 0 || warnings.length > 0 ? (
          <div className="nl-negotiation-notes">
            {blockingReasons.length > 0 ? (
              <div className="nl-negotiation-note is-blocked">
                <strong>Blockiert</strong>
                <ul>
                  {blockingReasons.map((reason) => (
                    <li key={reason}>{translateRenewalReason(reason)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {warnings.length > 0 ? (
              <div className="nl-negotiation-note is-warning">
                <strong>Hinweise</strong>
                <ul>
                  {warnings.map((warning) => (
                    <li key={warning}>{translateRenewalReason(warning)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <footer className="nl-negotiation-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button
            className="primary-button"
            type="button"
            data-testid="negotiation-confirm-button"
            disabled={confirmDisabled}
            title={confirmDisabledReason ?? "Vertrag zu diesen Konditionen bestätigen."}
            onClick={() =>
              void onConfirm({
                contractLength: draftLength,
                offeredSalary: draftSalary,
                contractShape: draftShape,
              })
            }
          >
            {busy ? "Wird verlängert…" : "Vertrag bestätigen"}
          </button>
        </footer>
        {confirmDisabledReason && !busy && !previewBusy ? (
          <p className="nl-negotiation-blocked-reason" data-testid="negotiation-disabled-reason">
            Warum nicht: {confirmDisabledReason}
          </p>
        ) : null}
      </div>
    </div>
  );
}
