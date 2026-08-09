/**
 * GEMELDET VON CHRIS: „hier in der trainingshistorie soll nicht nur training gezeigt werden
 * sondern auch die verbesserung durch performance!"
 *
 * BEFUND: Die Rohdaten waren längst da — `buildOrganicSeasonProgression` liefert je Attribut
 * `training`, `spillover`, `performance` und `regression` getrennt zurück. Der Forecast hat sie
 * aber saldiert (`entry.delta`) und die Tabelle im Drawer zeigte genau EINE Zeile. Jeder Zuwachs
 * las sich damit als Erfolg des Trainingsplans, obwohl ein Teil davon schlicht daher kam, dass
 * der Spieler gespielt hat.
 *
 * Neu: Der Forecast reicht die Herkunft je Attribut durch, die Tabelle zeigt vier Zeilen
 * (Σ / Training / Leistung / Alterung).
 *
 * Warum Quelltext-Prüfungen: Das Projekt fährt vitest ohne jsdom; für die Tabelle im Drawer gibt
 * es keinen Render-Pfad ohne den kompletten GameState. Geprüft wird deshalb der Vertrag zwischen
 * Projektion, Forecast und Tabelle.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const forecast = readFileSync(join(root, "lib/foundation/player-matchday-training-history.ts"), "utf8");
const drawer = readFileSync(join(root, "app/foundation/PlayerDetailDrawer.tsx"), "utf8");
const progression = readFileSync(join(root, "lib/training/organic-season-progression.ts"), "utf8");
const applyService = readFileSync(join(root, "lib/progression/season-end-xp-apply-service.ts"), "utf8");
const typen = readFileSync(join(root, "lib/data/olyDataTypes.ts"), "utf8");

describe("Trainingshistorie · Herkunft je Attribut", () => {
  it("führt Training, Leistung und Alterung getrennt im Forecast-Zellentyp", () => {
    const zellTyp = forecast.slice(
      forecast.indexOf("export type PlayerSeasonTrainingForecastCell"),
      forecast.indexOf("export type PlayerSeasonTrainingForecast ="),
    );
    expect(zellTyp).toMatch(/training: number/);
    expect(zellTyp).toMatch(/performance: number/);
    expect(zellTyp).toMatch(/regression: number/);
  });

  it("zählt den Spillover zum Training, nicht als eigene Quelle", () => {
    // Spillover IST Trainingsbudget — nur auf die nicht fokussierten Attribute umgeleitet.
    // Als vierte Zeile stünde er nur im Weg.
    expect(forecast).toContain("(entry.training ?? 0) + (entry.spillover ?? 0)");
  });

  it("liest die Herkunft aus derselben Projektion wie den Saldo", () => {
    // Würden die Posten woanders herkommen, könnten sie sich von der Σ-Zeile lösen.
    const schleife = forecast.slice(
      forecast.indexOf("for (const entry of projection.attributeBreakdown)"),
    );
    expect(schleife).toMatch(/cumulativeByAttr\[entry\.attribute\] = entry\.delta/);
    expect(schleife).toMatch(/performanceByAttr\[entry\.attribute\] = entry\.performance/);
    expect(schleife).toMatch(/regressionByAttr\[entry\.attribute\] = entry\.regression/);
  });
});

describe("Trainingshistorie · die Posten ergeben den Saldo", () => {
  it("die Projektion setzt Delta aus genau diesen vier Posten zusammen", () => {
    // Der Vertrag, auf dem die Tabelle steht. Ändert sich hier die Formel, muss die
    // Aufschlüsselung nachziehen — sonst summieren sich die Zeilen nicht mehr zur Σ-Zeile.
    expect(progression).toContain("entry.regression + entry.training + entry.spillover + entry.performance");
  });

  it("die Alterung ist der einzige negative Posten", () => {
    expect(progression).toMatch(/const regression =\s*-\(ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE/);
  });
});

describe("Trainingshistorie · die Tabelle zeigt die Herkunft", () => {
  it("rendert vier Zeilen statt einer", () => {
    const zeilen = drawer.slice(
      drawer.indexOf("const SEASON_TRAINING_FORECAST_ROWS"),
      drawer.indexOf("function SeasonTrainingForecastSummary"),
    );
    for (const key of ["total", "training", "performance", "regression"]) {
      expect(zeilen).toContain(`key: "${key}"`);
    }
    expect(zeilen).toContain('label: "Leistung"');
    expect(zeilen).toContain('label: "Alterung"');
  });

  it("nimmt die Zellwerte aus den neuen Feldern", () => {
    const zeilen = drawer.slice(
      drawer.indexOf("const SEASON_TRAINING_FORECAST_ROWS"),
      drawer.indexOf("function SeasonTrainingForecastSummary"),
    );
    expect(zeilen).toContain("cell.training");
    expect(zeilen).toContain("cell.performance");
    expect(zeilen).toContain("cell.regression");
  });

  it("zählt in der Training-Summe den Spillover mit", () => {
    // Sonst wäre die Σ-Spalte der Trainingszeile kleiner als die Summe ihrer eigenen Zellen.
    expect(drawer).toContain("forecast.trainingTotal + forecast.spilloverTotal");
  });

  it("beschriftet jede Zeile als Zeilenkopf", () => {
    expect(drawer).toContain('<th scope="row" className="player-drawer-training-origin-label"');
  });

  it("nennt die Leistung auch in der Bildunterschrift", () => {
    const bildunterschrift = drawer.slice(
      drawer.indexOf("Saison-Forecast: kumulierte projizierte Attributänderung"),
    );
    expect(bildunterschrift.slice(0, 900)).toContain("Leistung");
  });
});

/**
 * Zweiter Teil derselben Meldung: „auch in der historie weil dort in der spieler ansicht steht es
 * auch nicht im tooltipp - gesamtwert ist ok sollte aber dann im tooltipp wenigstens gesplittet
 * ausgewiesen werden."
 *
 * Die abgeschlossenen Saisons stehen in der Trainingshistorie-Tabelle. Die Aufteilung war dort
 * doppelt verloren: je Attribut wurde sie nie in den Spielstand geschrieben (nur `fromValue`/
 * `toValue`), und die Saison-Summen lagen zwar in `organicMeta`, wurden aber nirgends angezeigt.
 */
describe("Trainingshistorie · abgeschlossene Saisons zeigen die Herkunft im Tooltip", () => {
  it("schreibt die Herkunft je Attribut in den Spielstand", () => {
    const zweig = applyService.slice(
      applyService.indexOf("plannedUpgrades.push("),
      applyService.indexOf("plannedUpgrades.push(") + 900,
    );
    expect(zweig).toContain("originTraining: entry.training");
    expect(zweig).toContain("originSpillover: entry.spillover");
    expect(zweig).toContain("originPerformance: entry.performance");
    expect(zweig).toContain("originRegression: entry.regression");
  });

  it("hält die neuen Felder optional", () => {
    // Sonst wären alle bestehenden Spielstände typwidrig — die Felder gibt es dort nicht
    // und lassen sich auch nicht nachrechnen.
    const upgradeTyp = typen.slice(
      typen.indexOf("export type PlayerProgressionSpendUpgradeRecord"),
      typen.indexOf("export type PlayerProgressionEconomySnapshot"),
    );
    expect(upgradeTyp).toContain("originTraining?: number");
    expect(upgradeTyp).toContain("originPerformance?: number");
  });

  it("reicht die Herkunft in die Historienzeilen durch, mit null für Altsaisons", () => {
    const historie = readFileSync(join(root, "lib/foundation/player-training-history.ts"), "utf8");
    expect(historie).toContain("const hatHerkunft =");
    expect(historie).toContain("hatHerkunft ? Number((upgrade.originPerformance ?? 0).toFixed(1)) : null");
    // Spillover zählt auch hier zum Training, damit Forecast und Historie dasselbe meinen.
    expect(historie).toContain("(upgrade.originTraining ?? 0) + (upgrade.originSpillover ?? 0)");
  });

  it("splittet den Netto-Wert der Saison im Tooltip", () => {
    expect(drawer).toContain("title={formatTrainingOriginSeasonTooltip(row)}");
    const helfer = drawer.slice(
      drawer.indexOf("function formatTrainingOriginSeasonTooltip"),
      drawer.indexOf("function formatTrainingOriginAttributeTooltip"),
    );
    expect(helfer).toContain("Training ${formatSignedOrigin(training)}");
    expect(helfer).toContain("+ Leistung ${formatSignedOrigin(performance)}");
    // Die Alterung steht im Save nicht als Saison-Summe — sie ist der Rest auf Netto.
    expect(helfer).toContain("row.netSetpoints - (training ?? 0) - (performance ?? 0)");
  });

  it("splittet auch die Attributzelle und sagt es, wenn die Daten fehlen", () => {
    expect(drawer).toContain("title={formatTrainingOriginAttributeTooltip(attribute, upgrade, row)}");
    const helfer = drawer.slice(drawer.indexOf("function formatTrainingOriginAttributeTooltip"));
    expect(helfer.slice(0, 1400)).toContain("Leistung ${formatSignedOrigin(upgrade.performance)}");
    // Eine leere Angabe wäre schlechter als der ehrliche Hinweis auf die Saison-Summen.
    expect(helfer.slice(0, 1400)).toContain("Saison-Summen");
  });
});
