/**
 * DIE TRAININGS-VERBESSERUNG GEHÖRT AUCH IN DIE TOP-DISZIPLINEN-TABELLE.
 *
 * GEMELDET VON CHRIS (Spielerprofil, Reiter „Details"): „im bereich Top Disziplinen fehlen noch die
 * verbesserungen die oben drin sind also Staffel 91 (+2) sind dort nicht zu sehen."
 *
 * URSACHE: Beide Ansichten im selben Reiter zeigen dieselben Disziplin-Werte — die Achsen-Zeilen
 * oben und die Top-Disziplinen-Tabelle darunter. Nur die Achsen-Zeilen lasen
 * `disciplineTrainingDeltaById`; `renderTopDisciplineCell` bekam den Wert schlicht nie übergeben
 * und zeigte deshalb bloß „91" statt „91 +2". Zwei Ansichten, zwei Wahrheiten über denselben
 * Spieler.
 *
 * `row.upgradeDelta`, das die Tabelle bereits kannte, ist etwas ANDERES (Aufwertung am
 * Disziplin-Wert selbst) und deckt den Saison-Forecast nicht ab — deshalb fiel es niemandem auf.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

const DRAWER = await fs.readFile(path.join(process.cwd(), "app/foundation/PlayerDetailDrawer.tsx"), "utf8");

/** Der Rumpf von `renderTopDisciplineCell` — bis zur nächsten Top-Level-Funktion. */
const CELL = (() => {
  const start = DRAWER.indexOf("function renderTopDisciplineCell(");
  const rest = DRAWER.slice(start + 10);
  const next = rest.indexOf("\nfunction ");
  return DRAWER.slice(start, next > -1 ? start + 10 + next : DRAWER.length);
})();

describe("Top-Disziplinen zeigen den Saison-Forecast", () => {
  it("die Zellen-Funktion nimmt den Trainings-Forecast überhaupt entgegen", () => {
    // Ohne diesen Parameter konnte die Tabelle das „+2" gar nicht kennen — das war der Fehler.
    expect(CELL).toContain("trainingDelta: number | null = null");
  });

  it("die Wert-Spalte rendert das Delta mit derselben Tonklasse wie die Achsen-Zeilen", () => {
    expect(CELL).toContain("getDeltaToneClass(trainingDelta)");
    expect(CELL).toContain('player-drawer-axis-discipline-forecast');
    // Vorzeichen ausgeschrieben, damit „+2" und „−2" ohne Nachdenken lesbar sind.
    expect(CELL).toContain('trainingDelta > 0 ? "+" : ""');
  });

  it("der Aufrufer reicht die Zahl aus derselben Quelle durch wie die Achsen-Zeilen", () => {
    expect(DRAWER).toContain("disciplineTrainingDeltaById[entry.id] ?? null");
  });

  it("verdeckte Spieler bekommen kein exaktes Delta — der Scouting-Zweig kehrt vorher zurueck", () => {
    // Die Reihenfolge IST die Absicherung: `isScoutedProfile` liefert die Klassen-Range und
    // verlaesst die Funktion, bevor der Zahlenblock ueberhaupt erreicht wird. Ein exaktes „+2"
    // wuerde das absichtlich unscharfe Klassen-Band aushebeln.
    const posScouted = CELL.indexOf("if (isScoutedProfile)");
    const posDelta = CELL.indexOf("getDeltaToneClass(trainingDelta)");
    expect(posScouted).toBeGreaterThan(-1);
    expect(posDelta).toBeGreaterThan(posScouted);
  });

  it("ohne Veraenderung steht dort nichts — keine geschriebene Null", () => {
    // `trainingDelta ? (…) : null` — 0 und null fallen beide heraus.
    expect(CELL).toContain("{trainingDelta ? (");
  });
});
