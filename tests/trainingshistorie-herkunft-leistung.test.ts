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

/**
 * Seit der Saison-Listen-Überarbeitung (WUNSCH VON CHRIS: „das müsste wo die summe steht pro
 * season sein und dann ausklappbar dass man training leistung regression sehen kann") stehen
 * die drei Posten nicht mehr als vier feste Zeilen der laufenden Saison, sondern als
 * aufklappbare Herkunfts-Zeilen unter JEDER Saison-Summenzeile. Der Vertrag bleibt derselbe:
 * die Herkunft wird gezeigt, nicht saldiert versteckt.
 */
describe("Trainingshistorie · die Saison-Liste zeigt die Herkunft", () => {
  it("führt die drei Posten als aufklappbare Zeilen unter der Saison-Summenzeile", () => {
    const zeilen = drawer.slice(
      drawer.indexOf("const SEASON_TRAINING_ORIGIN_ROWS"),
      drawer.indexOf("function formatSeasonNetTotal"),
    );
    for (const key of ["training", "performance", "regression"]) {
      expect(zeilen).toContain(`key: "${key}"`);
    }
    expect(zeilen).toContain('label: "Leistung"');
    expect(zeilen).toContain('label: "Alterung"');
    // Die Summenzeile selbst bleibt die Hauptsache (eine je Saison, data-row="total").
    expect(drawer).toContain('<tr data-row="total" data-testid="player-drawer-training-season-row">');
    expect(drawer).toContain("SEASON_TRAINING_ORIGIN_ROWS.map(");
  });

  it("nimmt die Zellwerte aus den Herkunfts-Feldern", () => {
    const zeilen = drawer.slice(
      drawer.indexOf("const SEASON_TRAINING_ORIGIN_ROWS"),
      drawer.indexOf("function formatSeasonNetTotal"),
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
    const bildunterschrift = drawer.slice(drawer.indexOf("Eine Zeile je Saison:"));
    expect(bildunterschrift.slice(0, 900)).toContain("Leistung");
  });

  it("hält Prognose und gebuchte Werte auseinander", () => {
    // Die laufende Saison ist eine Hochrechnung, abgeschlossene Saisons sind Tatsachen —
    // beide stehen in derselben Liste und tragen deshalb ein Status-Badge.
    expect(drawer).toContain("player-drawer-training-season-badge");
    const flattened = drawer.replace(/\s+/g, " ");
    expect(flattened).toContain("? `Prognose ${entry.matchdaysPlayed}/${entry.totalMatchdays}` : \"gebucht\"");
    // Ist die Saison bereits gebucht, fällt ihre Prognose weg statt daneben zu stehen.
    expect(drawer).toContain("!bookedSeasonIds.has(input.forecast.seasonId)");
  });
});

/**
 * Zweiter Teil derselben Meldung: „auch in der historie weil dort in der spieler ansicht steht es
 * auch nicht im tooltipp - gesamtwert ist ok sollte aber dann im tooltipp wenigstens gesplittet
 * ausgewiesen werden."
 *
 * Die abgeschlossenen Saisons stehen inzwischen in derselben Saison-Liste. Die Aufteilung war
 * doppelt verloren: je Attribut wurde sie vor #470 nie in den Spielstand geschrieben (nur
 * `fromValue`/`toValue`), und die Saison-Summen lagen zwar in `organicMeta`, wurden aber
 * nirgends angezeigt. Heute stehen die Saison-Summen in den aufklappbaren Herkunfts-Zeilen;
 * fehlt die Aufteilung je Attribut, sagt die Zeile es, statt Zahlen zu erfinden.
 */
describe("Trainingshistorie · abgeschlossene Saisons zeigen die Herkunft beim Aufklappen", () => {
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

  it("liest die Saison-Summen aus organicMeta und leitet die Alterung als Rest auf Netto ab", () => {
    // Vorher stand der Split nur im Tooltip — jetzt sind es die sichtbaren Herkunfts-Zeilen.
    // Die Quelle ist unverändert: `organicMeta` über die Historienzeilen; die Alterung steht
    // im Save nicht als Saison-Summe und bleibt der Rest auf Netto.
    const builder = drawer.slice(
      drawer.indexOf("function buildTrainingSeasonEntries"),
      drawer.indexOf("const SEASON_TRAINING_ORIGIN_ROWS"),
    );
    expect(builder).toContain("const training = row.trainingSetpoints");
    expect(builder).toContain("const performance = row.performanceSetpoints");
    expect(builder).toContain("row.netSetpoints - (training ?? 0) - (performance ?? 0)");
  });

  it("sagt es, wenn die Aufteilung je Attribut fehlt, statt Zahlen zu erfinden", () => {
    // Für Saisons, die vor der Herkunfts-Mitschrift abgeschlossen wurden, gibt es die
    // Aufteilung je Attribut nicht — die aufgeklappte Saison sagt das an Ort und Stelle.
    expect(drawer).toContain("player-drawer-training-origin-missing");
    const flattened = drawer.replace(/\s+/g, " ");
    expect(flattened).toContain("Aufteilung je Attribut wurde für diese Saison nicht festgehalten");
    // Und fehlen sogar die Saison-Summen, wird auch das gesagt statt geraten.
    expect(flattened).toContain("wurde beim Abschluss dieser Saison nicht festgehalten");
  });
});
