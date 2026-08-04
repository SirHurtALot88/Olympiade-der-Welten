"use client";

/**
 * ENTSCHEIDUNGS-HÜLLE — die gemeinsame Form für Kauf, Verkauf und Gebäude.
 *
 * WARUM ES SIE GIBT: `foundation-drilldown-page` kam an drei Stellen vor, und jede baute ihre
 * Hülle selbst — Kopf, Zustands-Pill, Abbruchpunkt, Fußleiste, Zweiklick-Bestätigung,
 * „Warum nicht"-Zeile. Drei Kopien derselben Idee. Genau deshalb sah der Verkauf alt aus,
 * während der Kauf schon anders aussah: sie konnten gar nicht gemeinsam altern.
 *
 * WARUM KEIN OVERLAY: Das Projekt hat Modals bewusst zu Drilldown-Seiten migriert
 * (Strangler Phase 5.3). Der Grund steht in den eigenen Performance-Protokollen — ein
 * `foundation-modal-backdrop` legt sich über die Shell und fängt Klicks ab, die nicht für es
 * bestimmt sind („intercepts pointer events", `docs/tab-performance-hotspots-v6.1.md`). Eine
 * Drilldown-Seite ist außerdem adressierbar, der Zurück-Knopf funktioniert, und sie bricht auf
 * schmalen Fenstern nicht. `tests/foundation-page-surfaces-contract.test.ts` hält das fest.
 *
 * Das Fenster-GEFÜHL entsteht trotzdem: zentrierte Karte mit Maximalbreite, ruhiger Grund,
 * gescrollt wird in der Karte. Nur ohne die Klick-Falle.
 */
import { useCallback, useEffect, useState, type ReactNode, type RefObject } from "react";

// "neutral" gibt es zusätzlich zu den drei Ampel-Tönen: für einen Status ohne
// Wertung, z. B. "nur Ansicht" im Referenzmodus — dafür ist Amber/Rot/Grün falsch.
export type DecisionSurfaceStatusTone = "ready" | "warning" | "blocked" | "neutral" | "done";

export type DecisionSurfacePrimaryAction = {
  /** Beschriftung im ersten Schritt, z. B. „Verkaufen…" oder „Angebot senden". */
  label: string;
  /** Beschriftung im Bestätigungsschritt, z. B. „Ja, endgültig verkaufen". */
  confirmLabel: string;
  /** Läuft die Buchung gerade? Dann trägt der Knopf den Verlaufstext. */
  busyLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  /**
   * Warum der Knopf nicht geht — erscheint als TEXT neben dem Knopf, nicht nur im Tooltip.
   * Ein deaktivierter Knopf ohne sichtbaren Grund ist eine Sackgasse.
   */
  disabledReason?: string | null;
  /** Rot, wenn die Handlung endgültig etwas wegnimmt (Verkauf). Sonst Akzent (Kauf, Ausbau). */
  danger?: boolean;
  /**
   * Überschreibt die Standard-Testid `${testId}-primary` — für Aufrufer, die bereits eine
   * eigene, dokumentierte Testid verdrahtet haben (E2E-Skripte, siehe
   * docs/design/verkauf-popup.md Abschnitt 8: "Testids bleiben stabil").
   */
  buttonTestId?: string;
  /** Überschreibt analog die Standard-Testid `${testId}-disabled-reason`. */
  disabledReasonTestId?: string;
  onConfirm: () => void | Promise<void>;
};

/**
 * Ein ZWEITER Handlungsknopf links neben dem Hauptknopf — für Abläufe, die vor der endgültigen
 * Handlung einen eigenen Schritt haben.
 *
 * Der Kauf ist genau so einer: erst „Verhandeln" (Reaktion der Gegenseite einholen), dann
 * „Kauf abschließen". Das ist kein Doppel-Primary, sondern eine echte Reihenfolge — der zweite
 * Knopf ist bis zur Annahme gesperrt. Ohne diesen Slot hätte der Kauf seine Fußleiste weiterhin
 * selbst bauen müssen, und die Hülle wäre für ihn nutzlos gewesen.
 *
 * Kein Bestätigungsschritt: der Zweiklick gehört zur endgültigen Handlung, und die ist der
 * Hauptknopf.
 */
export type DecisionSurfaceSecondaryAction = {
  label: string;
  busyLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  /** Tooltip am Knopf — der sichtbare „Warum nicht"-Text gehört dem Hauptknopf. */
  title?: string;
  buttonTestId?: string;
  /** Hebt den zweiten Knopf hervor, solange ER der nächste Schritt ist. */
  emphasized?: boolean;
  onAct: () => void | Promise<void>;
};

export type FoundationDecisionSurfaceProps = {
  /** Kleine Zeile über dem Titel, z. B. „Transfermarkt · Verkauf". */
  kicker: string;
  status?: { label: string; tone: DecisionSurfaceStatusTone } | null;
  ariaLabel: string;
  /** `data-testid` der Seite — die Architektur-Tests prüfen darauf. */
  testId: string;
  /** Zusätzliche Klasse für ablaufspezifisches CSS. */
  className?: string;
  /**
   * Anker auf die Seite selbst, damit der Aufrufer sie ins Sichtfeld holen kann.
   *
   * Klingt nach Kleinigkeit, ist aber der Unterschied zwischen "geht auf" und "geht nicht auf":
   * die Entscheidungs-Seite wird UNTER der Ansicht gerendert, aus der man kommt. Ohne diesen
   * Anker läuft `scrollIntoView` beim Aufrufer ins Leere, und der Dialog liegt einfach zweitausend
   * Pixel weiter unten — sichtbar für Tests, unsichtbar für Menschen. Genau das ist beim
   * Umstellen des Kaufdialogs passiert, weil die Seite ihr `ref` vorher selbst trug.
   */
  containerRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  /**
   * Sperrt den X-Knopf im Kopf (nicht Esc/Abbrechen) — für den Moment, in dem eine
   * endgültige Buchung tatsächlich unterwegs ist und ein Schließen mittendrin keinen
   * Sinn ergibt. Ohne Angabe immer klickbar.
   */
  closeDisabled?: boolean;
  /** Kopfzone: Portrait, Identität und die eine große Zahl. */
  hero?: ReactNode;
  /** Alles zwischen Hero und Fußleiste. */
  children: ReactNode;
  /**
   * Der Satz, der im Bestätigungsschritt über der Fußleiste erscheint: was gleich endgültig
   * passiert. Fehlt er, gibt es keinen Zweiklick — dann bucht der Knopf sofort.
   */
  confirmNote?: ReactNode;
  primary?: DecisionSurfacePrimaryAction | null;
  /** Vorgelagerter Schritt links vom Hauptknopf (z. B. „Verhandeln" vor „Kauf abschließen"). */
  secondary?: DecisionSurfaceSecondaryAction | null;
  /** Ist die Handlung erledigt, ersetzt ein einzelner „Schließen"-Knopf die Fußleiste. */
  done?: boolean;
  cancelLabel?: string;
};

// Die Töne mappen auf die Klassen, die `.transfer-status-pill` (app/globals.css) schon
// kennt — dieselbe Pille wird an mehreren Stellen im Spiel wiederverwendet. "neutral"
// bleibt bewusst ohne Zusatzklasse: die Basis-Pille ist grau, keine Wertung.
const STATUS_TONE_CLASS: Record<DecisionSurfaceStatusTone, string> = {
  ready: " is-ready",
  warning: " is-warning",
  blocked: " is-blocked",
  neutral: "",
  done: " is-ready",
};

export function FoundationDecisionSurface({
  kicker,
  status,
  ariaLabel,
  testId,
  className,
  containerRef,
  onClose,
  closeDisabled = false,
  hero,
  children,
  confirmNote,
  primary,
  secondary,
  done = false,
  cancelLabel = "Abbrechen",
}: FoundationDecisionSurfaceProps) {
  /**
   * Der Bestätigungsschritt ist ECHTER Zustand, nicht eine per CSS umgeschaltete Variante.
   * Beides gleichzeitig im DOM zu halten hiesse, dass ein Klick auf den unsichtbaren Knopf
   * trotzdem bucht — bei einer endgültigen Handlung ist das kein akzeptables Restrisiko.
   */
  const [confirmStep, setConfirmStep] = useState(false);
  const hasConfirmStep = confirmNote != null;

  // Esc schliesst — derselbe Reflex wie ueberall sonst in der Oberflaeche. Im
  // Bestaetigungsschritt geht Esc nur einen Schritt zurueck: sonst verliert man aus Versehen
  // die ganze Vorschau, obwohl man nur den letzten Klick zuruecknehmen wollte.
  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (confirmStep) {
        setConfirmStep(false);
        return;
      }
      onClose();
    },
    [confirmStep, onClose],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  const disabledReason = primary?.disabledReason ?? null;
  const primaryDisabled = Boolean(primary?.disabled) || Boolean(primary?.busy);

  return (
    <section
      ref={containerRef}
      className={["foundation-drilldown-page", "nl-decision-page", className ?? ""].filter(Boolean).join(" ")}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      <div className="nl-decision-card">
        <header className="nl-decision-head">
          <span className="nl-decision-kicker">{kicker}</span>
          {status ? (
            <span className={`transfer-status-pill${STATUS_TONE_CLASS[status.tone]}`}>{status.label}</span>
          ) : null}
          <button
            className="nl-decision-close"
            type="button"
            aria-label="Schließen"
            title="Schließen (Esc)"
            onClick={onClose}
            disabled={closeDisabled}
          >
            ✕
          </button>
        </header>

        {hero ? <div className="nl-decision-hero">{hero}</div> : null}

        <div className="nl-decision-body">{children}</div>

        <footer className="nl-decision-foot">
          {confirmStep && hasConfirmStep ? (
            // "is-danger" faerbt den Hinweis rot statt amber — nur wenn die Handlung
            // selbst gefaehrlich ist (Verkauf), nicht bei jedem Zweiklick (Ausbau).
            <div
              className={`nl-decision-confirmnote${primary?.danger ? " is-danger" : ""}`}
              data-testid={`${testId}-confirm-note`}
            >
              {confirmNote}
            </div>
          ) : null}

          <div className="nl-decision-foot-row">
            {done ? (
              <button className="primary-button" type="button" onClick={onClose}>
                Schließen
              </button>
            ) : (
              <>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => (confirmStep ? setConfirmStep(false) : onClose())}
                  disabled={primary?.busy}
                >
                  {confirmStep ? "Zurück" : cancelLabel}
                </button>
                <span className="nl-decision-foot-spacer" />
                {secondary ? (
                  <button
                    className={secondary.emphasized ? "primary-button" : "secondary-button"}
                    type="button"
                    data-testid={secondary.buttonTestId}
                    disabled={Boolean(secondary.disabled) || Boolean(secondary.busy) || Boolean(primary?.busy)}
                    title={secondary.title}
                    onClick={() => void secondary.onAct()}
                  >
                    {secondary.busy ? secondary.busyLabel ?? "Läuft…" : secondary.label}
                  </button>
                ) : null}
                {disabledReason ? (
                  <p
                    className="foundation-screen-action-reason"
                    data-testid={primary?.disabledReasonTestId ?? `${testId}-disabled-reason`}
                  >
                    Warum nicht: {disabledReason}
                  </p>
                ) : null}
                {primary ? (
                  <button
                    className={`primary-button nl-decision-primary${primary.danger && confirmStep ? " is-danger" : ""}`}
                    type="button"
                    data-testid={primary.buttonTestId ?? `${testId}-primary`}
                    disabled={primaryDisabled}
                    title={disabledReason ?? undefined}
                    onClick={() => {
                      if (hasConfirmStep && !confirmStep) {
                        setConfirmStep(true);
                        return;
                      }
                      void primary.onConfirm();
                    }}
                  >
                    {primary.busy
                      ? primary.busyLabel ?? "Läuft…"
                      : confirmStep || !hasConfirmStep
                        ? primary.confirmLabel
                        : primary.label}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </footer>
      </div>
    </section>
  );
}

export default FoundationDecisionSurface;
