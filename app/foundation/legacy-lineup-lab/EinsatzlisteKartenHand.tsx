"use client";

/**
 * FORMKARTEN-HAND der Einsatzliste (Optik-Runde 18.11., Mockup `form-moral-modern-17-11.html`, `.hand`/`.hka`):
 * die ganze Karten-Hand als Kacheln statt zweier Dropdowns. Ein Klick legt die Karte (erst Primär, dann
 * Sekundär mit halbem Wert), ein Klick auf eine gelegte Karte nimmt sie zurück.
 *
 * Die Kacheln stammen aus `berechneKartenWirkung(...).vergleich` (dieselbe Rechnung wie die Wertung, „gezeigt =
 * gebucht“); gelegt wird über denselben Weg wie vorher die Dropdowns (`onWahl` → Formplan-Speicherung).
 * Es wird nichts neu gerechnet.
 */
import type { KartenWirkung } from "@/lib/lineups/formkarten-wirkung";
import { FARB_NAME } from "@/app/foundation/legacy-lineup-lab/FormMoralBausteine";

const FORM_HEX: Record<string, string> = { red: "#ff8b86", green: "#a8e7aa", blue: "#a9ccff", yellow: "#ffd987" };
const vz = (x: number, nk = 0) => {
  const t = new Intl.NumberFormat("de-DE", { minimumFractionDigits: nk, maximumFractionDigits: nk }).format(Math.abs(x));
  return `${x > 0.0001 ? "+" : x < -0.0001 ? "−" : "±"}${t}`;
};

export type KartenHandProps = {
  w: KartenWirkung;
  colorLabel: string | null;
  primaryId: string | null;
  secondaryId: string | null;
  /** Ids, die als Primär bzw. Sekundär noch frei wählbar sind (aus den bisherigen Dropdown-Listen). */
  primaryFrei: ReadonlySet<string>;
  secondaryFrei: ReadonlySet<string>;
  gesperrt: boolean;
  wartet: boolean;
  onWahl: (art: "primary" | "secondary", id: string | null) => void;
};

export function EinsatzlisteKartenHand({ w, colorLabel, primaryId, secondaryId, primaryFrei, secondaryFrei, gesperrt, wartet, onWahl }: KartenHandProps) {
  const gelegt = (primaryId ? 1 : 0) + (secondaryId ? 1 : 0);
  const klick = (id: string, wert: number) => {
    if (gesperrt || wartet) return;
    if (id === primaryId) return onWahl("primary", null);
    if (id === secondaryId) return onWahl("secondary", null);
    if (!primaryId && primaryFrei.has(id)) return onWahl("primary", id);
    if (!secondaryId && wert > 0 && secondaryFrei.has(id)) return onWahl("secondary", id);
    if (primaryFrei.has(id)) return onWahl("primary", id);
  };
  const alle = w.spieler.reduce((x, s) => x + s.zerlegung.alle, 0);
  const farbe = w.spieler.reduce((x, s) => x + s.zerlegung.traeger, 0);
  const form = w.spieler.reduce((x, s) => x + s.zerlegung.form, 0);

  return (
    <div className="elm-hand" data-testid="elm-kartenhand">
      <div className="elm-hand__kopf bc-gk">
        <span>Formkarten · {gelegt} von 2 gelegt{colorLabel ? <> · Disziplin-Farbe <b>{colorLabel}</b></> : null}{wartet ? " · speichert…" : ""}</span>
        <small>{w.buchung.gebucht ? "zählt in dieser Wertung" : "zählt hier noch nicht"}</small>
      </div>
      <div className="elm-hand__zeile">
        <div className="elm-hand__karten" role="group" aria-label="Formkarten der Hand">
          {w.vergleich.length === 0 ? <span className="fm-leise">Keine Formkarte mehr verfügbar — alle Karten dieser Saison sind gespielt.</span> : null}
          {w.vergleich.map((k) => {
            const nr = k.id === primaryId ? "1" : k.id === secondaryId ? "2" : null;
            const waehlbar = nr != null || primaryFrei.has(k.id) || (k.wert > 0 && secondaryFrei.has(k.id));
            return (
              <button
                key={k.id}
                type="button"
                className={`elm-hka${nr ? " is-gew" : ""}${k.passt ? " is-passt" : ""}${k.wert < 0 ? " is-neg" : ""}${waehlbar ? "" : " is-weg"}`}
                style={{ "--kf": FORM_HEX[k.farbe] ?? "#9aa7ba" } as React.CSSProperties}
                disabled={gesperrt || wartet || !waehlbar}
                aria-pressed={nr != null}
                data-testid={`elm-hka-${k.id}`}
                title={`${FARB_NAME[k.farbe] ?? k.farbe} ${vz(k.wert)} von ${k.spielerName}: ${k.passt ? "passt zur Disziplin-Farbe" : "fremde Farbe, halber Wert für alle"}; Farbbonus nur für Spieler, deren Klasse ${FARB_NAME[k.farbe] ?? k.farbe} ist. Im Team ${vz(k.teamSumme, 1)} Punkte${nr === "1" ? " (Primär)" : nr === "2" ? " (Sekundär)" : ""}. Klick legt oder nimmt zurück.`}
                onClick={() => klick(k.id, k.wert)}
              >
                <span className="elm-hka__fa">{FARB_NAME[k.farbe] ?? k.farbe}</span>
                <span className="elm-hka__pa">{k.passt ? "passt" : "fremd ½"}</span>
                <strong className="bc-t">{vz(k.wert)}</strong>
                <span className="elm-hka__vo">{k.spielerName}</span>
                {nr ? <i className="elm-hka__nr">{nr}</i> : null}
              </button>
            );
          })}
        </div>
        <div className="elm-hand__summe" data-testid="fm-leiste-team">
          <span className="bc-gk">Karten fürs Team</span>
          {w.buchung.gebucht ? (
            <>
              <strong className="bc-t">{vz(w.teamSumme, 1)}</strong>
              <small>alle {vz(alle, 1)} · Farbe {vz(farbe, 1)} · Form {vz(form, 1)}</small>
              {w.farbHinweis ? <small data-testid="elm-farbhinweis">{w.farbHinweis}</small> : null}
              <small>+ Tagesform ±{w.tagesformSpanne} je Spieler</small>
            </>
          ) : (
            <small className="elm-hand__warn">{w.buchung.grund}</small>
          )}
        </div>
      </div>
    </div>
  );
}
