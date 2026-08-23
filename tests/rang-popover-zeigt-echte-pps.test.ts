/**
 * DAS RANG-POPOVER ZEIGT GEHOLTE PPs — NICHT DIE STAERKE DES KADERS.
 *
 * GEMELDET VON CHRIS: „die PP Ansicht zeigt nicht unsere PPs der Spieler! … Bitte hier die PPs aus
 * den Bereichen hinterlegen wie sie auch im Saisonstand zu finden sind!"
 *
 * Im Teamprofil hing unter der RANG-Kachel eine kompakte Ligatabelle. Sie beschriftete ihre Zahlen
 * mit „PPs", zeigte aber den `scorePack` aus `buildTeamDisciplineRankRowsFromGameState` — die Summe
 * der DISZIPLIN-STAERKEN der besten sechs Spieler. An seinem Spielstand (season-2, Spieltag 9):
 *
 *   C-S  angezeigt 1541/1679/1537/1638 = „6.395 PPs"  ·  geholt 27/24/13/48 = 112
 *
 * Die echten PPs standen die ganze Zeit daneben — die „112 P" der Zeile SIND die 112 PPs.
 *
 * Der Fix rechnet nicht neu, sondern ruft dieselbe Funktion wie die Saisonstand-Tabelle
 * (`buildTeamSeasonAreaPoints`). Dieser Test haelt fest, dass die Bereichswerte aus geholten
 * Punkten entstehen — und dass die Stärke des Kaders sie NICHT mehr beeinflusst.
 */
import { describe, expect, it } from "vitest";

import { buildTeamSeasonAreaPoints } from "@/lib/foundation/season-area-points";

/**
 * Ein Team, das in vier Disziplinen Punkte geholt hat — je eine pro Bereich.
 *
 * Die Disziplin-Schluessel sind ECHTE Schluessel aus `SEASON_DISCIPLINE_AREA_GROUPS`, keine
 * erfundenen: die Bereichs-Zuordnung laeuft ueber genau diese Namen, und ein Fantasiename faellt
 * stillschweigend aus seinem Bereich heraus. (`wettessen` gehoert z. B. zu MEN, nicht zu SOC.)
 */
function ledgerEinesTeams() {
  return {
    ledgerPointsByDiscipline: { tdm: 27, spurt: 24, schach: 13, eiskunst: 48 },
    ledgerPointsByArea: { power: 27, speed: 24, mental: 13, social: 48 },
    ledgerTotalPoints: 112,
    hasCurrentPps: true,
  };
}

describe("Bereichspunkte des RANG-Popovers", () => {
  it("entstehen aus geholten PPs, nicht aus der Kaderstaerke", () => {
    const a = buildTeamSeasonAreaPoints({ standingDisciplineValues: null, ...ledgerEinesTeams() });
    // Die Groessenordnung ist der Kern der Meldung: geholte PPs liegen im zweistelligen
    // Bereich, die alte Staerke-Summe lag bei ueber 1.500 je Achse.
    for (const wert of [a.pow, a.spe, a.men, a.soc]) {
      expect(wert).not.toBeNull();
      expect(wert as number).toBeLessThan(500);
    }
    expect(a.total).toBe(112);
  });

  it("summieren sich zur Gesamtpunktzahl des Teams", () => {
    const a = buildTeamSeasonAreaPoints({ standingDisciplineValues: null, ...ledgerEinesTeams() });
    const summe = (a.pow ?? 0) + (a.spe ?? 0) + (a.men ?? 0) + (a.soc ?? 0);
    expect(summe).toBeCloseTo(a.total, 1);
  });

  it("bleiben ohne gewerteten Spieltag bei 0 statt Scheingenauigkeit zu behaupten", () => {
    const a = buildTeamSeasonAreaPoints({
      standingDisciplineValues: null,
      ledgerPointsByDiscipline: null,
      ledgerPointsByArea: null,
      ledgerTotalPoints: 0,
      hasCurrentPps: false,
    });
    expect(a.total).toBe(0);
  });

  it("liefern beide Stufen — gespeicherten Achswert und aufgeloeste Anzeige", () => {
    // Die Saisonstand-Zeile speichert `displayPow` (als `ppsPow`) und loest erst in der Ansicht
    // auf; das Popover zeigt direkt `pow`. Beide muessen aus DERSELBEN Rechnung kommen, sonst
    // laufen Tabelle und Popover wieder auseinander.
    const a = buildTeamSeasonAreaPoints({ standingDisciplineValues: null, ...ledgerEinesTeams() });
    expect(a.displayPow).toBe(27);
    expect(a.pow).toBe(27);
    expect(a.displayTotal).toBe(a.total);
  });
});
