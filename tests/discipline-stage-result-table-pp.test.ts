import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DisciplineStageResultTable, {
  type ResultTableRow,
} from "@/app/foundation/discipline-stage/arena/DisciplineStageResultTable";

/**
 * Task #102 (Chris, 13.10.): „bei allen Diszis fehlt am Ende noch wie viele PPs welcher
 * Spieler mit seiner Leistung erhalten hat!" — die Detail-Ergebnistabelle ist das geteilte
 * Chassis für ALLE zwanzig Disziplinen (`DisciplineStageNativeArena` rendert sie unconditional
 * nach jedem Durchgang, egal welches `StagePrimitive`), deshalb wird genau hier geprüft:
 *   • eine gewertete Zelle (pp != null) zeigt "X,X PP",
 *   • eine NICHT gewertete Zelle (pp == null, Anti-Spoiler / Modell-Modus ohne PP-Quelle)
 *     zeigt gar keine PP-Zeile statt einer erfundenen 0.
 */

function buildRow(overrides: Partial<ResultTableRow> = {}): ResultTableRow {
  return {
    rank: 1,
    code: "AAA",
    name: "Team A",
    logoUrl: null,
    isOwn: false,
    teamId: "t1",
    total: 10,
    slots: [
      {
        playerName: "Spieler Eins",
        playerId: "p1",
        net: 8,
        slotRank: 1,
        boniMali: 0,
        isBest: true,
        calc: "8 = 8",
        pp: 3.3,
      },
      {
        playerName: "Spieler Zwei",
        playerId: "p2",
        net: 2,
        slotRank: 2,
        boniMali: 0,
        isBest: false,
        calc: "2 = 2",
        pp: null,
      },
    ],
    ...overrides,
  };
}

// Die PP-Zeile hat eine eigene, sonst nirgends in der Tabelle vorkommende Stil-Signatur
// (10.5px/800/accent OHNE font-size:14px, das unterscheidet sie von der "Gesamt"-Zelle).
// Darüber zählen statt über den Text "PP" selbst — der taucht auch im Legenden-Satz auf
// ("PP = erhaltene Player-Points") und würde eine reine Text-Zählung verfälschen.
const PP_CELL_STYLE = 'style="font-size:10.5px;font-weight:800;color:var(--nl-accent)"';

function countPpCells(html: string): number {
  return html.split(PP_CELL_STYLE).length - 1;
}

describe("DisciplineStageResultTable zeigt erhaltene Player-Points je Spieler", () => {
  it("rendert 'X,X PP' für eine gewertete Zelle", () => {
    const html = renderToString(
      React.createElement(DisciplineStageResultTable, {
        rows: [buildRow()],
        slotLabels: ["Etappe 1", "Etappe 2"],
      }),
    );
    expect(countPpCells(html)).toBe(1);
    // React rendert `{fmt1(c.pp)} PP` mit einem Kommentarknoten zwischen den Kindern —
    // deshalb auf den Zahlenteil direkt vor diesem Knoten prüfen, nicht auf den vollen String.
    expect(html).toMatch(/3,3<!-- --> PP/);
  });

  it("zeigt KEINE PP-Zeile, solange der Slot noch nicht gewertet ist (pp == null)", () => {
    const html = renderToString(
      React.createElement(DisciplineStageResultTable, {
        rows: [buildRow()],
        slotLabels: ["Etappe 1", "Etappe 2"],
      }),
    );
    // Genau EINE PP-Zelle im gesamten Markup — vom gewerteten Slot, nicht vom unbewerteten.
    expect(countPpCells(html)).toBe(1);
    expect(html).not.toContain("null PP");
  });

  it("zeigt gar keine PP-Zeilen, wenn keiner der Slots eine PP-Zahl trägt (Modell-/Random-Modus)", () => {
    const row = buildRow({
      slots: [
        { playerName: "Spieler Eins", playerId: "p1", net: 8, slotRank: 1, boniMali: 0, isBest: true, calc: "8 = 8", pp: null },
        { playerName: "Spieler Zwei", playerId: "p2", net: 2, slotRank: 2, boniMali: 0, isBest: false, calc: "2 = 2", pp: null },
      ],
    });
    const html = renderToString(
      React.createElement(DisciplineStageResultTable, {
        rows: [row],
        slotLabels: ["Etappe 1", "Etappe 2"],
      }),
    );
    expect(countPpCells(html)).toBe(0);
  });

  it("zeigt den Legenden-Hinweis 'PP = erhaltene Player-Points'", () => {
    const html = renderToString(
      React.createElement(DisciplineStageResultTable, {
        rows: [buildRow()],
        slotLabels: ["Etappe 1", "Etappe 2"],
      }),
    );
    expect(html).toContain("PP = erhaltene Player-Points");
  });
});
