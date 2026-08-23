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
  /**
   * Der Token der Vorschau, die im Fenster STEHT — nicht der vom Oeffnen.
   *
   * Das Fenster holt bei jeder Aenderung eine frische Vorschau; ihr Token gehoert damit genau zu
   * den Zahlen, die der Nutzer gesehen hat. Ihn mitzugeben erspart dem Schreibweg eine eigene
   * Dry-Run-Runde — am Live-Abbild gemessen eine volle Spielstand-Ladung von 1965 ms.
   */
  confirmToken: string | null;
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
  // Der Code hiess bis zum gemeldeten Fehler `renewal_only_allowed_at_lz_0` und der Satz sprach von
  // „LZ 0". Beides war falsch: entschieden wird in der LETZTEN Vertragssaison (LZ 1), auf 0 faellt
  // der Vertrag erst durch die Alterung im Saisonuebergang — da ist das Fenster schon zu. Der alte
  // Code bleibt uebersetzt, damit eine Antwort von einem noch nicht neu gebauten Server nicht roh
  // durchschlaegt.
  if (reason === "renewal_only_allowed_at_contract_end" || reason === "renewal_only_allowed_at_lz_0") {
    return "Verlängert wird in der letzten Vertragssaison — dieser Vertrag läuft noch länger.";
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
  if (reason === "market_bracket_factor_preview_pending") {
    return "Marktwert-Einstufung wird noch berechnet — die Chancen können sich leicht verschieben.";
  }
  if (reason === "low_team_fit_reduces_acceptance") {
    return "Passt schlecht ins Team — das drückt die Zusage-Bereitschaft.";
  }
  if (reason === "ego_lowball") {
    return "Der Spieler fühlt sich vom niedrigen Angebot brüskiert.";
  }
  if (reason === "mercenary_lowball") {
    return "Geld-orientierter Typ — reagiert empfindlich auf ein zu niedriges Angebot.";
  }
  if (reason === "board_confidence_risk") {
    return "Die Vereinsführung sieht die Verlängerung kritisch.";
  }
  if (reason === "team_harmony_risk") {
    return "Risiko fürs Team-Gefüge — die Verlängerung könnte die Harmonie stören.";
  }
  if (reason === "trait_culture_risk") {
    return "Charakter passt nicht ganz zur Team-Kultur.";
  }
  if (reason === "market_value_missing" || reason === "salary_source_missing" || reason === "salary_demand_missing") {
    return "Bewertungsdaten unvollständig — Angaben können ungenau sein.";
  }
  if (reason === "player_attribute_missing") {
    return "Spielerdaten sind unvollständig.";
  }
  // Generische, spieltauglich formulierte Fallbacks für dynamisch
  // zusammengesetzte Tokens (z. B. "<prio>_player_demand_failed").
  if (reason.endsWith("_demand_failed") || reason.endsWith("_demand_pressure")) {
    return "Der Spieler hat eine offene Forderung, die noch nicht erfüllt ist.";
  }
  if (reason.endsWith("_lowball")) {
    return "Das Angebot liegt spürbar unter der Erwartung des Spielers.";
  }
  if (reason.endsWith("_risk")) {
    return "Achtung: erhöhtes Risiko bei dieser Verlängerung.";
  }
  if (reason.endsWith("_missing") || reason.endsWith("_pending")) {
    return "Einige Werte werden noch berechnet — Angaben können sich ändern.";
  }
  // Letzter Fallback: nie rohes snake_case zeigen — in lesbaren Satz wandeln.
  const humanized = reason.replace(/_/g, " ").trim();
  return humanized.length > 0 ? humanized.charAt(0).toUpperCase() + humanized.slice(1) : reason;
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

/**
 * DAS ERGEBNIS EINER VERHANDLUNGSRUNDE.
 *
 * GEMELDET VON CHRIS: „und wieso gibts beim verlängern kein angebot senden knopf? der spieler
 * muss wie beim kauf ja auch verhandeln können."
 *
 * Er hatte recht, und der Befund war unangenehm: die Verlaengerung laeuft laengst durch DIESELBE
 * Engine wie der Kauf (`buildContractNegotiationPreview`). Verdikt und Gegenangebots-Betrag werden
 * berechnet und mitgeliefert — dieses Fenster zeigte davon nur die drei Prozentbalken und liess
 * „Vertrag bestaetigen" danach durchlaufen, egal was das Verdikt sagte. Die Chancen waren Deko.
 *
 * Der Ablauf ist deshalb derselbe wie beim Kauf: erst senden, dann unterschreiben.
 *
 * `fuerAngebot` haelt fest, ZU WELCHEM Angebot das Ergebnis gehoert. Aendert man danach Gehalt,
 * Laufzeit oder Form, gilt es nicht mehr — sonst unterschriebe man einen anderen Vertrag als den,
 * dem der Spieler zugestimmt hat.
 */
type VerhandlungsErgebnis = {
  status: "accepted" | "countered" | "rejected";
  tone: "success" | "warning" | "error";
  title: string;
  message: string;
  counterSalary?: number | null;
  counterConditions?: { contractLength: number; contractShape: ContractShape } | null;
  fuerAngebot: { salary: number | null; length: number; shape: ContractShape };
};

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
      /**
       * DAS FENSTER DARF NICHT HAENGEN BLEIBEN.
       *
       * GEMELDET VON CHRIS: „momentan lädt es endlos."
       *
       * `previewBusy` wurde synchron gesetzt und NUR im Erfolgspfad wieder geloest — kein `catch`,
       * kein `finally`, kein Timeout. Bleibt eine Antwort aus, steht das Fenster dauerhaft auf
       * „Die Verhandlungsvorschau wird aktualisiert", und beide Knoepfe sind gesperrt: „Angebot
       * senden" und „Vertrag unterschreiben" haengen beide an `previewBusy`.
       *
       * Und Antworten bleiben aus: `better-sqlite3` ist synchron, jeder Voll-Load des Spielstands
       * blockiert den ganzen Node-Prozess. Ein Bestaetigen stiess bis eben fuenf davon an, drei
       * davon im Hintergrund — waehrenddessen wird keine andere Anfrage bedient.
       *
       * `finally` statt `then`: der Zustand loest jetzt IMMER, auch bei Netzfehler oder Absturz
       * der Route. Ein Fehlschlag zeigt dann die zuletzt bekannten Zahlen statt einer toten
       * Oberflaeche — schlechter als frische Zahlen, aber unendlich viel besser als gar nichts.
       */
      void requestPreview({
        teamId: subject.teamId,
        playerId: subject.playerId,
        contractLength: draftLength,
        offeredSalary: draftSalary,
        contractShape: draftShape,
      })
        .then((payload) => {
          if (requestSeqRef.current !== seq) {
            return;
          }
          if (payload?.summary) {
            setSummary(payload.summary);
          }
        })
        .catch(() => {
          // Bewusst still: `requestPreview` faengt seine Fehler schon selbst ab und liefert null.
          // Dieser Zweig ist das Netz darunter, damit `finally` garantiert erreicht wird.
        })
        .finally(() => {
          // Nur die JUENGSTE Anfrage darf entsperren — eine ueberholte Antwort wuerde sonst
          // freigeben, waehrend die neuere noch laeuft.
          if (requestSeqRef.current === seq) {
            setPreviewBusy(false);
          }
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

  // ---- Verhandlung: erst senden, dann unterschreiben --------------------------------
  const [ergebnis, setErgebnis] = useState<VerhandlungsErgebnis | null>(null);
  // Ein Ergebnis gilt nur fuer das Angebot, zu dem es gehoert. Wer danach an Gehalt, Laufzeit
  // oder Form dreht, verhandelt einen anderen Vertrag — und muss neu senden.
  const ergebnisGilt =
    ergebnis != null &&
    ergebnis.fuerAngebot.salary === draftSalary &&
    ergebnis.fuerAngebot.length === draftLength &&
    ergebnis.fuerAngebot.shape === draftShape;
  const aktivesErgebnis = ergebnisGilt ? ergebnis : null;

  function aktuellesAngebot() {
    return { salary: draftSalary, length: draftLength, shape: draftShape };
  }

  /**
   * SCHRITT 1 — das Angebot geht raus.
   *
   * Gewuerfelt wird hier nichts: das Verdikt steht deterministisch in der Server-Vorschau
   * (`verhandlung-rework.md`, Abschnitt 2.2). Die Prozente daneben sind daraus ABGELEITET und
   * nicht die Entscheidung — deshalb liest dieser Knopf das Verdikt und nicht die Prozente.
   */
  function angebotSenden() {
    if (negotiation?.verdict == null || previewBusy || busy) {
      return;
    }
    const verdict = negotiation.verdict;
    const name = subject.playerName;
    const fuerAngebot = aktuellesAngebot();

    if (verdict === "reject_lowball" || verdict === "reject_not_about_money" || verdict === "reject_affront") {
      setErgebnis({
        status: "rejected",
        tone: "error",
        title:
          verdict === "reject_not_about_money"
            ? "Absage — am Geld liegt's nicht"
            : verdict === "reject_affront"
              ? "Absage — Rückzieher"
              : "Angebot abgelehnt",
        message:
          verdict === "reject_not_about_money"
            ? `${name} will nicht verlängern, und mehr Geld würde daran nichts ändern.`
            : verdict === "reject_affront"
              ? `${name} zieht sich zurück: nach seinem Entgegenkommen kam ein NIEDRIGERES Angebot als zuletzt gezeigt. Das zählt als Vertrauensbruch.`
              : `${name} lehnt dieses Angebot ab. Heb das Gehalt an oder passe den Vertrag an, dann kannst du neu verhandeln.`,
        fuerAngebot,
      });
      return;
    }

    if (verdict === "counter_money") {
      const gegen = negotiation.counterSalary ?? null;
      const abstand = gegen != null && draftSalary != null ? Number((gegen - draftSalary).toFixed(2)) : null;
      setErgebnis({
        status: "countered",
        tone: "warning",
        title: negotiation.concededFromLastCounter === true ? "Er kommt dir entgegen" : "Gegenangebot",
        message: `${name} will eher ${formatNlMoney(gegen)} pro Saison${
          abstand != null ? ` (${abstand > 0 ? "+" : ""}${formatNlMoney(abstand)} gegenüber deinem Angebot)` : ""
        }. Schlag ein oder passe dein Angebot an und verhandle neu.`,
        counterSalary: gegen,
        fuerAngebot,
      });
      return;
    }

    if (verdict === "counter_conditions") {
      const konditionen = negotiation.counterConditions ?? null;
      setErgebnis({
        status: "countered",
        tone: "warning",
        title: "Beim Gehalt einig, Vertrag noch nicht",
        message: `${name} ist mit dem Gehalt zufrieden, will aber ${
          konditionen ? `${konditionen.contractLength} Saison${konditionen.contractLength === 1 ? "" : "en"}` : "eine andere Laufzeit"
        }${konditionen ? ` (Form: ${formatContractShapeLabel(konditionen.contractShape)})` : ""}. Gib ihm den Wunschvertrag oder leg beim Gehalt nach.`,
        counterConditions: konditionen,
        fuerAngebot,
      });
      return;
    }

    setErgebnis({
      status: "accepted",
      tone: "success",
      title: "Angebot angenommen",
      message: `${name} nimmt an. Du kannst den Vertrag jetzt unterschreiben.`,
      fuerAngebot,
    });
  }

  /**
   * Ein angenommenes Gegenangebot ist BINDEND — dieselbe Regel wie beim Kauf
   * (`verhandlung-rework.md`, Abschnitt 3.4). Die genannte Zahl noch einmal durch die Baender zu
   * schicken waere Wortbruch durch Formel: ein Gegenangebot kann unter der vollen Forderung
   * liegen und kaeme dann als Gegenangebot zurueck, statt als Zusage zu gelten.
   */
  function gegenangebotEinschlagen() {
    if (aktivesErgebnis?.status !== "countered") {
      return;
    }
    const neuesGehalt = aktivesErgebnis.counterSalary ?? draftSalary;
    const neueLaufzeit = aktivesErgebnis.counterConditions?.contractLength ?? draftLength;
    const neueForm = aktivesErgebnis.counterConditions?.contractShape ?? draftShape;
    setDraftSalary(neuesGehalt);
    setDraftLength(neueLaufzeit);
    setDraftShape(neueForm);
    setErgebnis({
      status: "accepted",
      tone: "success",
      title: "Gegenangebot eingeschlagen",
      message: `${subject.playerName} ist einverstanden. Du kannst den Vertrag jetzt unterschreiben.`,
      fuerAngebot: { salary: neuesGehalt, length: neueLaufzeit, shape: neueForm },
    });
  }
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
  // Schritt 2 ist erst frei, wenn eine Zusage vorliegt — genau wie beim Kauf. Ohne diese Sperre
  // waeren Verdikt und Chancen weiter reine Anzeige und das Angebot ginge immer durch.
  const zusageLiegtVor = aktivesErgebnis?.status === "accepted";
  const confirmDisabled = busy || previewBusy || draftSalary == null || confirmBlocked || !zusageLiegtVor;
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
            : !zusageLiegtVor
              ? "Erst das Angebot senden — unterschrieben wird, wenn der Spieler zusagt."
              : "Diese Verlängerung ist gerade blockiert.";

  const sendenDisabled = busy || previewBusy || draftSalary == null || confirmBlocked || negotiation?.verdict == null;
  const sendenDisabledReason = !sendenDisabled
    ? null
    : previewBusy
      ? "Die Verhandlungsvorschau wird aktualisiert."
      : draftSalary == null
        ? "Bitte ein Angebotsgehalt eintragen."
        : negotiation?.verdict == null
          ? "Die Reaktion des Spielers liegt noch nicht vor."
          : blockingReasons.length > 0
            ? translateRenewalReason(blockingReasons[0])
            : "Verhandeln ist gerade gesperrt.";

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

        {/* Was der Spieler geantwortet hat — ohne diese Zeile waere „Angebot senden" ein Knopf
            ohne Rueckmeldung. Steht bewusst ueber dem Formular: es ist die Information, wegen der
            man gerade etwas aendert. */}
        {aktivesErgebnis ? (
          <div
            className={`transfer-feedback-banner is-${aktivesErgebnis.tone}`}
            role="status"
            data-testid="negotiation-outcome"
            data-status={aktivesErgebnis.status}
          >
            <strong>{aktivesErgebnis.title}</strong>
            <span>{aktivesErgebnis.message}</span>
          </div>
        ) : null}

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
                  /**
                   * DER STERN SASS AUF EINER LAUFZEIT, DIE DAS FENSTER DANN VERWEIGERTE.
                   *
                   * GEMELDET VON CHRIS: „xelara steht aktuell dann immernoch auf vertrag läuft aus."
                   *
                   * Ihre Wunschlaufzeit ist 3, ihr Moral-Limit 2. Die 3 trug damit den Stern
                   * („Wunschlaufzeit des Spielers"), war anklickbar — und liess sich anschliessend
                   * nicht bestaetigen: „Die Moral begrenzt die Vertragslaenge — waehle eine
                   * kuerzere Laufzeit." Wer daraufhin nach unten geht, landet leicht auf 1. Und 1
                   * heisst „laeuft aus", also sieht die Verlaengerung aus wie nichts.
                   *
                   * Zwei Aenderungen: was das Fenster nicht unterschreiben wird, ist auch nicht
                   * mehr anklickbar. Und der Stern sitzt nur noch auf einer Laufzeit, die wirklich
                   * geht — eine Empfehlung, der man nicht folgen kann, ist keine.
                   */
                  const istWunsch = negotiation?.contractPreference?.idealLength === length && !overLimit;
                  return (
                    <button
                      key={length}
                      type="button"
                      disabled={overLimit}
                      className={`nl-negotiation-choice${draftLength === length ? " is-active" : ""}${overLimit ? " is-limited" : ""}`}
                      title={
                        overLimit
                          ? `Moral begrenzt die Laufzeit auf ${formatNlNumber(lengthLimit, 0)} Saisons — ${formatNlNumber(length, 0)} ist nicht unterschreibbar.`
                          : istWunsch
                            ? "Wunschlaufzeit des Spielers."
                            : undefined
                      }
                      onClick={() => setDraftLength(length)}
                    >
                      {formatNlNumber(length, 0)}
                      {istWunsch ? <small>★</small> : null}
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
          {/* SCHRITT 1 — derselbe Ablauf wie beim Kauf: erst senden, dann unterschreiben.
              Liegt ein Gegenangebot auf dem Tisch, tritt „Einschlagen" an diese Stelle. */}
          {aktivesErgebnis?.status === "countered" ? (
            <button
              className="secondary-button is-emphasized"
              type="button"
              data-testid="negotiation-accept-counter-button"
              disabled={busy}
              title="Seine Forderung übernehmen — das gilt als Zusage."
              onClick={gegenangebotEinschlagen}
            >
              Einschlagen
            </button>
          ) : (
            <button
              className="secondary-button is-emphasized"
              type="button"
              data-testid="negotiation-send-offer-button"
              disabled={sendenDisabled}
              title={sendenDisabledReason ?? "Angebot senden und die Reaktion des Spielers abwarten."}
              onClick={angebotSenden}
            >
              {zusageLiegtVor ? "Zusage liegt vor" : "Schritt 1: Angebot senden"}
            </button>
          )}
          <button
            className="primary-button"
            type="button"
            data-testid="negotiation-confirm-button"
            disabled={confirmDisabled}
            title={confirmDisabledReason ?? "Vertrag zu diesen Konditionen unterschreiben."}
            onClick={() =>
              void onConfirm({
                contractLength: draftLength,
                offeredSalary: draftSalary,
                contractShape: draftShape,
                confirmToken: summary?.confirmToken ?? subject.confirmToken ?? null,
              })
            }
          >
            {/**
              * DIE LAUFZEIT STEHT AUF DEM KNOPF.
              *
              * Bis hierher sagte er nur „Vertrag unterschreiben" — man konnte eine Ein-Saison-
              * Verlaengerung abschliessen, ohne sie je gelesen zu haben, und danach stand der
              * Spieler unveraendert auf „laeuft aus". Wer die Zahl auf dem Knopf sieht, kann sich
              * nicht mehr unbemerkt verklicken.
              */}
            {busy
              ? "Wird verlängert…"
              : `Schritt 2: ${formatNlNumber(draftLength, 0)} ${draftLength === 1 ? "Saison" : "Saisons"} unterschreiben`}
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
