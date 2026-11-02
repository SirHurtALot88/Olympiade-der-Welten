/**
 * SIEG / UNENTSCHIEDEN / NIEDERLAGE IM SAISONSTAND (Chris, 02.11.: „Alle sind 1v1 Duelle zwischen den
 * teams das ist doch der punkt vom Modus").
 *
 * (a) `summiereSaisonBilanz`: 2/1/0 der Duell-Zeilen -> S/U/N, Vierer-Pods getrennt nach Platz,
 *     ungewertete Spieltage und Manager-Zeilen zaehlen nicht, Manager-Save -> `null`.
 * (b) SSR der Saisonstand-Tabelle: Spalte „S-U-N" nur mit Bilanz-Karte (Battle), sonst gar nicht.
 *
 * Am echten Battle-Save „Battle Mode VW – alle Figuren (02.11.)" nachgerechnet: H-R 22-0-10 + Pods
 * 5×1./3×2. -> 2·22 + 0 + 2·5 + 3 = 57 = Σ teamPoints; dieselbe Identitaet hielt bei 32 von 32 Teams.
 */
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SeasonStandingsNewLook from "@/app/foundation/season-v2/SeasonStandingsNewLook";
import type { GameState } from "@/lib/data/olyDataTypes";
import { beschreibeBilanz, formatiereBilanz, summiereSaisonBilanz } from "@/lib/standings/standings-bilanz";

function zeile(input: {
  id: string;
  resultId: string;
  teamId: string;
  resolutionSource?: "pps" | "arena" | "pps_duell" | "mini_dm_pod";
  teamPoints?: number;
  platz?: 1 | 2 | 3 | 4;
}) {
  return {
    id: input.id,
    matchdayResultId: input.resultId,
    teamId: input.teamId,
    disciplineId: "x",
    disciplineSide: "d1",
    rank: 1,
    baseScore: 0,
    totalScore: 0,
    readinessStatus: "ready",
    warnings: [],
    createdAt: "2026-11-02T00:00:00.000Z",
    ...(input.resolutionSource ? { resolutionSource: input.resolutionSource } : {}),
    ...(input.teamPoints != null ? { teamPoints: input.teamPoints } : {}),
    ...(input.platz ? { miniDmPod: { podId: "p", platz: input.platz, teamIds: ["A", "B", "C", "D"], wert: 5 } } : {}),
  };
}

function stand(disciplineResults: unknown[]): Pick<GameState, "seasonState"> {
  return {
    seasonState: {
      matchdayResults: [
        { id: "r1", seasonId: "season-1", matchdayId: "matchday-1", status: "preview_applied" },
        { id: "r2", seasonId: "season-1", matchdayId: "matchday-2", status: "preview_applied" },
        // noch nicht uebernommen -> darf nicht zaehlen
        { id: "r3", seasonId: "season-1", matchdayId: "matchday-3", status: "resolved" },
      ],
      disciplineResults,
    },
  } as unknown as Pick<GameState, "seasonState">;
}

describe("(a) summiereSaisonBilanz", () => {
  it("Duell-Zeilen -> S/U/N, Pods getrennt nach Platz, ungewertete Spieltage ausgelassen", () => {
    const bilanz = summiereSaisonBilanz(
      stand([
        zeile({ id: "1", resultId: "r1", teamId: "A", resolutionSource: "arena", teamPoints: 2 }),
        zeile({ id: "2", resultId: "r1", teamId: "B", resolutionSource: "arena", teamPoints: 0 }),
        zeile({ id: "3", resultId: "r2", teamId: "A", resolutionSource: "pps_duell", teamPoints: 1 }),
        zeile({ id: "4", resultId: "r2", teamId: "B", resolutionSource: "pps_duell", teamPoints: 1 }),
        zeile({ id: "5", resultId: "r2", teamId: "A", resolutionSource: "mini_dm_pod", teamPoints: 1, platz: 2 }),
        zeile({ id: "6", resultId: "r2", teamId: "B", resolutionSource: "mini_dm_pod", teamPoints: 0, platz: 4 }),
        zeile({ id: "7", resultId: "r3", teamId: "A", resolutionSource: "arena", teamPoints: 2 }),
      ]),
      "season-1",
    );
    expect(bilanz?.get("A")).toEqual({ siege: 1, unentschieden: 1, niederlagen: 0, podPlaetze: [0, 1, 0, 0] });
    expect(bilanz?.get("B")).toEqual({ siege: 0, unentschieden: 1, niederlagen: 1, podPlaetze: [0, 0, 0, 1] });
    expect(formatiereBilanz(bilanz!.get("A")!)).toBe("1-1-0");
    expect(beschreibeBilanz(bilanz!.get("A")!)).toBe(
      "1 Siege · 1 Unentschieden · 0 Niederlagen in 2 Duellen — Vierer-Pods (1): 0× Platz 1, 1× Platz 2, 0× Platz 3, 0× Platz 4",
    );
  });

  it("Manager-Save (nur Rang-Wertung `pps` bzw. ohne resolutionSource) -> null, keine Spalte", () => {
    expect(
      summiereSaisonBilanz(
        stand([
          zeile({ id: "1", resultId: "r1", teamId: "A", resolutionSource: "pps" }),
          zeile({ id: "2", resultId: "r1", teamId: "B" }),
        ]),
        "season-1",
      ),
    ).toBeNull();
  });
});

function makeRow(teamId: string, code: string, rank: number) {
  return {
    teamId,
    teamCode: code,
    teamName: `Team ${code}`,
    logoUrl: null,
    logoInitials: code,
    rank,
    rankDiff: null,
    points: 42,
    verhaeltnis: null,
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

function render(teamBilanzByTeamId: unknown) {
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
      standingsRows: [makeRow("t1", "A-A", 1), makeRow("t2", "B-B", 2)],
      topPlayers: [],
      playerRows: [],
      gmRows: [],
      archiveRows: [],
      disciplineLeaders: [],
      teamBilanzByTeamId,
      onChangeSeason: () => {},
      onOpenTeam: () => {},
      onOpenPlayer: () => {},
    } as never),
  );
}

describe("(b) Saisonstand-Tabelle", () => {
  it("Manager Mode (keine Bilanz-Karte): weder Spalte noch Chip", () => {
    const html = render(null);
    expect(html).not.toContain("S-U-N");
    expect(html).not.toContain("nl-standings-td-bilanz");
  });

  it("Battle-Save: Spalte S-U-N mit 22-0-10, Team ohne Duell zeigt Strich", () => {
    const html = render(
      new Map([["t1", { siege: 22, unentschieden: 0, niederlagen: 10, podPlaetze: [5, 3, 0, 0] }]]),
    );
    expect(html).toContain("S-U-N");
    expect(html).toContain("nl-standings-th-bilanz");
    expect(html).toContain(">22-0-10<");
    expect(html).toContain("5× Platz 1");
    expect(html).toMatch(/nl-standings-td-bilanz[^>]*>—</);
  });
});
