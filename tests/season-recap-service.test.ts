import { describe, expect, it } from "vitest";

import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { buildSeasonRecap, selectTransferWindowEntries } from "@/lib/foundation/season-recap-service";
import { resolveInboxLane } from "@/lib/foundation/inbox-lanes";

/**
 * GEWÜNSCHT VON CHRIS: „am Ende der Season nen Ticker wo man sieht welche Teams ihren GM ersetzt
 * haben — oder per INBOX message ... genauso die Top Transfers zusammenfassen ... welches Team hat am
 * meisten MW dazu gewonnen in der Transferphase ... welches sind die Top 3 im Ranks-Reiter."
 */

const ARCHIVED_AT = "2026-06-30T18:00:00.000Z";

function snapshot(partial?: Partial<SeasonSnapshotRecord>): SeasonSnapshotRecord {
  return {
    seasonId: "season-1",
    seasonName: "Season 1",
    archivedAt: ARCHIVED_AT,
    status: "completed",
    finalStandings: [
      {
        teamId: "t1", teamCode: "T1", teamName: "Alpha", rank: 1, points: 90, disciplinePoints: null,
        disciplinePointsByArea: { pow: null, spe: null, men: null, soc: null },
        cashEnd: 24.6, rosterEnd: 12, salaryEnd: null, marketValueEnd: null,
        transferCount: 0, transferBuyCount: 0, transferSellCount: 0, transferNet: -12.5,
        startplatz: 9, rankDiff: 8,
      },
      {
        teamId: "t2", teamCode: "T2", teamName: "Beta", rank: 19, points: 30, disciplinePoints: null,
        disciplinePointsByArea: { pow: null, spe: null, men: null, soc: null },
        cashEnd: 5, rosterEnd: 12, salaryEnd: null, marketValueEnd: null,
        transferCount: 0, transferBuyCount: 0, transferSellCount: 0, transferNet: 3,
        startplatz: 4, rankDiff: -15,
      },
    ],
    playerPerformances: [],
    ...partial,
  } as SeasonSnapshotRecord;
}

function gameState(partial?: Partial<GameState>): GameState {
  return {
    // Die LAUFENDE Saison ist season-2 — der Rückblick schaut auf die abgeschlossene season-1.
    season: { id: "season-2", name: "Season 2" },
    seasonState: { seasonSnapshots: [snapshot()], teamGeneralManagers: {} },
    teams: [
      { teamId: "t1", shortCode: "T1", name: "Alpha", humanControlled: true },
      { teamId: "t2", shortCode: "T2", name: "Beta", humanControlled: false },
    ],
    transferHistory: [],
    ...partial,
  } as unknown as GameState;
}

function transfer(partial: Record<string, unknown>) {
  return {
    id: "x", playerId: "p", playerName: "Spieler", seasonId: "season-2", seasonLabel: "Season 2",
    transferType: "buy", fromTeamId: null, toTeamId: "t1", fee: 10, salary: 1, marketValue: 10,
    remainingContractLength: 2, happenedAt: "2026-07-01T10:00:00.000Z",
    ...partial,
  };
}

describe("Saisonende-Rückblick", () => {
  it("schweigt, solange keine Saison abgeschlossen ist", () => {
    const state = gameState({ seasonState: { seasonSnapshots: [] } as unknown as GameState["seasonState"] });
    expect(buildSeasonRecap({ gameState: state })).toBeNull();
  });

  it("blickt nicht auf die laufende Saison zurück", () => {
    // Solange die abgeschlossene Saison zugleich die laufende ist, ist nichts vorbei.
    const state = gameState({ season: { id: "season-1", name: "Season 1" } as GameState["season"] });
    expect(buildSeasonRecap({ gameState: state })).toBeNull();
  });

  it("gibt dem eigenen Team ein Zeugnis und lässt fremde Teams weg", () => {
    const recap = buildSeasonRecap({ gameState: gameState() });
    const zeugnisse = recap!.entries.filter((entry) => entry.slot === "zeugnis");
    expect(zeugnisse).toHaveLength(1);
    expect(zeugnisse[0]?.teamId).toBe("t1");
    expect(zeugnisse[0]?.description).toContain("8 Plätze gutgemacht");
    expect(zeugnisse[0]?.description).toContain("24,6");
  });

  it("meldet GM-Wechsel gebündelt, mit Grund — und nur die des Boards", () => {
    const state = gameState({
      seasonState: {
        seasonSnapshots: [snapshot()],
        teamGeneralManagers: {
          t1: { teamId: "t1", gmId: "gm-x", assignedSeasonId: "season-2", influencePct: 50, source: "board_replacement", dismissalReason: "low_board_confidence" },
          // Regulärer Wechsel — gehört NICHT ins Karussell.
          t2: { teamId: "t2", gmId: "gm-y", assignedSeasonId: "season-2", influencePct: 50, source: "auto_generated" },
        },
      } as unknown as GameState["seasonState"],
    });
    const karte = buildSeasonRecap({ gameState: state })!.entries.find((entry) => entry.slot === "gm_karussell");
    expect(karte).toBeDefined();
    expect(karte?.teamId).toBeNull();
    expect(karte?.title).toContain("Ein Board");
    expect(karte?.description).toContain("Alpha");
    expect(karte?.description).toContain("Vertrauen im Keller");
    expect(karte?.description).not.toContain("Beta");
  });

  it("lässt die GM-Karte weg, wenn kein Board gewechselt hat", () => {
    const karte = buildSeasonRecap({ gameState: gameState() })!.entries.find((entry) => entry.slot === "gm_karussell");
    expect(karte).toBeUndefined();
  });

  it("sammelt das Transferfenster über die Saison-Grenze hinweg", () => {
    // DER KERN: Deals desselben Fensters tragen ZWEI Saison-IDs — in den Übergangsphasen noch die
    // alte, früh in der neuen Saison schon die neue. Über `seasonId` abzugrenzen verlöre die Hälfte.
    const state = gameState({
      transferHistory: [
        transfer({ id: "alt", seasonId: "season-1", fee: 40, happenedAt: "2026-07-02T10:00:00.000Z" }),
        transfer({ id: "neu", seasonId: "season-2", fee: 30, happenedAt: "2026-07-05T10:00:00.000Z" }),
        // Vor dem Snapshot = in der Saison passiert, gehört nicht ins Fenster.
        transfer({ id: "davor", seasonId: "season-1", fee: 99, happenedAt: "2026-05-01T10:00:00.000Z" }),
      ] as unknown as GameState["transferHistory"],
    });
    const fenster = selectTransferWindowEntries(state, snapshot());
    expect(fenster.map((entry) => entry.id).sort()).toEqual(["alt", "neu"]);

    const deals = buildSeasonRecap({ gameState: state })!.entries.find((entry) => entry.slot === "top_deals");
    expect(deals?.description).toContain("40");
    expect(deals?.description).not.toContain("99");
  });

  it("rechnet den Marktwert-Gewinner als Saldo und nennt die eigene Position", () => {
    const state = gameState({
      transferHistory: [
        transfer({ id: "a", toTeamId: "t2", marketValue: 100 }),
        transfer({ id: "b", toTeamId: "t1", marketValue: 40 }),
        transfer({ id: "c", transferType: "sell", fromTeamId: "t2", toTeamId: null, marketValue: 30 }),
      ] as unknown as GameState["transferHistory"],
    });
    const karte = buildSeasonRecap({ gameState: state })!.entries.find((entry) => entry.slot === "mw_gewinner");
    // t2: +100 − 30 = 70, t1: +40. Also t2 vorn, das eigene Team auf Platz 2.
    expect(karte?.description).toContain("Beta");
    expect(karte?.description).toContain("+70");
    expect(karte?.description).toContain("Platz 2 von 2");
  });

  it("nennt Kletterer und Absturz aus dem Rangunterschied", () => {
    const karte = buildSeasonRecap({ gameState: gameState() })!.entries.find((entry) => entry.slot === "kletterer");
    expect(karte?.description).toContain("Alpha klettert 8 Plätze");
    expect(karte?.description).toContain("Beta verliert 15 Plätze");
  });

  it("zeigt die Kräfteverschiebung erst, wenn es eine Vorsaison zum Vergleich gibt", () => {
    expect(
      buildSeasonRecap({ gameState: gameState() })!.entries.find((entry) => entry.slot === "kraefteverschiebung"),
    ).toBeUndefined();

    const mitVorsaison = gameState({
      season: { id: "season-3", name: "Season 3" } as GameState["season"],
      seasonState: {
        seasonSnapshots: [
          snapshot({
            seasonId: "season-1",
            teamDisciplineRankSnapshots: [
              { teamId: "t1", teamName: "Alpha", totalRank: 12, powRank: 1, speRank: 1, menRank: 1, socRank: 1 },
            ],
          }),
          snapshot({
            seasonId: "season-2",
            seasonName: "Season 2",
            teamDisciplineRankSnapshots: [
              { teamId: "t1", teamName: "Alpha", totalRank: 4, powRank: 1, speRank: 1, menRank: 1, socRank: 1 },
            ],
          }),
        ],
        teamGeneralManagers: {},
      } as unknown as GameState["seasonState"],
    });
    const karte = buildSeasonRecap({ gameState: mitVorsaison })!.entries.find(
      (entry) => entry.slot === "kraefteverschiebung",
    );
    expect(karte?.description).toContain("Alpha +8 auf Stärke-Rang 4");
  });

  it("landet im Bericht-Raum der Inbox, nie im Handeln-Raum", () => {
    // `story:`-Quellen sind per `isGameInboxChronicleItem` Chronik — ein Rückblick ist keine Aufgabe.
    expect(
      resolveInboxLane({
        itemId: "x", saveId: "s", seasonId: "season-1", category: "news", severity: "info",
        title: "t", description: "d", targetView: "seasonV2", targetParams: {}, status: "open",
        createdAt: ARCHIVED_AT, source: "story:season_recap",
      }),
    ).toBe("report");
  });

  it("bleibt bei höchstens 6 Karten", () => {
    const recap = buildSeasonRecap({ gameState: gameState() });
    expect(recap!.entries.length).toBeLessThanOrEqual(6);
  });
});
