import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * Die Trainingsseite zeigte nur die Prognose auf die VOLLE Saison. Wie viel ein
 * Spieler bis heute tatsächlich eingebracht hat, stand nirgends — obwohl die
 * Rohdaten (Trainings-Budget je Spieltag, Performance-Fenster) längst pro
 * Spieltag persistiert sind und `buildPlayerSeasonTrainingForecast` sie bereits
 * auswertet.
 */
describe("Training: bisher aufgelaufene SP", () => {
  it("weist die Herkunft des aufgelaufenen Plus aus (Training/Spillover/Performance/Regression)", () => {
    const historyText = read("lib/foundation/player-matchday-training-history.ts");

    expect(historyText).toContain("trainingTotal: number;");
    expect(historyText).toContain("spilloverTotal: number;");
    expect(historyText).toContain("performanceTotal: number;");
    expect(historyText).toContain("regressionTotal: number;");
    expect(historyText).toContain("totalMatchdays: number;");

    // Die Summen kommen aus derselben Projektion wie `netCumulative` — kein
    // zweiter Rechenweg, nur unsaldiert.
    expect(historyText).toContain("for (const entry of projection.attributeBreakdown) {");
    expect(historyText).toContain("trainingTotal += entry.training ?? 0;");
    expect(historyText).toContain("performanceTotal += entry.performance ?? 0;");
  });

  it("reicht den Stand dort an die Zeile durch, wo GameState und Spieler vorliegen", () => {
    const derivationsText = read("lib/foundation/tabs/use-training-panel-derivations.ts");

    expect(derivationsText).toContain("buildPlayerSeasonTrainingForecast");
    expect(derivationsText).toContain("seasonSoFar:");
    // Ohne passenden Spieler im Save bleibt das Feld leer statt geschätzt.
    expect(derivationsText).toContain("const soFar = fullPlayer");

    // Der Zeilen-Builder selbst erfindet nichts — er kennt den vollen Player nicht.
    const rowViewText = read("lib/foundation/training-player-row-view.ts");
    expect(rowViewText).toContain("seasonSoFar: null,");
  });

  it("zeigt die Zeile in der Trainingsansicht neben der Prognose", () => {
    const trainingText = read("app/foundation/training-compact/TrainingCompactNewLook.tsx");

    expect(trainingText).toContain('data-testid="nl-training-sofar"');
    expect(trainingText).toContain("row.seasonSoFar.netCumulative");
    expect(trainingText).toContain("row.seasonSoFar.performanceTotal");
    expect(trainingText).toContain("row.seasonSoFar.matchdaysPlayed");
    // Ohne gespielten Spieltag gibt es nichts zu zeigen — dann bleibt die Zeile weg.
    expect(trainingText).toContain("{row.seasonSoFar ? (");

    // Die bestehende Forecast-Zeile bleibt daneben stehen: Prognose und Ist
    // sind zwei verschiedene Aussagen.
    expect(trainingText).toContain("row.organicForecast.trainingSetpoints");
  });
});
