import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const DRAWER = readFileSync(join(REPO_ROOT, "app/foundation/PlayerDetailDrawer.tsx"), "utf8");
const DATA = readFileSync(join(REPO_ROOT, "lib/foundation/player-detail-drawer.ts"), "utf8");
const CSS = readFileSync(join(REPO_ROOT, "app/globals.css"), "utf8");

describe("Trainings-Forecast in den Diszi-Zeilen", () => {
  it("die Rechnung haengt am selben Forecast wie die Attribut-Tabelle", () => {
    expect(DATA).toContain("buildPlayerDisciplineTrainingForecast({");
    expect(DATA).toContain("forecast: seasonTrainingForecast,");
    expect(DATA).toContain("disciplineTrainingForecast,");
  });

  it("die Diszi-Zeile zeigt die projizierte Aenderung", () => {
    expect(DRAWER).toContain("disciplineTrainingDeltaById[entry.id]");
  });

  /**
   * Verdeckte Spieler zeigen statt der Zahl nur ein grobes Klassen-Band. Eine exakte projizierte
   * Aenderung daneben waere ein Leck: aus „Band C" plus „+2" laesst sich mehr ableiten, als der
   * Scouting-Stand hergibt. Deshalb haengt die Marke an `!foggedBand`, und die Zusammenfassung an
   * `!disciplineStatFogged`.
   */
  it("bleibt bei verdeckten Spielern aus", () => {
    const chip = DRAWER.slice(
      DRAWER.indexOf("player-drawer-axis-discipline-value"),
      DRAWER.indexOf("player-drawer-axis-discipline-progress"),
    );
    expect(chip).toContain("!foggedBand && disciplineTrainingDeltaById[entry.id]");

    const summary = DRAWER.slice(
      DRAWER.indexOf("<SeasonTrainingForecastSummary"),
      DRAWER.indexOf("data.trainingHistoryRows.length > 0"),
    );
    expect(summary).toContain("!disciplineStatFogged && movedTrainingDisciplines.length > 0");
  });

  it("die Zusammenfassung unter der Trainingshistorie ist auffindbar", () => {
    expect(DRAWER).toContain('data-testid="player-drawer-discipline-training-forecast"');
  });

  it("benennt die Annahme, statt eine Projektion wie eine Zusage aussehen zu lassen", () => {
    // Die anderen Spieler trainieren ebenfalls; ein Rang verschiebt sich nur relativ.
    // Ueber den zusammengefalteten Text geprueft — sonst haengt der Test am Zeilenumbruch und
    // reisst beim ersten Reformatieren, ohne dass sich an der Aussage etwas geaendert haette.
    const flattened = DRAWER.replace(/\s+/g, " ");
    expect(flattened).toContain("wenn sich bei den anderen Spielern nichts verschiebt");
  });

  it("Zuwachs und Rueckgang sind auch farblich unterscheidbar", () => {
    expect(CSS).toContain(".player-drawer-axis-discipline-forecast.is-positive");
    expect(CSS).toContain(".player-drawer-axis-discipline-forecast.is-negative");
    expect(CSS).toContain(".player-drawer-discipline-forecast-delta.is-positive");
    expect(CSS).toContain(".player-drawer-discipline-forecast-delta.is-negative");
  });
});
