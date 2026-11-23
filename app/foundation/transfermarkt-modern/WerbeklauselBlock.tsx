"use client";

/**
 * WERBEKLAUSEL am Verhandlungstisch (23.11., Mockup public/mockups/marketing-werbeklausel-aushaengeschild-23-11.html, Ansichten „Verhandlung“
 * und „Vertrag“). Drei Zeilen (Spieler behält mehr / Standard / Team bekommt mehr) mit Gehalt je Saison groß und je Spieltag klein, Team-Anteil,
 * Werbegeld ans Team und Saldo gegen Standard. Alle Zahlen kommen aus der Vorschau des Servers (`klauselZeilen`, dieselbe Rechnung wie die
 * Buchung): gezeigt = gebucht. Die Zeile eines Spielers mit `Egomaniac` oder `Diva` bleibt bei „Team bekommt mehr“ sichtbar, grau und gesperrt.
 */
import type { KlauselZeile } from "@/lib/marketing/marketing-klausel";
import type { Werbeklausel } from "@/lib/marketing/marketing-modell";

import { betragC, de, jeSpieltag } from "./tm-format";

export type WerbeklauselBlockProps = {
  zeilen: KlauselZeile[];
  gewaehlt: Werbeklausel;
  /** Wer die Stufe bestimmt hat: die KI-Wahl gilt, bis der Mensch selbst klickt. */
  vonKi: boolean;
  onWahl: (k: Werbeklausel) => void;
  gesperrt?: boolean;
  /** Trait, der „Team bekommt mehr“ ablehnt (Anzeige), sonst `null`. */
  ablehnungTrait: string | null;
  loyal: boolean;
  laufzeit: number;
};

const MINUS = "−";
function vz2(v: number): string {
  const r = Math.round(v * 100) / 100;
  return `${r > 0 ? "+" : r < 0 ? MINUS : "±"}${de(Math.abs(r), 2)}`;
}
const klasse = (v: number) => (v > 0.004 ? "plus" : v < -0.004 ? "minus" : "null");

const UNTER: Record<string, string> = {
  "-1": "−10 Punkte Team-Anteil, Gehalt −2,5 %",
  "0": "Gehalt wie gefordert",
  "1": "+10 Punkte Team-Anteil, Gehalt +2,5 %",
};

export default function WerbeklauselBlock({ zeilen, gewaehlt, vonKi, onWahl, gesperrt, ablehnungTrait, loyal, laufzeit }: WerbeklauselBlockProps) {
  const aktuell = zeilen.find((z) => z.klausel === gewaehlt) ?? zeilen[1]!;
  const n = Math.max(1, laufzeit);
  return (
    <div className="wk" data-testid="wk-block">
      <h4>Werbeklausel</h4>
      <div className="wk-tab" role="radiogroup" aria-label="Werbeklausel">
        {zeilen.map((z) => {
          const an = z.klausel === gewaehlt;
          const nein = !z.erlaubt;
          return (
            <button
              key={z.klausel}
              type="button"
              role="radio"
              aria-checked={an}
              disabled={nein || gesperrt}
              className={`wk-z${an ? " an" : ""}${nein ? " nein" : ""}`}
              onClick={() => onWahl(z.klausel)}
              data-testid={`wk-zeile-${z.klausel}`}
            >
              <span className="wk-n">
                <b>{z.name}</b>
                <small>{nein ? `${ablehnungTrait ?? "Trait"} lehnt ab` : z.klausel === 1 && loyal ? "+10 Punkte, kein Aufschlag (Loyal)" : UNTER[String(z.klausel)]}</small>
              </span>
              {nein || !z.ergebnis ? (
                <span className="wk-w wk-leer">—</span>
              ) : (
                <>
                  <span className="wk-w">
                    <b className="t">{betragC(z.gehalt)}</b>
                    <small>{betragC(jeSpieltag(z.gehalt), 2)} je Spieltag</small>
                  </span>
                  <span className="wk-w">
                    <b className="t">{z.ergebnis.teamAnteilProzent} %</b>
                    <small>Team-Anteil{z.ergebnis.netzGreift ? " · Netz" : ""}</small>
                  </span>
                  <span className="wk-w">
                    <b className="t">{betragC(z.ergebnis.ansTeam)}</b>
                    <small>ans Team</small>
                  </span>
                  <span className="wk-w">
                    <b className={`t ${z.klausel === 0 ? "null" : klasse(z.saldo)}`}>{z.klausel === 0 ? "±0,00 C" : `${vz2(z.saldo)} C`}</b>
                    <small>Saldo je Saison</small>
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
      {aktuell.ergebnis ? (
        <div className="wk-sum" data-testid="wk-summe">
          <span>
            Über {n} {n === 1 ? "Saison" : "Saisons"}: Gehalt <b className="t">{betragC(aktuell.gehalt * n)}</b> · ans Team <b className="t">{betragC(aktuell.ergebnis.ansTeam * n)}</b> · an ihn{" "}
            <b className="t">{betragC(aktuell.ergebnis.anIhn * n)}</b> (Moral +{aktuell.ergebnis.moralZuschlag})
          </span>
          <span>
            Saldo gegen Standard: <b className={`t ${klasse(aktuell.saldo)}`}>{vz2(aktuell.saldo * n)} C</b>
            {vonKi ? " · KI-Wahl nach Finanzwert, du kannst sie überschreiben" : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
