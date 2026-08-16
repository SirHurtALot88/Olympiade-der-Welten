/**
 * SPIELERFORDERUNGEN MUESSEN DIE SPIELPLAN-KADERGROESSE NEHMEN, NICHT DEN KATALOGWERT.
 *
 * GEMESSEN: `gameState.disciplines[].playerCount` ist nur der Startzustand des Katalogs — der
 * Spielplan wuerfelt die Kadergroesse pro Saison neu (`buildSeasonSeededDisciplineSchedule`,
 * lib/season/season-discipline-schedule.ts) und weicht am Live-Spielstand bei 15 von 20
 * Disziplinen davon ab. `buildDemandContext` (player-demands-service.ts) loeste die aktuell
 * gespielten Disziplinen zwar korrekt ueber den Spielplan-Slot auf, schlug dann aber im
 * Katalog nach und verlor damit dessen `playerCount` -- genau die Zahl, an der
 * `scoreDisciplineDemandCandidate` die Start-Forderung festmacht
 * (`disciplineRank > requiredPlayers + 1`).
 *
 * Aufbau: "breaking" hat im Katalog 2 Spieler, der Spielplan hat diesen Spieltag 6 ausgelost.
 * Der Testspieler steht in "breaking" auf Rang 4 im Kader -- mit dem Katalogwert (2) faellt er
 * durch das Cutoff (4 > 2+1), mit dem Spielplanwert (6) ist er ein klarer Kandidat (4 <= 6).
 * Die drei anderen Spieler haben in einer ZWEITEN Spieltagsdisziplin ("filler") einen hoeheren
 * Wert als in "breaking" -- ihr "top" ist damit filler, sie konkurrieren dem Testspieler also
 * nicht um die Kandidaten-Deckel je Disziplin/Team weg.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildPlayerDemands } from "@/lib/morale/player-demands-service";

function baueSpielstand(): GameState {
  const nebenspieler = (id: string, breaking: number) => ({
    id,
    name: id,
    ovr: 40,
    pps: 10,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "f",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    preferredDisciplineIds: [],
    // Ihr TOP ist "filler" (99 > breaking), also konkurrieren sie nicht in der breaking-Bucket.
    disciplineRatings: { filler: 99, breaking },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  });

  const zielspieler = {
    id: "p-ziel",
    name: "Zielspieler",
    // Deutlich hoeherer OVR als alle anderen -> rosterRank 1 -> isEliteContender greift sicher.
    ovr: 99,
    pps: 10,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "f",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    preferredDisciplineIds: [],
    // Top ist "breaking" (65 > filler 10) -- schwaechster von vier Spielern in breaking, Rang 4.
    disciplineRatings: { filler: 10, breaking: 65 },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  };

  const spieler = [zielspieler, nebenspieler("p-a", 90), nebenspieler("p-b", 85), nebenspieler("p-c", 80)];

  return {
    gamePhase: "season_active",
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "T-1", shortCode: "T-1", name: "Team Eins", budget: 100, cash: 100, rosterLimit: 12 }],
    teamIdentities: [
      { teamId: "T-1", pow: 5, spe: 5, men: 5, soc: 5, ambition: 5, finances: 5, boardConfidence: 50, harmony: 5, manners: 5, popularity: 5, cooperation: 5, playerMin: 4, playerOpt: 8 },
    ],
    players: spieler,
    rosters: spieler.map((p) => ({ id: `roster:${p.id}`, teamId: "T-1", playerId: p.id, contractLength: 1, salary: 5, upkeep: 5, purchasePrice: 10, currentValue: 10, roleTag: "starter", joinedSeasonId: "season-1" })),
    // Katalog: "breaking" hat 2 Spieler pro Team.
    disciplines: [
      { id: "filler", name: "Filler", category: "power", weight: 1, playerCount: 5 },
      { id: "breaking", name: "Breaking", category: "power", weight: 1, playerCount: 2 },
    ],
    seasonState: {
      // Spielplan: "breaking" hat DIESEN Spieltag 6 Spieler ausgelost -- weicht vom Katalog ab.
      disciplineSchedule: [
        {
          seasonId: "season-1",
          matchdayId: "md-1",
          matchdayIndex: 1,
          matchdayLabel: "Spieltag 1",
          discipline1: { disciplineId: "filler", displayName: "Filler", order: 1, playerCount: 5, category: "power" },
          discipline2: { disciplineId: "breaking", displayName: "Breaking", order: 2, playerCount: 6, category: "power" },
          sourceStatus: "season_seed",
          sourceNote: null,
        },
      ],
      matchdayResults: [],
      // Saisoneinsätze des Zielspielers auf das Saisonziel (8) auffuellen, damit die
      // "Einsätze"-Forderung nicht zufaellig vor der Start-Forderung landet und sie verdeckt --
      // dieser Test soll ausschliesslich die Start-Forderung pruefen.
      playerDisciplinePerformances: Array.from({ length: 8 }, (_, index) => ({
        id: `perf-${index}`,
        matchdayResultId: `result-${index}`,
        teamId: "T-1",
        playerId: "p-ziel",
        disciplineId: "breaking",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 60,
        finalPlayerScore: 60,
        scoreContribution: 60,
        rankInTeam: 1,
        rankInDiscipline: 4,
        isTop10: false,
        isMvpCandidate: false,
        storyWeight: null,
        createdAt: `2026-01-0${(index % 9) + 1}T00:00:00.000Z`,
      })),
    },
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerMoraleState: [],
    logs: [],
  } as unknown as GameState;
}

describe("Spielerforderungen: Start-Forderung folgt der Spielplan-Kadergroesse", () => {
  it("laesst den Rang-4-Spieler eine Start-Forderung stellen, weil der Spielplan 6 Plaetze hat", () => {
    const demands = buildPlayerDemands(baueSpielstand(), "p-ziel", "T-1");
    const startForderung = demands.find((demand) => demand.type === "discipline_start" && demand.targetDisciplineId === "breaking");
    expect(startForderung).toBeDefined();
  });
});
