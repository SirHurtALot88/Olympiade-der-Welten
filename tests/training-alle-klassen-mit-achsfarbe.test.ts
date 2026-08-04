/**
 * GEMELDET VON CHRIS (Seite „Team · Training"): „ich würde gerne beim Training nicht nur die besten
 * 4 Klassen sehen, sondern alle! Und vllt kannst du die noch in der passenden Farbe einrahmen damit
 * man sie besser erkennt!"
 *
 * Die Klassen-Rangliste stand auf `limit: 4`. Damit war der Vergleich um das gebracht, wofür er da
 * ist: welche Klasse für DIESEN Spieler passt, sieht man erst, wenn auch die schlechten Optionen
 * danebenstehen — die vier besten sind bei ähnlichen Werten ohnehin austauschbar.
 *
 * Geprüft werden drei Regeln:
 *
 *  1. Die Rangliste ist nicht mehr auf vier Einträge beschnitten.
 *  2. Jede Zeile trägt die Achsfarbe ihrer Development-Route — aus denselben Tokens, die das Spiel
 *     auch sonst für POW/SPE/MEN/SOC benutzt. Keine erfundene fünfte Farbe für BALANCED/RECOVERY.
 *  3. Die aktive Klasse bleibt erkennbar. Bei zwölf gerahmten Zeilen ist das nicht selbstverständlich.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const VIEW = readFileSync(join(root, "app/foundation/training-compact/TrainingCompactNewLook.tsx"), "utf8");
const CSS = readFileSync(join(root, "app/globals.css"), "utf8");

/** Der Rumpf der Rangliste-Komponente — nur dort gilt die Regel. */
function rankingComponent() {
  const start = VIEW.indexOf("function NlTrainingClassRanking");
  expect(start, "NlTrainingClassRanking nicht gefunden").toBeGreaterThanOrEqual(0);
  const end = VIEW.indexOf("function NlTrainingPlayerCard", start);
  expect(end).toBeGreaterThan(start);
  return VIEW.slice(start, end);
}

describe("Die Trainingsklassen-Liste zeigt alle Klassen", () => {
  it("die Rangliste wird nicht mehr auf vier Eintraege beschnitten", () => {
    const component = rankingComponent();
    expect(component, "limit: 4 blendet die uebrigen Klassen wieder aus").not.toContain("limit: 4");
    expect(component).toContain("limit: 99");
  });

  it("die Ueberschrift verspricht nicht mehr nur die besten", () => {
    // Sonst sagt die Karte etwas anderes, als sie zeigt.
    const component = rankingComponent();
    expect(component).toContain("Alle Klassen");
    expect(component).not.toContain("Beste Klassen + deine aktuelle");
  });
});

describe("Jede Klasse traegt die Farbe ihrer Achse", () => {
  it("die vier Achsen bekommen ihren Ton, BALANCED und RECOVERY keinen", () => {
    const start = VIEW.indexOf("function classRankingRouteTone");
    const block = VIEW.slice(start, VIEW.indexOf("\n}", start));
    for (const [route, tone] of [
      ["POW", "nl-tone-pow"],
      ["SPE", "nl-tone-spe"],
      ["MEN", "nl-tone-men"],
      ["SOC", "nl-tone-soc"],
    ] as const) {
      expect(block, `${route} ohne Ton`).toContain(tone);
    }
    // Gegenprobe: keine erfundene fuenfte Farbe.
    expect(block).not.toContain("BALANCED");
    expect(block).not.toContain("RECOVERY");
  });

  it("die Zeile benutzt die Route des Eintrags, nicht die des Spielers", () => {
    // `entry.developmentRoute` ist die Route DIESER Klasse — `row` waere die des Spielers und
    // wuerde zwoelf gleichfarbige Zeilen ergeben.
    expect(rankingComponent()).toContain("classRankingRouteTone(entry.developmentRoute)");
  });

  it("es gibt eine Regel, die den Ton wirklich sichtbar macht", () => {
    expect(CSS).toContain(".nl-training-class-ranking-row.is-route-framed");
    expect(CSS).toMatch(/is-route-framed\s*\{[^}]*border-left:[^}]*var\(--nl-tone/);
  });
});

describe("Die aktive Klasse bleibt trotz Faerbung erkennbar", () => {
  it("is-current gewinnt gegen die Achsfarbe", () => {
    // Ohne diese Regel geht die aktive Zeile zwischen zwoelf gerahmten unter — genau der Grund,
    // warum die Liste vorher auf vier gekuerzt war.
    expect(CSS).toContain(".nl-training-class-ranking-row.is-route-framed.is-current");
  });

  it("die Karte markiert sie weiterhin als aktiv", () => {
    const component = rankingComponent();
    expect(component).toContain('entry.isCurrent ? " is-current" : ""');
    expect(component).toContain("aktiv");
  });
});
