import { describe, expect, it } from "vitest";

import type { GameState, SeasonSnapshotTeamRecord } from "@/lib/data/olyDataTypes";
import { buildAllTimeTableModel } from "@/lib/foundation/all-time-table";
import { patchSeasonSnapshotMarketValueAfterProgression } from "@/lib/season/season-snapshot-service";

/**
 * GEMELDET VON CHRIS, zwei Sätze:
 *
 *  - „in der ewigen Tabelle stehen auch noch die ALTEN Cash-Werte"
 *  - „MW Werte können gerne NACH Apply von Training und MW-Neuberechnung übernommen werden, weil
 *     Training soll übernommen werden bevor Spieler verkauft werden"
 *
 * Beides sind Reihenfolge-Probleme, keine Anzeigefehler:
 *  - Cash: die Tabelle las `cashTotal` (= `projectedCash`, eine PROGNOSE aus dem Cash-Apply, gebildet
 *    VOR Sponsor-Settlement, Krediten, Gebäuden, Zielen und Insolvenz-Backstop) statt `cashEnd`
 *    (dem echten Kontostand zum Snapshot-Zeitpunkt).
 *  - Marktwert: der Snapshot entsteht VOR `player_development`. `marketValueEnd` ist damit der Stand
 *    vor dem Training, und der Preseason-Patch überschreibt ihn danach nochmals mit dem
 *    Eintrittsstand der FOLGE-Saison.
 */

function team(teamId: string) {
  return { teamId, shortCode: teamId, name: teamId } as unknown as GameState["teams"][number];
}

function record(input: Partial<SeasonSnapshotTeamRecord> & { teamId: string }): SeasonSnapshotTeamRecord {
  return {
    teamId: input.teamId,
    teamCode: input.teamId,
    teamName: input.teamId,
    rank: input.rank ?? 1,
    points: input.points ?? 10,
    disciplinePoints: null,
    disciplinePointsByArea: { pow: null, spe: null, men: null, soc: null },
    cashEnd: input.cashEnd ?? null,
    cashTotal: input.cashTotal ?? null,
    rosterEnd: 10,
    salaryEnd: null,
    marketValueEnd: input.marketValueEnd ?? null,
    marketValueTotalEnd: input.marketValueTotalEnd ?? null,
    marketValueSeasonEnd: input.marketValueSeasonEnd ?? undefined,
    transferCount: 0,
    transferBuyCount: 0,
    transferSellCount: 0,
    transferNet: null,
  } as SeasonSnapshotTeamRecord;
}

function stateWithSnapshot(records: SeasonSnapshotTeamRecord[]): GameState {
  return {
    season: { id: "season-3", name: "Season 3" },
    seasonState: {
      seasonSnapshots: [
        { seasonId: "season-2", seasonName: "Season 2", finalStandings: records, playerPerformances: [] },
      ],
    },
    teams: records.map((entry) => team(entry.teamId)),
    players: [],
    rosters: [],
  } as unknown as GameState;
}

describe("Ewige Tabelle liest die echten Saisonwerte", () => {
  it("nimmt den echten Cash-Endstand statt der Prognose", () => {
    // `cashTotal` ist die Prognose VOR Sponsor/Krediten/Gebäuden — sie stand hier vorne.
    const model = buildAllTimeTableModel({
      gameState: stateWithSnapshot([record({ teamId: "t1", cashEnd: 24.6, cashTotal: 88.8 })]),
    });
    expect(model.rows[0]?.seasons[0]?.cash).toBe(24.6);
    expect(model.rows[0]?.cashNow).toBe(24.6);
  });

  it("nimmt den nach dem Training eingefrorenen Marktwert, nicht den vom Preseason-Patch überschriebenen", () => {
    const model = buildAllTimeTableModel({
      gameState: stateWithSnapshot([
        record({ teamId: "t1", marketValueSeasonEnd: 512, marketValueTotalEnd: 300, marketValueEnd: 280 }),
      ]),
    });
    expect(model.rows[0]?.seasons[0]?.marketValue).toBe(512);
  });

  it("fällt ohne eingefrorenen Wert auf den alten zurück — Altsaves bleiben lesbar", () => {
    const model = buildAllTimeTableModel({
      gameState: stateWithSnapshot([record({ teamId: "t1", marketValueTotalEnd: 300, marketValueEnd: 280 })]),
    });
    expect(model.rows[0]?.seasons[0]?.marketValue).toBe(300);
  });
});

describe("Saisonend-Marktwert wird nach dem Training eingefroren", () => {
  function stateWithRoster(marketValue: number): GameState {
    const base = stateWithSnapshot([record({ teamId: "t1", marketValueEnd: 280 })]);
    return {
      ...base,
      players: [{ id: "p1", marketValue, displayMarketValue: marketValue } as unknown as GameState["players"][number]],
      rosters: [
        { id: "r1", teamId: "t1", playerId: "p1", salary: 5, currentValue: marketValue, purchasePrice: 100 } as unknown as GameState["rosters"][number],
      ],
    };
  }

  it("schreibt den Marktwert aus dem Zustand NACH der Entwicklung", () => {
    const { gameState, patched } = patchSeasonSnapshotMarketValueAfterProgression(stateWithRoster(412), "season-2");
    expect(patched).toBe(true);
    const eintrag = gameState.seasonState.seasonSnapshots?.[0]?.finalStandings?.[0];
    expect(eintrag?.marketValueSeasonEnd).toBe(412);
    // Der alte Wert bleibt unangetastet — er beantwortet weiterhin seine eigene Frage.
    expect(eintrag?.marketValueEnd).toBe(280);
  });

  it("friert nur EINMAL ein: ein zweiter Durchlauf verschiebt die Historie nicht", () => {
    const erst = patchSeasonSnapshotMarketValueAfterProgression(stateWithRoster(412), "season-2");
    // Zweiter Lauf mit anderem Kaderwert (z. B. nach einem Reload, nach Verkäufen). Der Spielerwert
    // muss mit — `getRosterMarketValue` zieht ihn dem `currentValue` des Rostereintrags vor, ein
    // geänderter Rostereintrag allein würde die Rechnung gar nicht bewegen und der Test nichts prüfen.
    const zweit = patchSeasonSnapshotMarketValueAfterProgression(
      {
        ...erst.gameState,
        players: erst.gameState.players.map((entry) => ({ ...entry, marketValue: 1, displayMarketValue: 1 })),
        rosters: erst.gameState.rosters.map((entry) => ({ ...entry, currentValue: 1 })),
      },
      "season-2",
    );
    expect(zweit.gameState.seasonState.seasonSnapshots?.[0]?.finalStandings?.[0]?.marketValueSeasonEnd).toBe(412);
  });

  it("meldet sauber, wenn es für die Saison gar keinen Snapshot gibt", () => {
    const result = patchSeasonSnapshotMarketValueAfterProgression(stateWithRoster(412), "season-99");
    expect(result.patched).toBe(false);
  });
});
