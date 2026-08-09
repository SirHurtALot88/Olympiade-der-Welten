/**
 * T5 · Training als Steuer-Tabelle (Audit TR1–TR6, Mockup trainingCompact.html;
 * Chris: „Training ist deutlich übersichtlicher!").
 *
 * Der Umbau: eine Zeile pro Spieler mit der TÄGLICHEN Entscheidung (Intensität als
 * Segment) vorn, die 13er-Klassenliste nur auf Aufklappen, EINE KPI-Zeile, deren
 * Ist-Zahlen die Team-Modus-Vorschau live ersetzt (Marke „Simulation"), und der
 * Schein-Unterreiter „Forecast" ist weg.
 *
 * Der Test hält beides fest: (a) jede Klasse, auf die das Markup zielt, existiert
 * in globals.css (CSS-Klassen fallen still durch), und (b) die tragenden
 * Strukturaussagen des Umbaus als String-Assertions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const MARKUP = quelle("app/foundation/training-compact/TrainingCompactNewLook.tsx");
const SHARED = quelle("app/foundation/training-facilities-v2/training-view-shared.tsx");
const ROUTER = quelle("app/foundation/FoundationShellRouterBody.tsx");
const CSS = quelle("app/globals.css");

describe("Jede im Markup benutzte nl-training-Klasse existiert in globals.css", () => {
  const tokens = new Set<string>();
  for (const match of MARKUP.matchAll(/nl-training[a-z0-9-]*(?<!-)/g)) {
    tokens.add(match[0]);
  }
  // data-testids sind keine Klassen — sie haben bewusst kein CSS.
  for (const testid of [
    "nl-training-class-attr-preview",
    "nl-training-forecast-bars",
    "nl-training-player-detail",
    "nl-training-player-row",
  ]) {
    tokens.delete(testid);
  }
  // Marker-Klasse an der geteilten NlAbilityStars-Instanz (Styling kommt aus
  // der Komponente selbst) — kein eigenes CSS nötig.
  tokens.delete("nl-training-player-stars");

  it.each([...tokens].sort())("%s ist in globals.css definiert", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
  });

  it("die Ton-Varianten der Chips/Badges existieren beidseitig", () => {
    for (const variante of [
      ".nl-training-row-seg-btn.is-current",
      ".nl-training-row-seg-btn.is-demand",
      ".nl-training-row-netbar-fill.is-good",
      ".nl-training-row-netbar-fill.is-risk",
      ".nl-training-chip.is-neutral",
      ".nl-training-player-badge.is-growth",
      ".nl-training-player-badge.is-regression",
    ]) {
      expect(CSS).toContain(variante);
    }
  });
});

describe("TR1 — Steuer-Tabelle statt Kartenwand", () => {
  it("eine echte Tabelle mit einer Zeile pro Spieler, im eigenen Scroll-Container", () => {
    expect(MARKUP).toContain('data-testid="nl-training-table"');
    expect(MARKUP).toContain('<table className="nl-training-table"');
    expect(MARKUP).toContain('className="nl-training-table-scroll"');
    expect(CSS).toMatch(/\.nl-training-table-scroll\s*\{[^}]*overflow-x:\s*auto/);
  });

  it("die Intensität — die tägliche Entscheidung — sitzt direkt in der Zeile", () => {
    expect(MARKUP).toContain('className="nl-training-row-modes"');
    expect(MARKUP).toContain("onSetTrainingMode(row.player.id, entry.mode as PlayerTrainingMode)");
  });

  it("die 13er-Klassenliste rendert nur in der aufgeklappten Detail-Zeile", () => {
    // Ranking-Aufruf ausschließlich in NlTrainingPlayerCard (Detail), das nur bei expanded gerendert wird.
    expect(MARKUP).toMatch(/\{expanded \? \(\s*<tr className="nl-training-detail-row"/);
    const kartenRumpf = MARKUP.slice(MARKUP.indexOf("function NlTrainingPlayerCard"), MARKUP.indexOf("const MODE_SHORT_LABEL"));
    expect(kartenRumpf).toContain("<NlTrainingClassRanking");
  });

  it("der Aufklapper benennt, was er öffnet (alle Klassen), statt eines nackten Pfeils", () => {
    expect(MARKUP).toContain("Alle {trainingClassOptions.length} Klassen");
  });
});

describe("TR3 — EINE KPI-Zeile, Simulation sichtbar markiert", () => {
  it("die zweite KPI-Reihe (What-if-Slider) ist weg", () => {
    expect(MARKUP).not.toContain("NlWhatIfSlider");
    expect(MARKUP).not.toContain("What-if: Team auf einen Modus ziehen");
  });

  it("die Simulation ersetzt die Ist-Zahlen live und trägt eine sichtbare Marke", () => {
    expect(MARKUP).toContain('data-testid="training-simulation-flag"');
    expect(MARKUP).toContain("nichts übernommen");
    expect(MARKUP).toContain("const displayKpis = simulated");
  });

  it("Ist und Simulation sprechen dieselbe Semantik (angewendetes Training, Decke als Residuum)", () => {
    expect(MARKUP).toContain("training: simulated.appliedTrainingGain");
    expect(MARKUP).toContain(
      "ceiling: simulated.net - (simulated.performanceGain + simulated.appliedTrainingGain + simulated.regression)",
    );
    expect(SHARED).toContain("appliedTrainingGain: roundTo(appliedTraining, 1)");
  });

  it("die Team-Rail simuliert nur — geschrieben wird ausschließlich über Übernehmen", () => {
    // Rail-onSelect setzt den Simulationszustand …
    expect(MARKUP).toContain("setSimulationMode(value === uniformTeamMode ? null : (value as PlayerTrainingMode))");
    // … und genau EINE Stelle schreibt für alle Spieler (applySimulation).
    const massenschreiber = MARKUP.match(/for \(const row of playerRows\) \{\s*onSetTrainingMode\(/g) ?? [];
    expect(massenschreiber).toHaveLength(1);
    expect(MARKUP).toContain("const applySimulation = () => {");
  });
});

describe("TR2 — die Herleitung (Wie kommt das zustande?) ist ein Info-Link, kein Primärknopf ×8", () => {
  it("die Herleitung lebt in der Detail-Zeile und ist dort als Link gestylt", () => {
    expect(MARKUP).toContain("<TrainingBudgetBreakdownDisclosure row={row} />");
    const regel = CSS.match(
      /\.is-new-look \.nl-training-detail \.training-budget-breakdown-head \.secondary-button\s*\{[^}]*\}/,
    );
    expect(regel, "Link-Restyle-Regel fehlt in globals.css").not.toBeNull();
    expect(regel![0]).toContain("background: none");
    expect(regel![0]).toContain("var(--nl-accent-text)");
  });
});

describe("TR4 — der Schein-Unterreiter Forecast ist konsolidiert", () => {
  it("trainingCompact rendert keine Steuerung/Forecast-Subnav mehr", () => {
    expect(ROUTER).not.toContain('{ id: "forecast", label: "Forecast" }');
  });
});

describe("TR5/TR6 + T6 — Farben mit Bedeutung, Vorschau ohne zweite Formel", () => {
  it("der aktive Intensitäts-Modus ist eine gefüllte Fläche (Akzent-Fill + Akzent-Ink), kein dünner Rahmen", () => {
    const regel = CSS.match(/\.is-new-look \.nl-training-row-seg-btn\.is-current\s*\{[^}]*\}/);
    expect(regel).not.toBeNull();
    expect(regel![0]).toContain("var(--nl-accent-fill)");
    expect(regel![0]).toContain("var(--nl-accent-ink)");
  });

  it("der Bestwert der Klassenliste trägt Gold (Muster-2-Rangskala), nie die Teamfarbe", () => {
    expect(MARKUP).toContain('entry.rank === 1 ? " is-top" : ""');
    const regel = CSS.match(/\.is-new-look \.nl-training-class-ranking-row\.is-top [^{]*\{[^}]*\}/);
    expect(regel).not.toBeNull();
    expect(regel![0]).toContain("var(--nl-gold)");
  });

  it("die Klassen-Werte sind neutral — kein pauschales Grün für auch negative Netto-Werte", () => {
    const regel = CSS.match(/\.is-new-look \.nl-training-class-ranking-value\s*\{[^}]*\}/);
    expect(regel).not.toBeNull();
    expect(regel![0]).toContain("color: var(--nl-ink)");
    expect(regel![0]).not.toContain("--nl-good");
  });

  it("die Klassen-Stat-Vorschau (T6) hängt an der Rangliste und bleibt einfarbig", () => {
    const ranking = MARKUP.slice(
      MARKUP.indexOf("function NlTrainingClassRanking"),
      MARKUP.indexOf("function NlTrainingPlayerCard"),
    );
    expect(ranking).toContain("<NlTrainingClassAttributePreview");
    expect(MARKUP).toContain('data-testid="nl-training-class-attr-preview"');
    // Einfarbig: die Tag-Regel färbt mit --nl-mut, nicht mit Achs- oder good/risk-Tönen.
    const regel = CSS.match(/\.is-new-look \.nl-training-class-attr-tag\s*\{[^}]*\}/);
    expect(regel).not.toBeNull();
    expect(regel![0]).toContain("var(--nl-mut)");
    expect(regel![0]).not.toContain("--nl-tone");
    expect(regel![0]).not.toContain("--nl-good");
  });

  it("die Vorschau sagt ausdrücklich, dass sie eine Schätzung ist", () => {
    expect(MARKUP).toContain("Schätzung, keine Garantie");
  });

  it("der Klassen-Vorschlag der Zeile kommt aus DERSELBEN Rangliste wie die Detail-Liste", () => {
    expect(MARKUP).toContain("const bestClass = ranking.find((entry) => entry.rank === 1)");
    // Kein eigener Signature-Fit-Zweitweg mehr für den Chip.
    expect(MARKUP).not.toContain("buildTrainingClassSuggestion");
  });

  it("bei 0 wird erklärt, nicht versteckt: ohne klaren Wechsel begründet der Chip das", () => {
    expect(MARKUP).toContain("Wechsel lohnt aktuell nicht");
  });
});
