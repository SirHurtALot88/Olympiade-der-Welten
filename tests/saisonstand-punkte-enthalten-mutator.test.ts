/**
 * DER SAISONSTAND MUSS DIESELBEN PUNKTE ZEIGEN, DIE GEBUCHT WERDEN — MUTATOR EINGESCHLOSSEN.
 *
 * GEMELDET VON CHRIS (`w4eloo`, dann `re954b`): „Nach MD1 hat Z-H Platz 1 im Spieltag geholt, soll
 * in der Saison aber nur 2. sein. das kann ja gar nicht sein!" — „mein Verdacht ist bestaetigt, im
 * Saisonstand sind die Mutatorpunkte mit 0,3 gar nicht drin!! bitte in die Punkte mit einrechnen!"
 *
 * NACHGEMESSEN am Live-Abbild `hwz8fk` (Saison 1, zehn Spieltage, 32 Teams): fuer JEDES Team galt
 * `standings[team].points === Ledger-Gesamt − Ledger-Mutator`. Der Aufschlag lag zwischen 2,4 und
 * 6,9 Punkten, UND ER DREHT PLAETZE: 13 der 32 Teams wechselten den Rang, darunter die Spitze —
 * H-R 147,4 vor N-W 146,0 statt N-W 142,1 vor H-R 142,0. An dieser Zeile hing der Meister.
 *
 * WARUM DIE PRUEFUNG AM QUELLTEXT UND NICHT AN EINEM SPIELSTAND HAENGT: die Buchung laeuft ueber
 * `buildStandingsPreview`, das die Rang-zu-Punkte-Tabelle aus einer Referenzdatei laedt und einen
 * vollstaendigen Spielstand mit gebuchten Disziplin-Ergebnissen braucht. Ein Fixture dafuer waere
 * groesser als die Aussage. Gemessen wurde am echten Abbild (siehe oben); hier steht die Wache,
 * die den einmal gezogenen Summanden nicht wieder verschwinden laesst.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { zieheSaisonstandPunkteNach } from "@/lib/standings/saisonstand-punkte-nachbuchung";

const BUCHUNG = readFileSync(join(process.cwd(), "lib/standings/standings-preview-engine.ts"), "utf8");
const SCHREIBWEG = readFileSync(join(process.cwd(), "lib/standings/standings-apply-service.ts"), "utf8");
const SPIELTAG = readFileSync(join(process.cwd(), "lib/foundation/season-matchday-points.ts"), "utf8");
const FELDRENNEN = readFileSync(join(process.cwd(), "lib/foundation/build-field-race-ledger.ts"), "utf8");
const SUMMENQUELLE = readFileSync(join(process.cwd(), "lib/foundation/player-points-total.ts"), "utf8");

describe("Saisonstand-Punkte enthalten den Mutator-Aufschlag", () => {
  it("die Buchung summiert den Mutator-Aufschlag je Team", () => {
    /**
     * Gemessen wird die AUSSAGE, nicht ein Bezeichner. Diese Wache stand zuerst auf einer eigenen
     * lokalen Zaehlschleife (`mutatorPunkteJeTeam`); inzwischen laeuft dieselbe Summe ueber die
     * geteilte `resolveTeamMutatorPpsBonus` (lib/foundation/player-points-total.ts). Das ist eine
     * Zaehlstelle statt zweier und damit besser — der Waechter darf daran nicht scheitern.
     * Entscheidend bleibt: die Buchung holt sich den Aufschlag ueberhaupt.
     */
    expect(BUCHUNG).toContain("resolveTeamMutatorPpsBonus");
    expect(SUMMENQUELLE).toContain("mutatorPpsBonus");
  });

  it("der Aufschlag geht in `pointsDelta` ein — nicht nur in eine Anzeige", () => {
    const stelle = BUCHUNG.slice(BUCHUNG.indexOf("const pointsDelta ="), BUCHUNG.indexOf("const hasStoredResult"));
    expect(stelle).toContain("mutatorBonus");
  });

  it("Spieltag und Feld-Rennen summieren `points`, nicht `basePoints`", () => {
    // `basePoints` ist der reine Rang-Anteil. Wer danach rankt, rankt nach einer anderen Groesse
    // als der Saisonstand bucht — genau der Widerspruch aus der Meldung.
    for (const quelle of [SPIELTAG, FELDRENNEN]) {
      expect(quelle).toContain(") + entry.points, 4)");
      expect(quelle).not.toContain(") + entry.basePoints, 4)");
    }
  });
});

describe("Alte Spieltage heilen beim naechsten Buchen", () => {
  it("die Buchung zieht die Saisonstand-Punkte nach", () => {
    // Ohne das mischte eine laufende Saison zwei Rechenweisen: die Spieltage vor dem Fix ohne,
    // die danach mit Aufschlag. Die Summe passte dann zu gar nichts mehr.
    expect(SCHREIBWEG).toContain("zieheSaisonstandPunkteNach(nextGameState");
  });

  it("die Nachbuchung laeuft VOR der Rangmarke der Gebaeude-Leihe", () => {
    // Die Rangmarke liest den Tabellenplatz. Der kann sich durch die Korrektur aendern — am
    // gemessenen Spielstand bei 13 von 32 Teams. Liefe sie zuerst, schaltete sie auf dem alten.
    const nachbuchungAb = SCHREIBWEG.indexOf("zieheSaisonstandPunkteNach(nextGameState");
    const rangmarkeAb = SCHREIBWEG.indexOf("schalteAlleLeihgabenNachTabelle(korrigierterGameState)");
    expect(nachbuchungAb).toBeGreaterThan(0);
    expect(rangmarkeAb).toBeGreaterThan(nachbuchungAb);
  });
});

describe("Nachbuchung fuer schon gebuchte Spieltage", () => {
  /** Minimaler Spielstand: die Nachbuchung darf ohne gewertete Spieltage NICHTS anfassen. */
  function leererSpielstand() {
    return {
      season: { id: "season-1", matchdayIds: ["matchday-1"], currentMatchday: 1 },
      teams: [{ teamId: "A-A", name: "Alpha", cash: 0 }],
      seasonState: { standings: { "A-A": { points: 12.3, rank: 1 } }, matchdayResults: [], disciplineResults: [] },
    } as never;
  }

  it("ohne gewertete Spieltage wird nichts geschrieben", () => {
    const ergebnis = zieheSaisonstandPunkteNach(leererSpielstand(), "season-1");
    expect(ergebnis.geaenderteTeams).toHaveLength(0);
    expect(ergebnis.uebersprungen).toContain("keine gewerteten Spieltage");
  });

  it("bei fehlenden Disziplin-Ergebnissen wird NICHTS ueberschrieben", () => {
    // Die eigentliche Sicherung: auf einem beschnittenen Spielstand waere die Ledger-Summe zu
    // klein. Ein blindes Ueberschreiben wuerde hier Punkte vernichten.
    const gameState = {
      season: { id: "season-1", matchdayIds: ["matchday-1"], currentMatchday: 1 },
      teams: [{ teamId: "A-A", name: "Alpha", cash: 0 }],
      seasonState: {
        standings: { "A-A": { points: 12.3, rank: 1 } },
        matchdayResults: [{ id: "r1", seasonId: "season-1", matchdayId: "matchday-1", status: "preview_applied" }],
        disciplineResults: [],
      },
    } as never;
    const ergebnis = zieheSaisonstandPunkteNach(gameState, "season-1");
    expect(ergebnis.geaenderteTeams).toHaveLength(0);
    expect(ergebnis.uebersprungen).toContain("ohne Disziplin-Ergebnisse");
    // Derselbe Spielstand kommt zurueck, nicht eine bereinigte Kopie — nichts wurde angefasst.
    expect(ergebnis.gameState).toBe(gameState);
  });
});
