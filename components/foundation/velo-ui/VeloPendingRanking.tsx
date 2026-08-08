import type { ReactNode } from "react";

/**
 * VeloPendingRanking — expliziter Leerzustand für Ranglisten/Wertungen OHNE Daten.
 *
 * Muster 3 („eine leere Rangliste darf nie eine Reihenfolge behaupten"): Wo noch
 * keine Wertung existiert, rendert diese Karte bewusst KEINE Zeilen, keine
 * Rangzahlen und keine Medaillen-Optik — stattdessen leere, gestrichelte
 * Podest-Slots („Noch zu vergeben") plus eine Erklärung, wann die echte Wertung
 * entsteht. Entwurf aus dem freigegebenen Leaders-Mockup
 * (`leagueLeaders-v2.html`, Abschnitt „Noch zu vergeben").
 *
 * Verwender:
 * - Arena (S3): „Spieltags-Wertung folgt" vor dem ersten gewerteten Ergebnis.
 * - Ranks/PP-Board (W1): Saisonstart-Leerzustand statt Alphabet-Medaillen.
 *
 * Bewusst rein presentational — Zahlen/Slots kommen vollständig vom Aufrufer,
 * die Komponente erfindet nichts.
 */

export type VeloPendingRankingSlot = {
  key: string;
  /** Kurzzeichen im gestrichelten Ring (z. B. „1.", „PPS", „PP POW"). */
  ring: ReactNode;
  /** Beschriftung unter dem Ring (z. B. „Noch zu vergeben", „Power-Achse"). */
  label: string;
  /** Optionaler Farbpunkt vor dem Label (z. B. Achsenfarbe) — CSS-Farbe. */
  dotColor?: string | null;
};

export type VeloPendingRankingProps = {
  /** Kleines Label über dem Titel (z. B. „Spieltags-Wertung"). */
  eyebrow?: string | null;
  /** Überschrift, z. B. „Wertung folgt" / „Noch zu vergeben". */
  title: string;
  /** Warum hier bewusst niemand gereiht ist und wann sich das ändert. */
  note: string;
  /** Leere Podest-/Kategorie-Slots (optional). */
  slots?: VeloPendingRankingSlot[];
  /** Meta-Zeile unten (echte Zahlen, tabellarisch — z. B. „32 Teams gemeldet"). */
  meta?: ReactNode;
  className?: string;
  "data-testid"?: string;
};

export function VeloPendingRanking({
  eyebrow,
  title,
  note,
  slots,
  meta,
  className,
  "data-testid": testId,
}: VeloPendingRankingProps) {
  return (
    <section
      className={["velo-pending-ranking", className].filter(Boolean).join(" ")}
      data-testid={testId ?? "velo-pending-ranking"}
      aria-label={title}
    >
      {eyebrow ? <span className="velo-pending-ranking-eyebrow">{eyebrow}</span> : null}
      <strong className="velo-pending-ranking-title">{title}</strong>
      <p className="velo-pending-ranking-note">{note}</p>
      {slots && slots.length > 0 ? (
        <div className="velo-pending-ranking-slots">
          {slots.map((slot) => (
            <span key={slot.key} className="velo-pending-ranking-slot">
              <span className="velo-pending-ranking-ring" aria-hidden="true">
                {slot.ring}
              </span>
              <span className="velo-pending-ranking-slot-label">
                {slot.dotColor ? (
                  <i className="velo-pending-ranking-dot" style={{ background: slot.dotColor }} aria-hidden="true" />
                ) : null}
                {slot.label}
              </span>
            </span>
          ))}
        </div>
      ) : null}
      {meta ? <div className="velo-pending-ranking-meta nl-tnum">{meta}</div> : null}
    </section>
  );
}
