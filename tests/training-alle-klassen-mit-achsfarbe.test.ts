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
 *  2. Jede Zeile trägt die KLASSENFARBE ihrer Klasse — aus denselben Tokens, die das Spiel auch
 *     sonst für POW/SPE/MEN/SOC benutzt.
 *
 * NACHGEMELDET VON CHRIS: „badass ist gelb". Stimmt, und die Zeile war rot. Gefärbt wurde nach der
 * Development-Route, also danach, welche Achse die Klasse TRAINIERT. Bei zehn der dreizehn Klassen
 * ist das dieselbe Farbe, bei Badass, Tactician und Templar nicht. Wiedererkannt wird eine Klasse
 * an ihrer Klassenfarbe — dieselbe, die Icon, Transfermarkt-Chip und Klassenfilter tragen.
 *  3. Die aktive Klasse bleibt erkennbar. Bei zwölf gerahmten Zeilen ist das nicht selbstverständlich.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getClassColorToken } from "@/app/foundation/classVisuals";
import { classNameToDevelopmentRoute } from "@/lib/training/organic-season-progression";

/** Klassenfarbe → Achston, wie ihn die Liste vergibt. */
const TONE_BY_COLOR: Record<string, string> = {
  red: "nl-tone-pow",
  green: "nl-tone-spe",
  blue: "nl-tone-men",
  yellow: "nl-tone-soc",
};

/** Development-Route → Achston, wie ihn die Liste VORHER vergab. */
const ROUTE_TONE: Record<string, string> = {
  POW: "nl-tone-pow",
  SPE: "nl-tone-spe",
  MEN: "nl-tone-men",
  SOC: "nl-tone-soc",
  BALANCED: "",
  RECOVERY: "",
};

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

describe("Jede Klasse traegt ihre Klassenfarbe", () => {
  it("bildet die vier Klassenfarben auf die vier Achstoene ab", () => {
    const start = VIEW.indexOf("const CLASS_COLOR_TONE");
    expect(start, "CLASS_COLOR_TONE nicht gefunden").toBeGreaterThanOrEqual(0);
    const block = VIEW.slice(start, VIEW.indexOf("};", start));
    for (const [farbe, tone] of [
      ["red", "nl-tone-pow"],
      ["green", "nl-tone-spe"],
      ["blue", "nl-tone-men"],
      ["yellow", "nl-tone-soc"],
    ] as const) {
      expect(block, `${farbe} ohne Ton`).toContain(tone);
    }
  });

  it("die Zeile faerbt nach der Klasse des Eintrags, nicht nach ihrer Trainings-Route", () => {
    // Genau hier sass der Fehler: `entry.developmentRoute` ist die trainierte ACHSE, nicht die
    // Farbe der Klasse. `entry.className` ist beides in einem — die Farbe kommt aus classVisuals.
    const component = rankingComponent();
    expect(component).toContain("classRankingClassTone(entry.className)");
    expect(component).not.toContain("classRankingRouteTone(entry.developmentRoute)");
  });

  it("Badass ist gelb — und Tactician und Templar bekommen ihre Farbe genauso", () => {
    // Die drei Klassen, bei denen Klassenfarbe und Trainings-Route auseinanderlaufen. Ohne den Fix
    // faerbt die Liste sie nach der Route: Badass rot, Tactician blau, Templar gelb.
    expect(getClassColorToken("Badass")).toBe("yellow");
    expect(classNameToDevelopmentRoute("Badass")).toBe("POW");

    expect(getClassColorToken("Tactician")).toBe("yellow");
    expect(classNameToDevelopmentRoute("Tactician")).toBe("MEN");

    expect(getClassColorToken("Templar")).toBe("blue");
    expect(classNameToDevelopmentRoute("Templar")).toBe("SOC");

    // Und bei den uebrigen zehn aendert die Umstellung nichts.
    for (const [klasse, farbe] of [
      ["Berserker", "red"],
      ["Warlord", "red"],
      ["Tank", "red"],
      ["Sprinter", "green"],
      ["Rogue", "green"],
      ["Charger", "green"],
      ["Mage", "blue"],
      ["Overseer", "blue"],
      ["Bard", "yellow"],
      ["Hero", "yellow"],
    ] as const) {
      expect(getClassColorToken(klasse), klasse).toBe(farbe);
      expect(TONE_BY_COLOR[farbe], klasse).toBe(ROUTE_TONE[classNameToDevelopmentRoute(klasse)]);
    }
  });

  it("die Trainings-Route bleibt als Spiellogik unangetastet", () => {
    // Sie steuert den Route-Bonus. Eine Farbe umzustellen darf daran nichts aendern.
    expect(classNameToDevelopmentRoute("Badass")).toBe("POW");
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
