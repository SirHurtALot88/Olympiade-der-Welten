import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

import SeasonStandingsNewLook from "@/app/foundation/season-v2/SeasonStandingsNewLook";

/**
 * TASK #159 — Saisonstand-UI: getrennte Liga-1/Liga-2-Tabellen (Bundesliga-Stil).
 *
 * Seit PR #1271 ist `rank` bei aktivem Liga-Split der LIGA-LOKALE Rang 1..16
 * (`saisonstand-punkte-nachbuchung.ts`/`standings-preview-engine.ts`), nicht mehr 1..32.
 * Ohne diese Trennung stünden zwei Teams mit Rang 1 (je ein Liga-1- und ein
 * Liga-2-Spitzenreiter) nebeneinander in EINER Tabelle, ohne dass die Doppelung erklärt
 * wäre — genau der Fehler, den diese Tests abdecken.
 *
 * SSR-Smoke nach dem Muster von `tests/season-standings-new-look-columns.test.ts`
 * (`renderToString`, kein Hydration-Effekt nötig — die Komponente startet ohnehin im
 * Default-Modus "Daten", s. `NL_STANDINGS_DEFAULT_MODE`).
 */

function makeRow(input: {
  teamId: string;
  code: string;
  rank: number;
  leagueTier?: "liga1" | "liga2" | null;
}) {
  return {
    teamId: input.teamId,
    teamCode: input.code,
    teamName: `Team ${input.code}`,
    logoUrl: null,
    logoInitials: input.code,
    rank: input.rank,
    rankDiff: null,
    points: 42,
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
    leagueTier: input.leagueTier ?? null,
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

describe("SeasonStandingsNewLook — Liga-Split (Task #159)", () => {
  it("Legacy-32er-Modus (kein leagueTier): bleibt bei EINER Tabelle, unverändert", () => {
    const html = render([
      makeRow({ teamId: "t1", code: "A-A", rank: 1 }),
      makeRow({ teamId: "t2", code: "B-B", rank: 2 }),
    ]);
    expect(html).not.toContain("nl-standings-liga1-card");
    expect(html).not.toContain("nl-standings-liga2-card");
    expect(html).not.toContain("nl-standings-liga-split");
    // Genau EIN Tabellen-Shell, nicht zwei.
    expect(html.split("nl-standings-table-shell").length - 1).toBe(1);
    expect(html).toContain("Team A-A");
    expect(html).toContain("Team B-B");
  });

  it("aktiver Liga-Split: zwei getrennte 16(hier: 2)-Zeilen-Tabellen, je mit eigenem Liga-lokalem Rang 1", () => {
    const html = render([
      makeRow({ teamId: "l1-a", code: "L1A", rank: 1, leagueTier: "liga1" }),
      makeRow({ teamId: "l1-b", code: "L1B", rank: 2, leagueTier: "liga1" }),
      makeRow({ teamId: "l2-a", code: "L2A", rank: 1, leagueTier: "liga2" }),
      makeRow({ teamId: "l2-b", code: "L2B", rank: 2, leagueTier: "liga2" }),
    ]);
    expect(html).toContain("nl-standings-liga-split");
    expect(html).toContain("nl-standings-liga1-card");
    expect(html).toContain("nl-standings-liga2-card");
    expect(html).toContain(">Liga 1<");
    expect(html).toContain(">Liga 2<");
    // Zwei eigenständige Tabellen-Shells statt einer gemeinsamen.
    expect(html.split("nl-standings-table-shell").length - 1).toBe(2);
    // Beide Teams stehen jeweils drin — keines verschwindet in der Trennung.
    for (const name of ["Team L1A", "Team L1B", "Team L2A", "Team L2B"]) {
      expect(html).toContain(name);
    }
  });

  it("Team ohne Liga-Zuordnung bei aktivem Split: eigene dritte Tabelle statt lautlosem Verschwinden", () => {
    const html = render([
      makeRow({ teamId: "l1-a", code: "L1A", rank: 1, leagueTier: "liga1" }),
      makeRow({ teamId: "l2-a", code: "L2A", rank: 1, leagueTier: "liga2" }),
      makeRow({ teamId: "unassigned", code: "UNA", rank: 1, leagueTier: null }),
    ]);
    expect(html).toContain("nl-standings-liga-unassigned-card");
    expect(html).toContain("Ohne Liga-Zuordnung");
    expect(html).toContain("Team UNA");
    expect(html.split("nl-standings-table-shell").length - 1).toBe(3);
  });

  it("kein Team ohne Zuordnung bei aktivem Split: keine dritte Tabelle", () => {
    const html = render([
      makeRow({ teamId: "l1-a", code: "L1A", rank: 1, leagueTier: "liga1" }),
      makeRow({ teamId: "l2-a", code: "L2A", rank: 1, leagueTier: "liga2" }),
    ]);
    expect(html).not.toContain("nl-standings-liga-unassigned-card");
    expect(html.split("nl-standings-table-shell").length - 1).toBe(2);
  });
});
