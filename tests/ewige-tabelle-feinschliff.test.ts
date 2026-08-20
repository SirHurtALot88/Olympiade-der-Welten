/**
 * GEMELDET (Team-Audit, Paket T8): "Bei 1 archivierter Saison sind 'Ø Rang'
 * und 'Best' spaltenweise identisch — drei Spalten ohne Unterscheidungskraft"
 * (A1), "Der Cut bei 8+eigenes ist nicht beschriftet ('Top 8 nach Punkten'
 * fehlt als Caption)" (A2), "Medaillen-Spaltenköpfe sind nur Emoji — auf
 * Tooltips angewiesen" (A3). Dazu die Rückfrage, ob die Seite den frühen
 * Saisonzustand (1 archivierte Saison, laufende Saison fast leer) erklärt.
 *
 * Gegengeprüft (Playwright, echter Spielstand S-C, Season 2/Spieltag 1):
 * die "−0,0 Mio"-Formatierung, die der Auftrag ebenfalls nannte, trat NICHT
 * auf — `formatNlMoney`/`formatNlNumber` klemmen Beträge, die auf 0 runden,
 * schon vorher auf ein vorzeichenloses 0 (siehe `nl-format.ts`/`nl-tones.ts`).
 * Kein Fix nötig, hier nur als Negativ-Befund festgehalten (Kommentar, kein
 * Test) — falsches Grün wäre schlimmer als kein Test.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const MARKUP = quelle("app/foundation/all-time-table-v2/AllTimeTableNewLook.tsx");
const CSS = quelle("app/globals.css");
const NL_TABLE = quelle("components/foundation/new-look/NlTable.tsx");

describe("A1: Ø Rang und Best sind zusammengelegt, solange sie identisch wären", () => {
  it("bei <2 archivierten Saisons fällt 'Best' weg und 'Ø Rang' heißt schlicht 'Rang'", () => {
    expect(MARKUP).toContain("function getPointsColumns(archivedSeasonCount: number)");
    expect(MARKUP).toContain('if (archivedSeasonCount >= 2) {\n    return POINTS_COLUMNS_BASE;');
    expect(MARKUP).toContain('column.key !== "bestRank"');
    expect(MARKUP).toContain('label: "Rang",');
  });

  it("ab 2 archivierten Saisons kommen beide Spalten unverändert zurück (nichts wird dauerhaft versteckt)", () => {
    expect(MARKUP).toContain("return POINTS_COLUMNS_BASE;");
    expect(MARKUP).toContain('{ key: "bestRank", label: "Best"');
  });

  it("Kopf UND Caption ziehen die Spaltenliste aus derselben Quelle (activeColumns)", () => {
    // HIER STAND DER GANZE AUSDRUCK WÖRTLICH. Das hielt nicht die Zusage fest, sondern die
    // Schreibweise: der Reiter „Verlauf je Saison" (`lcmgxx`) brauchte einen dritten Zweig, und
    // der Test wurde rot, obwohl die EINE Quelle genau so blieb. Geprüft wird deshalb jetzt, was
    // gemeint war — es gibt genau eine Ableitung, und beide Verbraucher lesen sie.
    expect(MARKUP.match(/const activeColumns = useMemo\(/g) ?? []).toHaveLength(1);
    expect(MARKUP).toContain("getPointsColumns(model?.archivedSeasonCount ?? 0)");
    expect(MARKUP).toContain("columns={activeColumns}");
    expect(MARKUP).toContain("activeColumns.find((column) => column.key === sort.key)?.label");
  });
});

describe("A2: Die Verlauf-Caption nennt Ausschnitt UND aktuelles Sortierkriterium", () => {
  it("Caption unterscheidet 'Top N' (Ausschnitt) von 'Alle' (showAllCharts)", () => {
    expect(MARKUP).toContain("const chartCaption = showAllCharts");
    expect(MARKUP).toContain("`Alle ${formatNlNumber(sortedRows.length, 0)} Teams — sortiert nach ${chartSortLabel}");
    expect(MARKUP).toContain("`Top ${formatNlNumber(defaultChartRows.length, 0)} nach ${chartSortLabel}");
  });

  it("nennt die Sortierrichtung, wenn aufsteigend sortiert ist (sonst würde 'Top 8' das Gegenteil suggerieren)", () => {
    expect(MARKUP).toContain('sort.direction === "asc" ? " (aufsteigend)" : ""');
  });

  it("weist aus, wenn das eigene Team über den Cut hinaus ergänzt wurde", () => {
    expect(MARKUP).toContain("const ownRowAppended =");
    expect(MARKUP).toContain('ownRowAppended ? " · dein Team ergänzt" : ""');
  });

  it("die Caption steht im Markup vor dem Kachel-Grid und ist in globals.css definiert", () => {
    expect(MARKUP).toContain('<p className="nl-alltime-chart-caption">{chartCaption}</p>');
    const gridIndex = MARKUP.indexOf('<div className="nl-alltime-chart-grid">');
    const captionIndex = MARKUP.indexOf('<p className="nl-alltime-chart-caption">');
    expect(captionIndex).toBeGreaterThan(-1);
    expect(captionIndex).toBeLessThan(gridIndex);
    expect(CSS).toMatch(/\.nl-alltime-chart-caption[\s.,:{[>)]/);
  });
});

describe("A3: Spaltenköpfe mit reinem Emoji-Label bekommen ein aria-label über den Tooltip-Text", () => {
  it("NlTable gibt tooltip zusätzlich als aria-label weiter (additiv, kein Verhaltensbruch ohne tooltip)", () => {
    expect(NL_TABLE).toContain("aria-label={column.tooltip ? `${column.label} — ${column.tooltip}` : undefined}");
  });

  it("die Medaillen-Spalten tragen weiterhin ihre erklärenden Tooltips (Quelle für das neue aria-label)", () => {
    expect(MARKUP).toContain('{ key: "gold", label: "🥇"');
    expect(MARKUP).toContain("Gold — Anzahl 1. Plätze (Meistertitel)");
    expect(MARKUP).toContain('{ key: "silver", label: "🥈"');
    expect(MARKUP).toContain('{ key: "bronze", label: "🥉"');
  });
});

describe("Früher Saisonzustand wird im Kopf erklärt, nicht stillschweigend vorausgesetzt", () => {
  it("bei genau 1 archivierter Saison erklärt ein Zusatzsatz, dass 'Saisons' die laufende mitzählt", () => {
    expect(MARKUP).toContain("model.archivedSeasonCount === 1 ? (");
    expect(MARKUP).toContain("Aktuell ist erst eine Saison archiviert");
  });
});

describe("Eine Quelle pro Größe: activeColumns treibt Tabelle UND Caption, keine zweite Spaltenliste", () => {
  it("es gibt keine zweite Kopie von POINTS_COLUMNS_BASE/FOCUS_COLUMNS[focus] im Render-Pfad", () => {
    // Nur EIN Aufrufer von FOCUS_COLUMNS[focus …] im ganzen Modul — die Zuweisung in
    // activeColumns. Der Zugriff trägt seit dem Reiter „Verlauf je Saison" eine Typ-Einengung im
    // Index (`focus as Exclude<…>`), weil dieser Reiter seine Spalten aus dem Spielstand baut und
    // nicht aus der festen Tabelle; deshalb hier auf den Zugriff geprüft, nicht auf `[focus]`.
    const aufrufer = MARKUP.match(/FOCUS_COLUMNS\[focus\b/g) ?? [];
    expect(aufrufer.length).toBe(1);
  });
});
