/**
 * S5 · Saisonstand-Feinschliff (Audit Spieltag).
 *
 * Fünf zusammenhängende Befunde, alle gegen den aktuellen Code nachgeprüft
 * (nicht gegen den alten Audit-Stand geraten):
 *
 * - S2 "doppelter Kopf": "Dein Team" stand im Kartenkopf UND 80px darunter
 *   noch einmal als eigene KPI-Zeile (`renderDatenKpis`, nur im Daten-Modus)
 *   — dieselben Zahlen doppelt. `renderDatenKpis` ist komplett entfernt, die
 *   einzige Zusatzgröße ("Rückstand auf #1") zog in den einen verbliebenen
 *   Kopf.
 * - S1 "Tabellen-Überlauf": `.nl-standings-table-shell` scrollte bereits
 *   (frühere Korrektur), aber ohne sichtbare Affordanz und ohne fixierte
 *   Team-Spalte — Rang/CASH/SPONSOREN liefen wortlos aus dem Rahmen.
 * - S3 "kryptisches Top-Spieler-Modul": zehn Kacheln zeigten nur Rang +
 *   Initialen-Kreis + rotes „—", weil `.nl-standings-daten-chartrow` vor
 *   Spieltag 1 (kein Chart) trotzdem die Chart-Spalte reservierte und dem
 *   Fünf-Spalten-Raster nur ~76px/Spalte ließ — die Namen-Spalte kollabierte
 *   auf 0px.
 * - S4 "farbige Nullen": POW/SPE/MEN/SOC zeigten `0` (Achsen-Ledger startet
 *   bei 0), während `Punkte` daneben ehrlich `—` zeigte (`row.points` ist
 *   `null` vor der ersten Wertung) — zwei Antworten auf dieselbe Frage.
 * - S6 "Board-Podium ohne Rangzahl": `NlMedalBadge` ohne `count` zeigt nur
 *   den Farbpunkt, keine Zahl.
 *
 * Test hält die Struktur-Aussagen fest UND dass jede neu benutzte CSS-Klasse
 * wirklich existiert (CSS fällt still durch — season-v2 hat sein CSS auf
 * ZWEI Dateien verteilt, `app/globals.css` und die co-lokierte
 * `season-standings-new-look.css`; der Test prüft beide).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const TSX = quelle("app/foundation/season-v2/SeasonStandingsNewLook.tsx");
const CSS = quelle("app/globals.css");
const CO_CSS = quelle("app/foundation/season-v2/season-standings-new-look.css");
const ALL_CSS = `${CSS}\n${CO_CSS}`;

describe("S2: 'Dein Team' steht nur noch einmal", () => {
  it("die zweite KPI-Zeile (renderDatenKpis) ist entfernt", () => {
    expect(TSX).not.toContain("function renderDatenKpis()");
    expect(TSX).not.toContain("nl-standings-daten-kpis");
  });

  it("der eine verbliebene Kopf trägt jetzt auch den Rückstand auf #1", () => {
    const start = TSX.indexOf('label="Dein Team" className="nl-standings-own-chips"');
    expect(start).toBeGreaterThan(-1);
    const block = TSX.slice(start, start + 1400);
    expect(block).toContain('label="Rang"');
    expect(block).toContain('label="Punkte"');
    expect(block).toContain('label="Rückstand auf #1"');
    expect(block).toContain('label="MW"');
  });
});

describe("S1: Tabellen-Überlauf hat jetzt eine Affordanz + fixierte Team-Spalte", () => {
  it("Team-Spalte ist sticky (kein Breiten-Ratespiel nötig)", () => {
    expect(CO_CSS).toMatch(/\.nl-standings-th-team,\s*\n\.is-new-look \.nl-standings-td-team \{/);
    expect(CO_CSS).toContain("position: sticky");
    expect(CO_CSS).toContain("left: 0");
  });

  it("Scroll-Schatten nur rechts (links deckt die sticky Spalte den Rand ohnehin ab)", () => {
    expect(CO_CSS).toContain("background-attachment: local, scroll");
  });
});

describe("S3: Top-Spieler-Grid bricht nicht mehr auf 0px zusammen", () => {
  it("die Chart-Zeile bekommt bei leerem Chart eine einzige volle Spalte", () => {
    expect(TSX).toContain('`nl-standings-daten-chartrow${datenChartHasData ? "" : " is-chart-empty"}`');
    expect(CO_CSS).toContain(".nl-standings-daten-chartrow.is-chart-empty");
    expect(CO_CSS).toMatch(/\.nl-standings-daten-chartrow\.is-chart-empty \{\s*\n\s*grid-template-columns: minmax\(0, 1fr\);/);
  });

  it("die PPs-Leerzeile erklärt sich im Tooltip, statt nur ein Strich zu sein", () => {
    expect(TSX).toContain("function buildTopPlayerTitle(");
    expect(TSX).toContain("PPs füllen sich ab Spieltag 1");
  });
});

describe("S4: eine Quelle für 'noch keine Saison-Wertung' (row.points), keine farbigen Nullen", () => {
  it("formatSeasonAreaValue liest row.points, keine zweite Bedingung", () => {
    expect(TSX).toContain("function formatSeasonAreaValue(row: SeasonV2StandingsRow, value: number | null, digits: number)");
    expect(TSX).toContain("if (row.points == null) {");
  });

  it("Daten-Tabelle, Board-Mini-Bars und Aufklapp-Gruppen nutzen den Helfer statt formatNlNumber direkt", () => {
    expect(TSX).toContain("{formatSeasonAreaValue(row, areaValue, 1)}");
    expect(TSX).toContain("formatSeasonAreaValue(row, value, 0)");
  });

  it("ohne Wertung bekommt die Achsen-Spalte auch keine Rang-Farbband-Hinterlegung", () => {
    expect(TSX).toContain('row.points == null ? "" : getAreaRankBandClass(');
  });
});

describe("S6: Board-Podium zeigt die Rangzahl, nicht nur die Medaillenfarbe", () => {
  it("Liste (Rang 1-3 innerhalb des scrollbaren Boards) hat eine sichtbare Zahl neben der Medaille", () => {
    const start = TSX.indexOf("function renderBoardRow(");
    const block = TSX.slice(start, start + 2400);
    expect(block).toContain("<NlMedalBadge kind={medalKind}");
    expect(block).toContain('<span className="nl-standings-ranknum nl-tnum">{row.rank}</span>');
  });

  it("die separaten Podium-Karten zeigen #1/#2/#3 explizit", () => {
    const start = TSX.indexOf("function renderPodium(");
    const block = TSX.slice(start, start + 2200);
    expect(block).toContain('<span className="nl-standings-podium-ranknum nl-tnum">#{index + 1}</span>');
    expect(ALL_CSS).toMatch(/\.nl-standings-podium-ranknum \{/);
  });
});

describe("S5 (Tab-Ebenen): die tote äußere Sidebar-Kopie ist weg", () => {
  it('kein FoundationSubNav mit "Datenansicht"/"Manager" mehr für seasonV2', () => {
    const shellRouterBody = quelle("app/foundation/FoundationShellRouterBody.tsx");
    expect(shellRouterBody).not.toContain('{ id: "table", label: "Datenansicht" }');
    expect(shellRouterBody).not.toContain('{ id: "gms", label: "Manager" }');
  });

  it("die einzige verbliebene Ansichts-Umschaltung ist Daten/Board/Vereine im Panel selbst", () => {
    expect(TSX).toContain('{ id: "daten", label: "Daten" }');
    expect(TSX).toContain('{ id: "board", label: "Board" }');
    expect(TSX).toContain('{ id: "vereine", label: "Vereine" }');
  });
});

describe("S7: 'Dein Team'-Label auf --nl-mut statt --nl-mut-2 (gemessen 3,60:1 → 6,67:1)", () => {
  it("die geteilte StatChipRow-Basisklasse bleibt unangetastet (kein Radius über die ganze App)", () => {
    expect(CSS).toContain(".is-new-look .nl-stat-chip-row-label {");
  });

  it("nur die Saisonstand-eigene Instanz bekommt die spezifischere Übersteuerung", () => {
    expect(CO_CSS).toContain(".nl-standings-own-chips.nl-stat-chip-row .nl-stat-chip-row-label");
    const start = CO_CSS.indexOf(".nl-standings-own-chips.nl-stat-chip-row .nl-stat-chip-row-label");
    const block = CO_CSS.slice(start, start + 120);
    expect(block).toContain("color: var(--nl-mut)");
    expect(block).not.toContain("--nl-mut-2");
  });
});
