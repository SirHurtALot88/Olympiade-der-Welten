import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DisciplineStageResultTable, { type ResultTableRow } from "@/app/foundation/discipline-stage/arena/DisciplineStageResultTable";
import DisciplineStageSpieltagswertung from "@/app/foundation/discipline-stage/DisciplineStageSpieltagswertung";
import { calcString } from "@/app/foundation/discipline-stage/arena/DisciplineStageNativeArena";
import { mutatorAufloesung, mutatorTrefferSumme } from "@/lib/foundation/discipline-stage/mutator-aufloesung";
import { buildDisciplineStageTeamsFromPreview } from "@/lib/foundation/discipline-stage/discipline-stage-from-preview";

/**
 * Mutator in der Aufloesung (Chris, 22.11.): im Battle-Modus gibt ein Treffer keine Punkte, wirkt aber (+3,5 Form
 * je Treffer). Die Aufloesung zeigt deshalb Treffer + Form, nie eine erfundene Punktzahl; der Manager-Modus bleibt.
 */

describe("Mutator-Aufloesung: Helfer", () => {
  it("rechnet +3,5 Form je Treffer, ohne Treffer nichts", () => {
    expect(mutatorAufloesung(0)).toBeNull();
    expect(mutatorAufloesung(null)).toBeNull();
    expect(mutatorAufloesung(2)).toMatchObject({ treffer: 2, form: 7, kurz: "◆ 2× · Form +7,0" });
    expect(mutatorAufloesung(1)!.lang).toContain("keine Punkte");
    expect(mutatorTrefferSumme([1, 2, null, 0])).toBe(3);
  });
});

const slot = (over: Partial<ResultTableRow["slots"][number]>): ResultTableRow["slots"][number] => ({
  playerName: "Spieler",
  playerId: "p",
  net: 8,
  slotRank: 1,
  boniMali: 0,
  isBest: false,
  calc: "8 = 8",
  pp: 2,
  ...over,
});

describe("Mutator-Aufloesung: Detail-Ergebnis", () => {
  const row = (slots: ResultTableRow["slots"]): ResultTableRow => ({ rank: 1, code: "AAA", name: "A", logoUrl: null, isOwn: false, teamId: "t", total: 10, slots });
  const render = (r: ResultTableRow) => renderToString(React.createElement(DisciplineStageResultTable, { rows: [r], slotLabels: ["E1", "E2"] }));

  it("zeigt im Battle-Modus Treffer und Form je Spieler und die Summe je Team", () => {
    const html = render(row([slot({ mutatorHits: 2 }), slot({ playerId: "q", mutatorHits: 1 })]));
    expect(html.match(/data-testid="aufloesung-mutator"/g)).toHaveLength(2);
    expect(html).toContain("◆ 2× · Form +7,0");
    expect(html).toContain("◆ 1× · Form +3,5");
    expect(html).toContain('data-testid="aufloesung-mutator-team"');
    expect(html).toContain("◆ 3× · Form +10,5");
    expect(html).toContain("Mutator-Treffer (Form, keine Punkte)");
  });

  it("zeigt ohne Treffer (und im Manager-Modus, wo hits null sind) nichts", () => {
    const html = render(row([slot({ mutatorHits: 0 }), slot({ mutatorHits: null })]));
    expect(html).not.toContain("aufloesung-mutator");
    expect(html).not.toContain("◆");
  });

  it("nennt den Mutator im Rechen-Tooltip, ohne das Netto zu veraendern", () => {
    const p = { playerId: "p", val: 80, name: "S", portraitUrl: null, mods: [{ k: "Fatigue", sign: -1 as const, amt: 4 }], pointsAwarded: 1, mutatorHits: 2 };
    const s = calcString(p);
    expect(s).toContain("= 76");
    expect(s).toContain("2 Treffer = Form +7,0");
    expect(calcString({ ...p, mutatorHits: null })).not.toContain("Mutator");
  });
});

describe("Mutator-Aufloesung: Weg von der Preview zur Anzeige", () => {
  it("reicht mutatorHits je Spieler durch, ohne einen Mutator-Mod (also ohne Punkte) zu erfinden", () => {
    const entry = { playerId: "p1", playerName: "P1", slotIndex: 0, baseValue: 80, finalPlayerScore: 80, mutatorBonus: 0, mutatorPpsBonus: 0, mutatorHits: 2 };
    const teams = buildDisciplineStageTeamsFromPreview(
      { teamResults: [{ teamId: "t1", teamName: "T", rank: 1, score: 80, teamPoints: 1, missingLineup: false, entries: [entry] }] } as never,
      new Map(),
      new Map(),
    );
    expect(teams[0]!.players[0]!.mutatorHits).toBe(2);
    expect(teams[0]!.players[0]!.mods.some((m) => m.k === "Mutator")).toBe(false);
  });
});

describe("Mutator-Aufloesung: Spieltagswertung", () => {
  const spieler = (mutatorHits: number | null, mutatorPp: number | null) => ({
    playerId: "p",
    name: "Maru",
    pp: 2,
    score: 8,
    mutatorPp,
    mutatorHits,
    mutatorForm: mutatorHits ? mutatorHits * 3.5 : null,
  });
  function render(mutatorHits: number | null, mutatorPp: number | null) {
    const eingabe = {
      teamResults: [{ teamId: "a", d1DisciplineId: "basket", d1Points: 2, d2DisciplineId: "bf", d2Points: 1, totalPoints: 3 }],
      standings: [{ teamId: "a", currentRank: 1, projectedRank: 1, currentPoints: 4, projectedPoints: 7, pointsDelta: 3 }],
      d1: { disciplineId: "basket", displayName: "Basketball" },
      d2: { disciplineId: "bf", displayName: "Battlefield" },
      d1Revealed: true,
      d2Revealed: true,
      teamMetaById: new Map([["a", { code: "AAA", name: "Team A", logoUrl: null }]]),
      ownTeamId: "a",
      playersByTeam: new Map([["a", { d1: [spieler(mutatorHits, mutatorPp)], d2: [] }]]),
    };
    return renderToString(React.createElement(DisciplineStageSpieltagswertung as never, eingabe as never)).replace(/<!-- -->/g, "");
  }

  it("zeigt im Battle-Modus Treffer + Form je Spieler und je Seite", () => {
    const html = render(2, null);
    expect(html).toContain('data-testid="spieltagswertung-mutator-spieler"');
    expect(html).toContain("◆ 2× · Form +7,0");
    expect(html).toContain('data-testid="spieltagswertung-mutator-seite"');
    expect(html).toContain("Mutator-Treffer ◆");
    expect(html).toContain("Form +7,0");
    expect(html).toContain("keine Punkte");
  });

  it("Manager-Modus bleibt: Punkte-Aufschlag statt Formzeile", () => {
    const html = render(null, 0.3);
    expect(html).toContain("◆ +0,3");
    expect(html).not.toContain("spieltagswertung-mutator-spieler");
    expect(html).not.toContain("spieltagswertung-mutator-seite");
  });
});
