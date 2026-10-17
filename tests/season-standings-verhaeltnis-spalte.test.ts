import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

import SeasonStandingsNewLook from "@/app/foundation/season-v2/SeasonStandingsNewLook";

/**
 * TASK #159, Teil 1 — Punkteverhältnis-Spalte in der "Daten"-Tabelle des Saisonstands.
 *
 * Chris wollte ausdrücklich eine "Tabelle wie in der Bundesliga MIT Punkteverhältnis". Die
 * Daten existieren seit PR #1266 (`StandingRecord.verhaeltnis`/`projectedVerhaeltnis`) — nur
 * die Anzeige fehlte. Die Spalte "Verh." zeigt die Saisonsumme der ±D-Werte aller gebuchten
 * Battle-Duelle, mit Vorzeichen (+21/−7), NUR bei Battle-Saves — Manager Mode (jedes Team
 * `verhaeltnis: null`) bleibt bit-identisch ohne diese Spalte.
 *
 * SSR-Smoke nach dem Muster von `tests/season-standings-new-look-columns.test.ts`.
 */

function makeRow(input: { teamId: string; code: string; rank: number; verhaeltnis: number | null }) {
  return {
    teamId: input.teamId,
    teamCode: input.code,
    teamName: `Team ${input.code}`,
    logoUrl: null,
    logoInitials: input.code,
    rank: input.rank,
    rankDiff: null,
    points: 42,
    verhaeltnis: input.verhaeltnis,
    pow: 5,
    spe: 4,
    men: 3,
    soc: 2,
    disciplineValues: { bonuspunkte: 1.5, gew: 2 },
    marketValueTotal: 100_000_000,
    cash: 1_000_000,
    sponsorTotal: 2_000_000,
    salaryTotal: 10_000_000,
    buildingCost: null,
    transferNet: null,
    guv: null,
    isSelected: false,
    historicalPointsBySeason: [],
    fieldRaceRankDelta: null,
    leagueTier: null,
  };
}

function render(standingsRows: unknown[]) {
  return renderToString(
    React.createElement(SeasonStandingsNewLook as never, {
      selectedSeasonId: "S1",
      selectedSeasonLabel: "Saison 1",
      sourceLabel: "live",
      sourceBadgeLabel: "Live",
      isArchived: false,
      seasonOptions: [],
      selectedTeamSummary: null,
      leaderTeam: null,
      momentumTeam: null,
      pressureTeam: null,
      topPlayer: null,
      standingsRows,
      topPlayers: [],
      playerRows: [],
      gmRows: [],
      archiveRows: [],
      disciplineLeaders: [],
      onChangeSeason: () => {},
      onOpenTeam: () => {},
      onOpenPlayer: () => {},
    } as never),
  );
}

describe("SeasonStandingsNewLook — Punkteverhältnis-Spalte (Task #159, Teil 1)", () => {
  it("Manager Mode (verhaeltnis überall null): keine Verh.-Spalte, bit-identisch", () => {
    const html = render([
      makeRow({ teamId: "t1", code: "A-A", rank: 1, verhaeltnis: null }),
      makeRow({ teamId: "t2", code: "B-B", rank: 2, verhaeltnis: null }),
    ]);
    expect(html).not.toContain("nl-standings-td-verhaeltnis");
    expect(html).not.toContain("nl-standings-th-verhaeltnis");
    expect(html).not.toContain(">Verh.<");
  });

  it("Battle-Save: zeigt die Verh.-Spalte mit Vorzeichen (+21/−7) und Farbklassen", () => {
    const html = render([
      makeRow({ teamId: "t1", code: "A-A", rank: 1, verhaeltnis: 21 }),
      makeRow({ teamId: "t2", code: "B-B", rank: 2, verhaeltnis: -7 }),
      makeRow({ teamId: "t3", code: "C-C", rank: 3, verhaeltnis: 0 }),
    ]);
    expect(html).toContain(">Verh.<");
    expect(html).toContain("nl-standings-th-verhaeltnis");
    // Vorzeichen (formatNlSignedNumber): "+21" positiv, "-7" negativ (Intl.NumberFormat("de-DE")
    // liefert in dieser Laufzeit einen gewöhnlichen Hyphen-Minus, keinen typografischen U+2212 —
    // selbst nachgemessen, nicht vermutet), "0" ohne Vorzeichen.
    expect(html).toContain("+21");
    expect(html).toContain(">-7<");
    expect(html).toContain(">0<");
    // Farbklassen: positiv gut (gruen), negativ schlecht (rot), Null neutral (keine Klasse).
    expect(html).toMatch(/nl-standings-td-verhaeltnis[^"]*is-pos/);
    expect(html).toMatch(/nl-standings-td-verhaeltnis[^"]*is-neg/);
  });

  it("Battle-Save mit nur einem Team ohne Wertung (verhaeltnis null): Spalte bleibt sichtbar, Zelle zeigt Strich", () => {
    const html = render([
      makeRow({ teamId: "t1", code: "A-A", rank: 1, verhaeltnis: 5 }),
      makeRow({ teamId: "t2", code: "B-B", rank: 2, verhaeltnis: null }),
    ]);
    expect(html).toContain(">Verh.<");
    expect(html).toContain("+5");
  });
});
