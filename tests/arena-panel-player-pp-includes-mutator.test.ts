import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { hasVisibleMutatorPoints, resolveAwardedPlayerPoints } from "@/lib/foundation/player-points-total";

/**
 * In der Spieltags-Wertung ergab die Summe der Spieler-PPs die BASIS-PP des Teams statt des
 * Gesamtwerts — der Mutator-Bonus fehlte, obwohl der Chip-Tooltip "davon ◆ X Mutator"
 * behauptete, er sei enthalten. Ursache: die Resolve-Engine fuehrt `pointsAwarded`
 * (verteilter Basis-Anteil) und `mutatorPpsBonus` als GETRENNTE Felder.
 *
 * DIESE SUITE PRUEFTE FRUEHER QUELLTEXT (`expect(ARENA).toContain("resolveAwardedPlayerPoints({…")`).
 * Solche Zusicherungen ueberleben jede Bedeutungsaenderung und sterben an jeder Umformatierung.
 * Jetzt wird gemessen, was zaehlt: dass Buehnen-Helfer und Saison-Ledger fuer dieselbe
 * Leistungszeile DIESELBE ZAHL liefern.
 */
describe("Player-Points: Anteil plus Mutator", () => {
  it("addiert den Mutator-Bonus auf die Basis-PP", () => {
    expect(resolveAwardedPlayerPoints({ pointsAwarded: 3.7, mutatorPpsBonus: 0.3 })).toBe(4);
  });

  it("liefert null, solange weder Basis noch Bonus vorliegen", () => {
    // Kein 0 fuer "noch nicht aufgedeckt" — sonst bricht der Spoiler-Schutz der Buehne.
    expect(resolveAwardedPlayerPoints({ pointsAwarded: null, mutatorPpsBonus: null })).toBeNull();
    // Nur ein Bonus ohne Basis ist trotzdem eine Gutschrift.
    expect(resolveAwardedPlayerPoints({ pointsAwarded: null, mutatorPpsBonus: 0.3 })).toBe(0.3);
  });

  it("rundet wie der Ledger, damit nichts auseinanderlaeuft", () => {
    expect(resolveAwardedPlayerPoints({ pointsAwarded: 0.1, mutatorPpsBonus: 0.2 })).toBe(0.3);
    // Vier Nachkommastellen, wie `roundValue(..., 4)` im Ledger.
    expect(resolveAwardedPlayerPoints({ pointsAwarded: 4.6339999, mutatorPpsBonus: 0.3 })).toBe(4.934);
  });

  it("weist einen Mutator-Aufschlag erst ab 0,05 aus", () => {
    expect(hasVisibleMutatorPoints(0.3)).toBe(true);
    expect(hasVisibleMutatorPoints(0.04)).toBe(false);
    expect(hasVisibleMutatorPoints(null)).toBe(false);
  });
});

/**
 * DIE EIGENTLICHE INVARIANTE: die Zahl, die die Buehne im Chip zeigt, ist die Zahl, die der
 * Saison-Ledger dem Spieler gutschreibt. Gemessen an einem echten Ledger-Lauf, nicht an einer
 * Zeichenkette im Quelltext.
 */
describe("Buehnen-PP == Ledger-PP", () => {
  function buildLedgerFixture() {
    const gameState = createFreshSeasonOneGameState();
    const teamA = gameState.teams[0]!;
    const teamB = gameState.teams[1]!;
    const [playerA1, playerA2, playerB1, playerB2] = gameState.players.slice(0, 4);

    gameState.seasonState.matchdayResults = [
      {
        id: "result-1",
        saveId: "save-local",
        seasonId: gameState.season.id,
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 2,
        teamsReady: 2,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-06T12:00:00.000Z",
        updatedAt: "2026-06-06T12:00:00.000Z",
      },
    ];
    gameState.seasonState.disciplineResults = [
      {
        id: "discipline-a",
        matchdayResultId: "result-1",
        teamId: teamA.teamId,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 1,
        baseScore: 40,
        totalScore: 47,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T12:01:00.000Z",
      },
      {
        id: "discipline-b",
        matchdayResultId: "result-1",
        teamId: teamB.teamId,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 2,
        baseScore: 25,
        totalScore: 31,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T12:02:00.000Z",
      },
    ];
    gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-a-1",
        matchdayResultId: "result-1",
        teamId: teamA.teamId,
        playerId: playerA1!.id,
        activePlayerId: playerA1!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 30,
        finalPlayerScore: 33,
        mutatorPpsBonus: 0.3,
        scoreContribution: 0.7,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: true,
        isMvpCandidate: true,
        storyWeight: 0.7,
        createdAt: "2026-06-06T12:03:00.000Z",
      },
      {
        id: "perf-a-2",
        matchdayResultId: "result-1",
        teamId: teamA.teamId,
        playerId: playerA2!.id,
        activePlayerId: playerA2!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 1,
        baseValue: 10,
        finalPlayerScore: 14,
        scoreContribution: 0.3,
        rankInTeam: 2,
        rankInDiscipline: 5,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.3,
        createdAt: "2026-06-06T12:04:00.000Z",
      },
      {
        id: "perf-b-1",
        matchdayResultId: "result-1",
        teamId: teamB.teamId,
        playerId: playerB1!.id,
        activePlayerId: playerB1!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 20,
        finalPlayerScore: 18,
        scoreContribution: 0.5,
        rankInTeam: 1,
        rankInDiscipline: 7,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.5,
        createdAt: "2026-06-06T12:05:00.000Z",
      },
      {
        id: "perf-b-2",
        matchdayResultId: "result-1",
        teamId: teamB.teamId,
        playerId: playerB2!.id,
        activePlayerId: playerB2!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 1,
        baseValue: 20,
        finalPlayerScore: 13,
        scoreContribution: 0.5,
        rankInTeam: 2,
        rankInDiscipline: 9,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.5,
        createdAt: "2026-06-06T12:06:00.000Z",
      },
    ];
    return { gameState, teamA };
  }

  it("der Ledger schreibt exakt das gut, was der Buehnen-Helfer aus derselben Zeile rechnet", () => {
    const { gameState } = buildLedgerFixture();
    const ledger = buildSeasonPointsLedger(gameState);

    for (const performance of gameState.seasonState.playerDisciplinePerformances ?? []) {
      const eintrag = ledger.pointEntriesByPerformanceId.get(performance.id);
      expect(eintrag, performance.id).toBeDefined();
      expect(
        resolveAwardedPlayerPoints({
          pointsAwarded: eintrag!.basePoints,
          mutatorPpsBonus: performance.mutatorPpsBonus ?? 0,
        }),
        performance.id,
      ).toBe(eintrag!.points);
    }
  });

  it("der Mutator-Bonus steckt WIRKLICH in der gutgeschriebenen Zahl, nicht daneben", () => {
    const { gameState, teamA } = buildLedgerFixture();
    const ledger = buildSeasonPointsLedger(gameState);
    const mitMutator = ledger.pointEntriesByPerformanceId.get("perf-a-1")!;

    // Gemessen: 4,634 Anteil + 0,3 Mutator = 4,934 gutgeschrieben.
    expect(mitMutator.basePoints).toBe(4.634);
    expect(mitMutator.mutatorPpsBonus).toBe(0.3);
    expect(mitMutator.points).toBe(4.934);
    expect(mitMutator.points).not.toBe(mitMutator.basePoints);

    // Und die Team-Summe traegt ihn ebenfalls — sonst zeigte die Buehne mehr, als gebucht ist.
    const team = ledger.teamSummariesByTeamId.get(teamA.teamId)!;
    expect(team.mutatorPpsBonus).toBe(0.3);
    expect(team.playerDerivedTotal).toBe(team.totalPoints);
    expect(team.reconciliationStatus).toBe("reconciled");
  });

  it("ohne Mutator-Zeile ist die gutgeschriebene Zahl der reine Anteil", () => {
    const { gameState } = buildLedgerFixture();
    const ledger = buildSeasonPointsLedger(gameState);
    const ohneMutator = ledger.pointEntriesByPerformanceId.get("perf-a-2")!;
    expect(ohneMutator.mutatorPpsBonus).toBe(0);
    expect(ohneMutator.points).toBe(ohneMutator.basePoints);
  });
});
