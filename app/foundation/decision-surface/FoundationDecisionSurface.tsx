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
import { useCallback, useEffect, useState, type ReactNode } from "react";

export type DecisionSurfaceStatusTone = "ready" | "warning" | "blocked" | "done";

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
  onConfirm: () => void | Promise<void>;
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
  onClose: () => void;
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
  /** Ist die Handlung erledigt, ersetzt ein einzelner „Schließen"-Knopf die Fußleiste. */
  done?: boolean;
  cancelLabel?: string;
};

const STATUS_TONE_CLASS: Record<DecisionSurfaceStatusTone, string> = {
  ready: " is-ready",
  warning: " is-warning",
  blocked: " is-risk",
  done: " is-ready",
};

export function FoundationDecisionSurface({
  kicker,
  status,
  ariaLabel,
  testId,
  className,
  onClose,
  hero,
  children,
  confirmNote,
  primary,
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
          <button className="nl-decision-close" type="button" aria-label="Schließen" onClick={onClose}>
            ✕
          </button>
        </header>

        {hero ? <div className="nl-decision-hero">{hero}</div> : null}

        <div className="nl-decision-body">{children}</div>

        <footer className="nl-decision-foot">
          {confirmStep && hasConfirmStep ? (
            <div className="nl-decision-confirmnote" data-testid={`${testId}-confirm-note`}>
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
                {disabledReason ? (
                  <p className="foundation-screen-action-reason" data-testid={`${testId}-disabled-reason`}>
                    Warum nicht: {disabledReason}
                  </p>
                ) : null}
                {primary ? (
                  <button
                    className={`primary-button nl-decision-primary${primary.danger && confirmStep ? " is-danger" : ""}`}
                    type="button"
                    data-testid={`${testId}-primary`}
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
