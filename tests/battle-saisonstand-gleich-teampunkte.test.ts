/**
 * BATTLE-SAISONSTAND = Σ 2/1/0 (bzw. 2-1-0-0 im Vierer-Pod) — KEINE VERSTECKTE DRITTE QUELLE (02.11.).
 *
 * GEMELDET VON CHRIS: „Alle sind 1v1 Duelle zwischen den teams das ist doch der punkt vom Modus." —
 * die Saisontabelle eines Battle-Saves stand bei fast dem Doppelten dessen, was die Duelle hergeben.
 *
 * BEFUND am Battle-Save „Battle Mode VW – alle Figuren (02.11.)", Saison 1 komplett (20/20):
 * H-R Σ teamPoints aller 40 Zeilen = 57, `standings["H-R"].points` = 109,3. Die Luecke entstand
 * ausschliesslich an den vier Rennspieltagen (Takeshi's Castle/Staffel, `quelle: "bahn"`): MD6 +17,3,
 * MD8 +9,4, MD12 +13,6, MD14 +12,0 = 52,3. Ursache: `buildSeasonPointsLedger` fuehrte eine Liste der
 * Duell-pointSources, in der `"battle_mode_bahn_pod_player_score"` fehlte — die Rennfahrer-PP wurden
 * dadurch zusaetzlich zum 2-1-0-0 in `teamSummary.totalPoints` gezaehlt, und
 * `zieheSaisonstandPunkteNach()` schrieb genau diese Summe nach jedem Spieltag in die Tabelle.
 *
 * Diese Pruefung deckt ALLE Duell-Arten auf einmal ab (Arena, PPS-Duell, PPS-Pod, Mini-DM-FFA,
 * Bahn-Pod), jeweils mit grossen Spieler-PP, die bei einer Doppelzaehlung sofort auffielen.
 */
import { describe, expect, it } from "vitest";

import type { DisciplineResultRecord, GameState, PlayerDisciplinePerformanceRecord } from "@/lib/data/olyDataTypes";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { zieheSaisonstandPunkteNach } from "@/lib/standings/saisonstand-punkte-nachbuchung";

const RESULT_ID = "result-battle-md1";

type Zeile = {
  teamIndex: number;
  disciplineId: string;
  side: "d1" | "d2";
  resolutionSource: "arena" | "pps_duell" | "mini_dm_pod";
  quelle?: "ffa" | "bahn";
  platz?: 1 | 2 | 3 | 4;
  teamPoints: number;
};

// Vier Teams, ein Spieltag: d1 ist ein Vierer-Pod, d2 ein 1-gegen-1-Duell.
const ZEILEN_JE_POD: Record<string, Zeile[]> = {
  "bahn (Staffel)": [
    { teamIndex: 0, disciplineId: "staffel", side: "d1", resolutionSource: "mini_dm_pod", quelle: "bahn", platz: 1, teamPoints: 2 },
    { teamIndex: 1, disciplineId: "staffel", side: "d1", resolutionSource: "mini_dm_pod", quelle: "bahn", platz: 2, teamPoints: 1 },
    { teamIndex: 2, disciplineId: "staffel", side: "d1", resolutionSource: "mini_dm_pod", quelle: "bahn", platz: 3, teamPoints: 0 },
    { teamIndex: 3, disciplineId: "staffel", side: "d1", resolutionSource: "mini_dm_pod", quelle: "bahn", platz: 4, teamPoints: 0 },
  ],
  "ffa (Mini-DM)": [
    { teamIndex: 0, disciplineId: "mini-dm", side: "d1", resolutionSource: "mini_dm_pod", quelle: "ffa", platz: 4, teamPoints: 0 },
    { teamIndex: 1, disciplineId: "mini-dm", side: "d1", resolutionSource: "mini_dm_pod", quelle: "ffa", platz: 1, teamPoints: 2 },
    { teamIndex: 2, disciplineId: "mini-dm", side: "d1", resolutionSource: "mini_dm_pod", quelle: "ffa", platz: 2, teamPoints: 1 },
    { teamIndex: 3, disciplineId: "mini-dm", side: "d1", resolutionSource: "mini_dm_pod", quelle: "ffa", platz: 3, teamPoints: 0 },
  ],
  "PPS-Pod (Battlefield, ohne quelle)": [
    { teamIndex: 0, disciplineId: "battlefield", side: "d1", resolutionSource: "mini_dm_pod", platz: 2, teamPoints: 1 },
    { teamIndex: 1, disciplineId: "battlefield", side: "d1", resolutionSource: "mini_dm_pod", platz: 3, teamPoints: 0 },
    { teamIndex: 2, disciplineId: "battlefield", side: "d1", resolutionSource: "mini_dm_pod", platz: 1, teamPoints: 2 },
    { teamIndex: 3, disciplineId: "battlefield", side: "d1", resolutionSource: "mini_dm_pod", platz: 4, teamPoints: 0 },
  ],
};

// d2: zwei Duelle — A schlaegt B in der Arena (2/0), C und D spielen PPS-Duell unentschieden (1/1).
const DUELL_ZEILEN: Zeile[] = [
  { teamIndex: 0, disciplineId: "fechten", side: "d2", resolutionSource: "arena", teamPoints: 2 },
  { teamIndex: 1, disciplineId: "fechten", side: "d2", resolutionSource: "arena", teamPoints: 0 },
  { teamIndex: 2, disciplineId: "hockey", side: "d2", resolutionSource: "pps_duell", teamPoints: 1 },
  { teamIndex: 3, disciplineId: "hockey", side: "d2", resolutionSource: "pps_duell", teamPoints: 1 },
];

function baueStand(podZeilen: Zeile[]): { gameState: GameState; teamIds: string[] } {
  const gameState = createFreshSeasonOneGameState();
  const teams = gameState.teams.slice(0, 4);
  const teamIds = teams.map((team) => team.teamId);
  gameState.teams = teams;
  const podTeamIds = [teamIds[0]!, teamIds[1]!, teamIds[2]!, teamIds[3]!] as const;

  gameState.seasonState.standings = Object.fromEntries(teamIds.map((teamId) => [teamId, { points: 0, rank: null }]));
  gameState.seasonState.matchdayResults = [
    {
      id: RESULT_ID,
      saveId: "save-battle-test",
      seasonId: gameState.season.id,
      matchdayId: "matchday-1",
      status: "preview_applied",
      sourceVersion: "test",
      teamsTotal: 4,
      teamsReady: 4,
      teamsUnderfilled: 0,
      teamsMissingLineup: 0,
      teamsInvalidLineup: 0,
      teamsMissingScoreCoverage: 0,
      warningsCount: 0,
      createdAt: "2026-11-02T12:00:00.000Z",
      updatedAt: "2026-11-02T12:00:00.000Z",
    },
  ];

  const zeilen = [...podZeilen, ...DUELL_ZEILEN];
  gameState.seasonState.disciplineResults = zeilen.map(
    (zeile, index) =>
      ({
        id: `dr-${index}`,
        matchdayResultId: RESULT_ID,
        teamId: teamIds[zeile.teamIndex]!,
        disciplineId: zeile.disciplineId,
        disciplineSide: zeile.side,
        rank: zeile.platz ?? (zeile.teamPoints === 2 ? 1 : 2),
        baseScore: 50,
        totalScore: 50,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-11-02T12:01:00.000Z",
        resolutionSource: zeile.resolutionSource,
        teamPoints: zeile.teamPoints,
        ...(zeile.resolutionSource === "mini_dm_pod"
          ? {
              miniDmPod: {
                podId: `${zeile.disciplineId}-pod-test`,
                platz: zeile.platz!,
                teamIds: podTeamIds,
                wert: 10,
                ...(zeile.quelle ? { quelle: zeile.quelle } : {}),
              },
            }
          : {}),
      }) as DisciplineResultRecord,
  );

  // Je Zeile zwei Spieler mit grossen Spieler-PP: wuerden die irgendwo in die Tabelle durchschlagen,
  // laege jedes Team um ~20 Punkte daneben, nicht um eine Rundung.
  const spieler = gameState.players.filter((player) => teamIds.includes(player.teamId ?? ""));
  gameState.seasonState.playerDisciplinePerformances = zeilen.flatMap((zeile, index) => {
    const teamId = teamIds[zeile.teamIndex]!;
    const kader = spieler.filter((player) => player.teamId === teamId);
    return [0, 1].map(
      (slotIndex) =>
        ({
          id: `perf-${index}-${slotIndex}`,
          matchdayResultId: RESULT_ID,
          teamId,
          playerId: kader[slotIndex]?.id ?? `${teamId}-spieler-${slotIndex}`,
          activePlayerId: kader[slotIndex]?.id ?? `${teamId}-spieler-${slotIndex}`,
          disciplineId: zeile.disciplineId,
          disciplineSide: zeile.side,
          slotIndex,
          baseValue: 90,
          finalPlayerScore: 90,
          scoreContribution: 5,
          rankInTeam: slotIndex + 1,
          rankInDiscipline: slotIndex + 1,
          isTop10: true,
          isMvpCandidate: false,
          storyWeight: 1,
          createdAt: "2026-11-02T12:02:00.000Z",
        }) as PlayerDisciplinePerformanceRecord,
    );
  });

  return { gameState, teamIds };
}

function teamPunkteSumme(gameState: GameState, teamId: string): number {
  return gameState.seasonState.disciplineResults
    .filter((row) => row.teamId === teamId)
    .reduce((summe, row) => summe + (row.teamPoints ?? 0), 0);
}

describe("Battle-Saisonstand: Tabellenpunkte sind exakt Σ teamPoints, je Pod-Art", () => {
  for (const [name, podZeilen] of Object.entries(ZEILEN_JE_POD)) {
    it(`${name} + Arena-/PPS-Duell: Ledger-Teamsumme und Nachbuchung = Σ 2/1/0 bzw. 2-1-0-0`, () => {
      const { gameState, teamIds } = baueStand(podZeilen);
      const ledger = buildSeasonPointsLedger(gameState);

      for (const teamId of teamIds) {
        expect(ledger.teamSummariesByTeamId.get(teamId)?.totalPoints, `Ledger ${teamId}`).toBe(
          teamPunkteSumme(gameState, teamId),
        );
      }
      // Die Spieler-PP gibt es trotzdem — nur in der Leistungsspalte, nicht in der Tabelle.
      expect(ledger.teamSummariesByTeamId.get(teamIds[0]!)?.playerDerivedTotal ?? 0).toBeGreaterThan(5);

      const nachbuchung = zieheSaisonstandPunkteNach(gameState);
      expect(nachbuchung.uebersprungen).toBeNull();
      for (const teamId of teamIds) {
        expect(nachbuchung.gameState.seasonState.standings[teamId]?.points, `Tabelle ${teamId}`).toBe(
          teamPunkteSumme(gameState, teamId),
        );
      }
    });
  }
});
