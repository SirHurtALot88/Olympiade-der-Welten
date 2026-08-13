"use client";

import type { SponsorLeihPresentation } from "@/lib/sponsor/sponsor-leih-presenter";

/**
 * DIE GEBAEUDE-LEIHE EINES SPONSORS — EINE Darstellung fuer Angebot UND laufenden Vertrag.
 *
 * GEMELDET VON CHRIS: „gebäude seh ich auch nicht" und „ich meine gebäude leihen bei den sponsoren".
 *
 * Und er hatte recht, aber nur zur Haelfte: der Block hing bis hierher AUSSCHLIESSLICH an der
 * Angebotskarte (`SponsorOfferCardNewLook`). Solange man waehlt, sieht man das Gebaeude — sobald
 * unterschrieben ist, verschwindet es aus der Sponsorseite. `buildLeihPresentationForContract`, die
 * Funktion fuer genau diesen Fall, war exportiert und wurde NIRGENDS aufgerufen.
 *
 * Am frisch angelegten Spiel gemessen, damit die Groessenordnung klar ist: 128 von 160 Angeboten
 * (80 %) tragen eine Leihe, 22 Teams hatten bereits eine laufende — darunter ein `arena_upgrade`
 * auf STUFE 5. Das ist kein Beiwerk, das ist ein Gebaeude auf Maximalstufe, das der Spieler nach
 * der Unterschrift nirgends mehr wiederfand.
 *
 * WARUM EINE GEMEINSAME KOMPONENTE UND KEIN ZWEITER BLOCK: dieselbe Zahl an zwei Stellen getrennt
 * zu formatieren ist in diesem Projekt der zuverlaessigste Weg, sie auseinanderlaufen zu lassen.
 * Gerechnet wird ohnehin nur in `sponsor-leih-presenter.ts`; hier wird ausschliesslich formatiert.
 */
export function SponsorLeihePanel({
  leihe,
  formatCash,
  variant = "offer",
}: {
  leihe: SponsorLeihPresentation;
  formatCash: (value: number) => string;
  /**
   * `offer` = noch nicht unterschrieben, `contract` = laeuft bereits. Der Unterschied ist NICHT
   * kosmetisch: beim Angebot ist der Verzicht eine Ankuendigung, beim laufenden Vertrag eine
   * Tatsache, und nur dort kann die Leihe ruhen.
   */
  variant?: "offer" | "contract";
}) {
  return (
    <div className="nl-sponsor-leihe" data-testid="sponsor-leihe-panel" data-variant={variant}>
      <div className="nl-sponsor-leihe-head">
        <strong>
          {leihe.facilityName} · Stufe {leihe.stufe}
        </strong>
        <span className="nl-sponsor-leihe-zustand nl-tnum">
          {Math.round(leihe.zustandPct)} % Zustand
          {leihe.unterWirkschwelle ? ` · Wirkung ${Math.round(leihe.wirkungsgradPct)} %` : ""}
        </span>
      </div>
      <small>
        {variant === "contract" ? "Geliehen — dieses Gebäude steht dir, " : "Geliehen — "}
        der Sponsor trägt den Unterhalt. Dafür zahlt diese Karte{" "}
        <strong className="nl-tnum">{formatCash(leihe.verzichtDieseSaison)}</strong>{" "}
        {variant === "contract" ? "weniger je Saison" : "weniger je Saison; das"}
        {variant === "contract"
          ? " — das steckt in der Auszahlung bereits drin und wird nicht noch einmal abgezogen."
          : " steckt in der Auszahlung unten bereits drin und wird nicht noch einmal abgezogen."}
      </small>
      {leihe.stufenreihe.length > 1 ? (
        <small>
          Über die Laufzeit: Stufe {leihe.stufenreihe.join(" → ")}
          {" · Verzicht "}
          {leihe.verzichtJeSaison.map((wert) => formatCash(wert)).join(" → ")}
        </small>
      ) : null}
      {leihe.markenStatus ? (
        <small className={leihe.ruht ? "nl-sponsor-leihe-ruht" : undefined}>
          Bedingung: Top {leihe.rangmarke} halten ({leihe.rangmarkenHaerte === "hart" ? "hart" : "mild"}) —
          darunter ruht das Gebäude, der Verzicht läuft weiter. {leihe.markenStatus}
        </small>
      ) : null}
      <small>
        Am Vertragsende übernehmbar für ca.{" "}
        <span className="nl-tnum">{formatCash(leihe.uebernahmepreisJetzt)}</span> statt{" "}
        <span className="nl-tnum">{formatCash(leihe.katalogkostenEndstufe)}</span> Selbstbau.
      </small>
    </div>
  );
}
