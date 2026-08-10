/**
 * DIE TEUREN TEAMS MÜSSEN WISSEN, DASS SIE ÜBER DER LINIE STEHEN.
 *
 * GEMELDET VON CHRIS: „wissen die teuren teams denn zb beim verkaufen am ende der season dass sie
 * wie H-R und M-M stark über den aprons sind um ggf. zu reagieren und zu senken? weil sie müssen ja
 * im besten Falle drumherum arbeiten."
 *
 * Sie wussten es nicht: `ai-sell-decision-engine.ts` und `ai-composite-sell-score.ts` enthielten das
 * Wort „Apron" kein einziges Mal. Verkauft wurde aus Cash-Not oder sportlichen Gründen.
 *
 * DER ENTWURF WURDE GEGENGEPRÜFT, und die Prüfung fand einen Fehler, der ihn gekippt hätte — die
 * Auswahlschleife führt `projectedSalary` auf der ECHTEN Vertragssumme, der Apron bemisst die
 * geglättete. Am Spielstand gemessen kippt dieser Unterschied bei 3 von 5 Abbau-Teams das
 * Vorzeichen. Deshalb prüft diese Datei die Trennung der beiden Größen härter als alles andere.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  APRON_ABBAU_BAGATELLGRENZE,
  apronReliefFuerGehalt,
  type ApronAbbauZiel,
} from "@/lib/ai/apron-abbau-ziel";

/** Linien 100 / 125, Konjunkturhebel voll (f = 1,24 ⇒ k = 1) — die Sätze wirken unverkürzt. */
function ziel(over: Partial<ApronAbbauZiel> = {}): ApronAbbauZiel {
  return {
    teamId: "T",
    basis: 120,
    decke: 110,
    zielBasis: 110,
    ueberschuss: 10,
    reliefBisZiel: 8,
    line1: 100,
    line2: 125,
    salaryFactor: 1.24,
    ...over,
  };
}

describe("Was ein Abgang an Abgabe spart", () => {
  it("ohne Überschuss spart kein Verkauf etwas", () => {
    expect(apronReliefFuerGehalt(ziel({ ueberschuss: 0 }), 10)).toBe(0);
  });

  it("die Ersparnis ist gedeckelt: nur der Teil über der Zielbasis zählt", () => {
    // Basis 120, Ziel 110 — ein 30er Gehalt spart nicht mehr als ein 10er.
    const zehn = apronReliefFuerGehalt(ziel(), 10);
    const dreissig = apronReliefFuerGehalt(ziel(), 30);
    expect(zehn).toBeGreaterThan(0);
    expect(dreissig).toBe(zehn);
  });

  /**
   * DER FEHLER, DEN DIE KLEMME VERHINDERT: ohne sie erzeugte die Ersparnis Verkaufsdruck bis
   * hinunter zu Linie 1 — also in der Zone, die `resolveTeamApronSalaryCeiling` einem Titelanwärter
   * ausdrücklich zugesteht. Ein Ambition-9-Team gäbe Stars ab, um eine Abgabe zu vermeiden, für die
   * es sich bewusst entschieden hat.
   */
  it("unter der Decke wird nichts mehr gutgeschrieben — dort ist die Abgabe gewollt", () => {
    const anDerDecke = ziel({ basis: 110, ueberschuss: 0 });
    expect(apronReliefFuerGehalt(anDerDecke, 20)).toBe(0);
  });

  it("die mitlaufende Basis lässt den zweiten Verkauf weniger sparen als den ersten", () => {
    const z = ziel();
    const erster = apronReliefFuerGehalt(z, 5);
    const zweiter = apronReliefFuerGehalt(z, 5, z.basis - 5);
    expect(erster).toBeGreaterThan(0);
    expect(zweiter).toBeGreaterThan(0);
    const dritter = apronReliefFuerGehalt(z, 5, z.basis - 10);
    expect(dritter).toBe(0); // Ziel erreicht.
  });

  it("kein Gehalt, keine Ersparnis", () => {
    expect(apronReliefFuerGehalt(ziel(), 0)).toBe(0);
    expect(apronReliefFuerGehalt(ziel(), null)).toBe(0);
    expect(apronReliefFuerGehalt(ziel(), Number.NaN)).toBe(0);
  });
});

/**
 * DIE EMPFÄNGERKLIPPE. Ausgleich bekommt nur, wer STRENG unter Linie 1 liegt — ein Team GENAU auf
 * der Linie zahlt nichts UND bekommt nichts. Wer also exakt auf Linie 1 abbaut, verschenkt seinen
 * Anteil am Topf (im gemessenen Save 2,1). Bei Teams, deren Decke die 2. Linie ist, gibt es die
 * Klippe nicht: dort ist die Zone-1-Abgabe eingepreist.
 */
describe("Empfängerklippe an der 1. Linie", () => {
  const QUELLE = readFileSync(join(process.cwd(), "lib/ai/apron-abbau-ziel.ts"), "utf8");

  it("bei Decke = Linie 1 zielt das Team knapp DARUNTER", () => {
    expect(QUELLE).toContain("Math.abs(decke - lines.line1) < 0.001 ? decke - LINIEN_ABSTAND : decke");
  });

  it("die Abbruchbedingung vergleicht gegen die Zielbasis, nicht gegen die Decke", () => {
    const AUSWAHL = readFileSync(join(process.cwd(), "lib/ai/ai-composite-sell-score.ts"), "utf8");
    expect(AUSWAHL).toContain("projectedApronBase <= input.apronZiel.zielBasis");
  });
});

describe("Bagatellgrenze", () => {
  it("ein winziger Überschuss löst keinen Verkauf aus", () => {
    // Gemessen: Cold Steel läge 0,6 über seiner Decke. Bei einer Vorausschau auf den Linien der
    // Vorsaison ist der Schätzfehler dort grösser als der Nutzen.
    expect(APRON_ABBAU_BAGATELLGRENZE).toBe(2);
  });
});

/**
 * DER BEFUND AUS DER GEGENPRÜFUNG, und der Grund, warum diese Gruppe existiert: `projectedSalary`
 * in `selectCompositeSellCandidates` startet auf `team.salaryTotal`, das in
 * `ai-transfermarkt-sell-preview-service.ts` aus `resolvePlayerEconomyContract(...).salary`
 * summiert wird — der ECHTEN, front-/back-loadeten Rate. Der Apron bemisst die geglättete
 * (`expectedSalary`). Am Spielstand kippt der Unterschied bei 3 von 5 Abbau-Teams das Vorzeichen:
 * Cold Steel echt 63,6 gegen Decke 81,0 spränge nie an, obwohl geglättet 81,6 darüber liegt; Mayhem
 * Mavericks bekäme scheinbaren Überschuss 20,4 statt 6,8.
 */
describe("Zwei Gehaltsgrössen, zwei Zähler — und sie dürfen sich nicht berühren", () => {
  const AUSWAHL = readFileSync(join(process.cwd(), "lib/ai/ai-composite-sell-score.ts"), "utf8");
  const SCHLEIFE = AUSWAHL.slice(AUSWAHL.indexOf("export function selectCompositeSellCandidates"));

  it("die Apron-Basis läuft getrennt von der Cash-Gehaltssumme mit", () => {
    expect(SCHLEIFE).toContain("let projectedApronBase = input.apronZiel?.basis ?? 0;");
    expect(SCHLEIFE).toContain("let projectedSalary = input.teamSalaryTotal;");
  });

  it("die Apron-Basis sinkt um expectedSalary, die Cash-Summe um salary", () => {
    expect(SCHLEIFE).toContain("projectedApronBase - (entry.candidate.expectedSalary ?? 0)");
    expect(SCHLEIFE).toContain("projectedSalary - (entry.candidate.salary ?? 0)");
  });

  it("die Apron-Abbruchbedingung fasst projectedSalary NICHT an", () => {
    const bedingung = SCHLEIFE.slice(
      SCHLEIFE.indexOf("const istApronZielErreicht"),
      SCHLEIFE.indexOf("const isCashPressureResolved"),
    );
    expect(bedingung).toContain("projectedApronBase");
    expect(bedingung).not.toContain("projectedSalary");
  });

  it("beide Abbruchbedingungen müssen erfüllt sein, bevor die Auswahl endet", () => {
    expect(SCHLEIFE).toContain("isCashPressureResolved() &&\n      istApronZielErreicht() &&");
  });
});

describe("Die Bewertung misst am Erlös, nicht am Gehalt", () => {
  const QUELLE = readFileSync(join(process.cwd(), "lib/ai/ai-composite-sell-score.ts"), "utf8");

  it("die Komponente teilt die Ersparnis durch den Erlös", () => {
    expect(QUELLE).toContain("clamp01(apronReliefBetrag / Math.max(apronErloes, 1)) * weights.apronRelief");
  });

  it("ohne Abbau-Ziel bleibt die Komponente 0 — Bestandsverhalten unverändert", () => {
    expect(QUELLE).toContain("const apronReliefBetrag = input.apronZiel\n");
    expect(QUELLE).toContain("    : 0;");
  });

  it("alle vier Team-Profile tragen dasselbe Gewicht", () => {
    // Die Steuer hängt an der Lage des TEAMS zur Linie, nicht an seiner Verkaufsphilosophie.
    expect([...QUELLE.matchAll(/apronRelief: 12,/g)]).toHaveLength(4);
  });
});

describe("Der Begründungstext nennt den Zeitpunkt", () => {
  const PREVIEW = readFileSync(join(process.cwd(), "lib/ai/ai-transfermarkt-sell-preview-service.ts"), "utf8");
  const CODES = readFileSync(join(process.cwd(), "lib/ai/ai-transfer-reason-codes.ts"), "utf8");

  it("sagt NÄCHSTE Saison und Schätzung — beides ist die Wahrheit über den Zeitpunkt", () => {
    // Die Abrechnung ist beim Verkauf schon gebucht (sie läuft in `runSeasonCompletion`, das
    // Verkaufsfenster öffnet danach). Ohne die Jahreszahl im Satz liest sich die eben gezahlte
    // Abgabe wie ein Grund, den die KI ignoriert hat.
    expect(PREVIEW).toContain("senkt die Apron-Abgabe der naechsten Saison");
    expect(PREVIEW).toContain("Schaetzung auf den Linien dieser Saison");
  });

  it("der Grund hat einen eigenen Code und wird aus dem Text wiedererkannt", () => {
    expect(CODES).toContain('| "apron_levy_relief"');
    expect(CODES).toContain('{ code: "apron_levy_relief", patterns: ["senkt die Apron-Abgabe"] }');
  });
});

describe("Das Ziel wird einmal je Team gebaut", () => {
  const PLAN = readFileSync(join(process.cwd(), "lib/ai/ai-market-plan-preview-service.ts"), "utf8");

  it("nicht je Spieler — die Gehaltssumme läuft über alle Kader-Einträge", () => {
    const auswahl = PLAN.slice(PLAN.indexOf("function chooseSellCandidates("), PLAN.indexOf("function ergaenzeNotverkaeufe"));
    expect(auswahl).toContain("const apronZiel = buildApronAbbauZiel(gameState, team.teamId);");
    expect([...auswahl.matchAll(/buildApronAbbauZiel\(/g)]).toHaveLength(1);
  });

  it("die Notverkäufe bleiben unangetastet — der Apron ist kein Notfall", () => {
    const notfall = PLAN.slice(PLAN.indexOf("function ergaenzeNotverkaeufe"));
    expect(notfall).not.toContain("apron");
  });
});
