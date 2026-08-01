import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildLeagueLeaderBoards } from "@/lib/foundation/league-leaders-service";
import {
  buildMostImprovedRows,
  formatMostImprovedValue,
  resolveMostImprovedWinner,
} from "@/lib/foundation/most-improved-service";
import { buildSeasonReview } from "@/lib/season/season-review-service";

const MATCHDAY_COUNT = 6;

/**
 * Alle Fixtures arbeiten mit einer Feldgroesse von 5 — dann sind die Feldpositionen glatt
 * (Rang 1→100, 2→75, 3→50, 4→25, 5→0) und die Erwartungen im Test enthalten keine
 * Rundungsartefakte, die von der eigentlichen Aussage ablenken.
 */
const FIELD_POSITION_BY_RANK: Record<number, number> = { 1: 100, 2: 75, 3: 50, 4: 25, 5: 0 };

/** `ranks[playerName]` = Rang je Spieltag; `null` heisst "an diesem Spieltag nicht angetreten". */
function makeGameState(ranks: Record<string, Array<number | null>>): GameState {
  const playerNames = Object.keys(ranks);
  const playerIdByName = new Map(playerNames.map((name, index) => [name, `player-${index + 1}`] as const));
  const matchdayIds = Array.from({ length: MATCHDAY_COUNT }, (_, index) => `md-${index + 1}`);

  const performances = playerNames.flatMap((name) =>
    ranks[name].flatMap((rank, matchdayIndex) => {
      if (rank == null) return [];
      const playerId = playerIdByName.get(name)!;
      return [{
        id: `perf-${playerId}-${matchdayIndex}`,
        matchdayResultId: `result-${matchdayIndex + 1}`,
        teamId: "team-1",
        playerId,
        activePlayerId: null,
        disciplineId: "fencing",
        disciplineSide: "d1" as const,
        slotIndex: 0,
        baseValue: 80,
        finalPlayerScore: 100 - rank,
        scoreContribution: 10 - rank,
        rankInTeam: rank,
        rankInDiscipline: rank,
        isTop10: rank <= 3,
        isMvpCandidate: rank === 1,
        storyWeight: 1,
        createdAt: "2026-06-11T00:00:00.000Z",
      }];
    }),
  );

  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: MATCHDAY_COUNT, matchdayIds },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: { "team-1": { points: 42, rank: 1 } },
      matchdayResults: matchdayIds.map((matchdayId, index) => ({
        id: `result-${index + 1}`,
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId,
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 1,
        teamsReady: 1,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-11T00:00:00.000Z",
        updatedAt: "2026-06-11T00:00:00.000Z",
      })),
      disciplineResults: [],
      playerDisciplinePerformances: performances,
    },
    matchdayState: { matchdayId: `md-${MATCHDAY_COUNT}`, status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "team-1", shortCode: "T-1", name: "Team One", budget: 100, cash: 60, identityId: "i-1", humanControlled: true, rosterLimit: 12 }],
    teamIdentities: [],
    players: playerNames.map((name) => ({
      id: playerIdByName.get(name)!,
      name,
      rating: 70,
      marketValue: 12,
      salaryDemand: 1,
      className: "Hero",
      race: "Human",
      alignment: "good",
      gender: "x",
      subclasses: [],
      traitsPositive: [],
      traitsNegative: [],
      coreStats: { pow: 60, spe: 60, men: 60, soc: 60 },
      preferredDisciplineIds: ["fencing"],
      disciplineRatings: { fencing: 80 },
      disciplineTierCounts: { above20: 1, above40: 1, above60: 1, above80: 0 },
      flavorEn: "",
      flavorDe: "",
      fatigue: 0,
      form: 0,
      potential: 70,
    })),
    disciplines: [{ id: "fencing", name: "Fechten", category: "power", weight: 1 }],
    rosters: playerNames.map((name, index) => ({
      id: `r-${index + 1}`,
      teamId: "team-1",
      playerId: playerIdByName.get(name)!,
      salary: 1,
      upkeep: 1,
      purchasePrice: 8,
      currentValue: 12,
      contractLength: 1,
      roleTag: "starter",
      joinedSeasonId: "season-1",
    })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerProgressionEvents: [],
  } as unknown as GameState;
}

/** Klarer Verlauf: ein Aufsteiger, ein Absteiger, drei Konstante auf verschiedener Hoehe. */
function trendGameState() {
  return makeGameState({
    // Namen bewusst so, dass die alphabetische Reihenfolge der EXAKTEN Gegenrichtung entspricht:
    // Adrian < Mika < Zora. Wer bei Gleichstand nach Namen sortiert, dreht sie um.
    Aufsteiger: [5, 5, 5, 1, 1, 1],
    Zora: [2, 2, 2, 2, 2, 2],
    Mika: [3, 3, 3, 3, 3, 3],
    Adrian: [4, 4, 4, 4, 4, 4],
    Absteiger: [1, 1, 1, 5, 5, 5],
  });
}

describe("most-improved-service", () => {
  it("rankt nach dem Zuwachs an Feldposition (Rueckrunde minus Hinrunde)", () => {
    const rows = buildMostImprovedRows(trendGameState());

    expect(rows.map((row) => row.name)).toEqual(["Aufsteiger", "Zora", "Mika", "Adrian", "Absteiger"]);

    const riser = rows[0];
    expect(riser.earlyFieldPosition).toBe(FIELD_POSITION_BY_RANK[5]);
    expect(riser.lateFieldPosition).toBe(FIELD_POSITION_BY_RANK[1]);
    expect(riser.delta).toBe(100);
    expect(riser.earlyAppearances).toBe(3);
    expect(riser.lateAppearances).toBe(3);

    // Der Absteiger bleibt in der Liste, aber hinten — ein negativer Zuwachs ist eine Aussage,
    // kein fehlender Wert.
    expect(rows[rows.length - 1]).toMatchObject({ name: "Absteiger", delta: -100 });
  });

  it("loest Gleichstand stabil auf: staerkere Rueckrunde vor Name und vor Eingabereihenfolge", () => {
    const rows = buildMostImprovedRows(trendGameState()).filter((row) => row.delta === 0);

    // Alle drei haben Zuwachs 0. Entschieden wird ueber die Rueckrunden-Feldposition (75 > 50 > 25)
    // — die alphabetische Reihenfolge waere exakt umgekehrt.
    expect(rows.map((row) => row.name)).toEqual(["Zora", "Mika", "Adrian"]);
    expect(rows.map((row) => row.lateFieldPosition)).toEqual([75, 50, 25]);

    // Dieselben Daten in umgekehrter Eingabereihenfolge muessen dieselbe Rangfolge ergeben.
    const reversed = buildMostImprovedRows(
      makeGameState({
        Adrian: [4, 4, 4, 4, 4, 4],
        Mika: [3, 3, 3, 3, 3, 3],
        Zora: [2, 2, 2, 2, 2, 2],
        Aufsteiger: [5, 5, 5, 1, 1, 1],
        Absteiger: [1, 1, 1, 5, 5, 5],
      }),
    ).filter((row) => row.delta === 0);
    expect(reversed.map((row) => row.name)).toEqual(["Zora", "Mika", "Adrian"]);
  });

  it("laesst Spieler ohne Startwert sauber herausfallen, statt zu crashen", () => {
    const rows = buildMostImprovedRows(
      makeGameState({
        Durchgehend: [1, 1, 1, 1, 1, 1],
        Vergleichbar: [2, 2, 2, 2, 2, 2],
        Auffuellung: [3, 3, 3, 3, 3, 3],
        // Erst zur Rueckrunde dazugekommen: kein Hinrunden-Wert, also kein Zuwachs messbar.
        Neuzugang: [null, null, null, 4, 4, 4],
        // Beide Haelften angetreten, aber unter `MIN_HALF_APPEARANCES` — zwei Auftritte sind ein
        // guter Tag, keine Entwicklung.
        Selten: [5, 5, null, 5, 5, null],
      }),
    );

    // Hier zaehlt allein, WER gewertet wird — die Rangfolge prueft der Trend-Test oben. Nach
    // Namen sortiert verglichen, damit dieser Test nicht still zur zweiten Rangfolge-Pruefung
    // wird: der Neuzugang vergroessert das Feld der Rueckrunde und verschiebt die Positionen
    // aller anderen, was hier korrekt, aber nicht die Aussage ist.
    const names = rows.map((row) => row.name).sort();
    expect(names).not.toContain("Neuzugang");
    expect(names).not.toContain("Selten");
    expect(names).toEqual(["Auffuellung", "Durchgehend", "Vergleichbar"]);
    expect(rows.every((row) => row.earlyAppearances >= 3 && row.lateAppearances >= 3)).toBe(true);
  });

  it("liefert leer statt zu werfen, wenn die Saison keine auswertbaren Auftritte hat", () => {
    expect(buildMostImprovedRows(makeGameState({ Allein: [1, 1, 1, 1, 1, 1] }))).toEqual([]);
    expect(resolveMostImprovedWinner([])).toBeNull();
  });

  it("Bestenliste und Saisonende-Auszeichnung kueren denselben Sieger", () => {
    // Gleichstand an der SPITZE, und zwar so, dass eine naive Sortierung (Wert absteigend, dann
    // Name) einen anderen Ersten kuert: Adrian und Zora haben beide +25, alphabetisch stuende
    // Adrian vorne — die gemeinsame Rechnung setzt Zora davor (staerkere Rueckrunde, 75 vs 25).
    const gameState = makeGameState({
      Zora: [3, 3, 3, 2, 2, 2],
      Adrian: [5, 5, 5, 4, 4, 4],
      Konstant: [1, 1, 1, 1, 1, 1],
      Nachlassend: [2, 2, 2, 3, 3, 3],
      Einbruch: [4, 4, 4, 5, 5, 5],
    });

    const rows = buildMostImprovedRows(gameState);
    expect(rows[0]).toMatchObject({ name: "Zora", delta: 25 });
    expect(rows[1]).toMatchObject({ name: "Adrian", delta: 25 });

    const board = buildLeagueLeaderBoards({
      seasonRows: [],
      mostImprovedRows: rows.map((row) => ({
        playerId: row.playerId,
        name: row.name,
        teamId: row.teamId,
        teamCode: row.teamCode,
        teamName: row.teamName,
        delta: row.delta,
        displayValue: formatMostImprovedValue(row.delta),
        ovrRank: row.ovrRank,
      })),
    }).find((category) => category.id === "mostImproved");

    const award = buildSeasonReview(gameState).awards.find((entry) => entry.awardId === "most_improved_player");

    expect(board?.entries[0]?.rank).toBe(1);
    expect(award?.winnerId).toBe(board?.entries[0]?.playerId);
    expect(award?.winnerName).toBe(board?.entries[0]?.name);
    expect(award?.winnerName).toBe("Zora");
    expect(award?.value).toBe(board?.entries[0]?.value);
  });

  it("meldet die fehlende Quelle, statt einen Sieger zu erfinden", () => {
    const review = buildSeasonReview(makeGameState({ Allein: [1, 1, 1, 1, 1, 1] }));

    expect(review.awards.some((entry) => entry.awardId === "most_improved_player")).toBe(false);
    expect(review.warnings).toContain("most_improved_source_missing");
  });
});
