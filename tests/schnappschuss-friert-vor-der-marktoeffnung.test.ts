/**
 * DER SCHNAPPSCHUSS FRIERT DAS EIN, WAS VOR DER MARKTOEFFNUNG AUF DEM KONTO LIEGT.
 *
 * CHRIS' REGEL, woertlich: „Der richtige snapshot Wert fuer marktwert und Cash am ende von season 1
 * ist nach MD10 aber vor Eroeffnung des transfermarktes! quasi in dem Schritt wo die Sponsoren
 * gebucht werden gehaelter abgehen etc. am ende davon wird der snapshot fuer die history gemacht."
 *
 * In der Kette (`season-transition-steps.ts`) ist das der Hop
 * `player_development → season_end_management`: der Riegel auf `season_rewards` laesst niemanden
 * ohne gebuchte Abrechnung hierher, und die Zielphase `season_end_management` OEFFNET den
 * Verkaufsmarkt (`TRANSFER_SELL_PHASES`, transfer-window-policy.ts). Wer nach diesem Hop einfriert,
 * friert einen Stand nach den ersten Verkaeufen ein.
 *
 * ZWEI BEFUNDE, die hier festgenagelt werden:
 *
 * 1. DER FREEZE HING IM ERFOLGSZWEIG DER SPIELERENTWICKLUNG. Lief die Entwicklung in genau diesem
 *    Hop nicht (weil sie in einem frueheren Anlauf schon lief, weil sie Blocker meldete oder weil
 *    sie warf), blieb nur das Netz eine Station spaeter — und da ist der Markt schon offen. Am
 *    Live-Abbild `new-game-1785823388048-1hf25q` trug kein einziges Team der Saison 1
 *    `cashSeasonEnd`/`marketValueSeasonEnd`.
 *
 * 2. DER CASH-ABGLEICH WAR AUF DER FALSCHEN ZAHL VERANKERT. Nach dem Schnappschuss bucht der
 *    Saisonwechsel noch einmal auf die ALTE Saison: die Vertragsalterung laesst auslaufende
 *    Vertraege auslaufen und schreibt den Abloesewert als `contract_exit` mit der alten `seasonId`
 *    in die Transferhistorie. Am Live-Abbild: 54 Abgaenge, +1085,24 C, gebucht 0,7 s NACH
 *    `createSeasonSnapshot`. `buildTransferFinanceAudit` verankerte die Folgesaison auf `cashEnd`
 *    und meldete deshalb bei 19 von 32 Teams ein `cash_reconciliation_delta_hard` bis 112,9 C.
 *    Kein Cash-Leck — ein falscher Ankerpunkt. Dafuer gibt es jetzt `cashCarryOver`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { isTransferMarketPhaseOpen } from "@/lib/market/transfer-window-policy";

const runSeasonEndProgressionBatch = vi.fn();
vi.mock("@/lib/progression/season-end-progression-batch", () => ({
  runSeasonEndProgressionBatch: (...args: unknown[]) => runSeasonEndProgressionBatch(...args),
}));

const { advanceSeasonTransitionStep } = await import("@/lib/season/season-transition-service");
const { patchSeasonSnapshotCashCarryOver } = await import("@/lib/season/season-snapshot-service");
const { buildTransferFinanceAudit } = await import("@/lib/season/transfer-finance-audit");

const TEAMS = [
  { teamId: "T-1", shortCode: "T-1", name: "Team Eins", budget: 200, cash: 118.31 },
  { teamId: "T-2", shortCode: "T-2", name: "Team Zwei", budget: 180, cash: 8.42 },
  { teamId: "T-3", shortCode: "T-3", name: "Team Drei", budget: 160, cash: -4.2 },
];

function schnappschuss(): SeasonSnapshotRecord {
  return {
    snapshotId: "season-snapshot__season-1",
    seasonId: "season-1",
    seasonName: "Season 1",
    createdAt: "2026-08-08T06:05:19.451Z",
    archivedAt: "2026-08-08T06:05:19.451Z",
    source: "local",
    status: "completed",
    sourceStatus: "mapped",
    finalStandings: TEAMS.map((team, index) => ({
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      rank: index + 1,
      points: 100 - index,
      disciplinePoints: null,
      disciplinePointsByArea: { pow: null, spe: null, men: null, soc: null },
      // ABSICHTLICH FALSCH: der Stand VOR der Abrechnung. Der Freeze muss ihn ueberschreiben —
      // beziehungsweise die eingefrorenen Felder mit dem echten Kontostand fuellen.
      cashEnd: 0,
      rosterEnd: 0,
      salaryEnd: 0,
      marketValueEnd: 0,
      transferCount: 0,
      transferBuyCount: 0,
      transferSellCount: 0,
      transferNet: 0,
    })),
    teamSnapshots: [],
    matchdayResults: [],
    disciplineResults: [],
    playerDisciplinePerformances: [],
    disciplineHighlights: [],
    playerPerformances: [],
    playerPerformanceSnapshots: [],
    transferSnapshots: [],
    warnings: [],
  } as unknown as SeasonSnapshotRecord;
}

function zustandVorDerMarktoeffnung(input?: { progressionAppliedForSeasonId?: string | null }): GameState {
  const snapshot = schnappschuss();
  return {
    gamePhase: "player_development",
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 2, matchdayIds: ["md-1", "md-2"] },
    seasonTransition: {
      transitionId: "t-1",
      fromSeasonId: "season-1",
      toSeasonId: "season-2",
      currentStep: "player_development",
      status: "preview",
      completedSteps: ["season_check", "season_review", "season_rewards"],
      warnings: [],
      errors: [],
      createdAt: "2026-08-08T06:00:00.000Z",
      progressionAppliedForSeasonId: input?.progressionAppliedForSeasonId ?? null,
      aiSeasonEndSellsAppliedForSeasonId: null,
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [
        { id: "f-1", homeTeamId: "T-1", awayTeamId: "T-2", matchdayId: "md-1", status: "resolved" },
        { id: "f-2", homeTeamId: "T-1", awayTeamId: "T-2", matchdayId: "md-2", status: "resolved" },
      ],
      standings: {},
      matchdayResults: [],
      standingsApplyLogs: [],
      // Die Abrechnung ist gebucht — sonst haelt der Riegel auf `season_rewards` die Kette an.
      sponsorPayoutLogs: TEAMS.map((team) => ({
        id: `sponsor-${team.teamId}`,
        saveId: "save-1",
        seasonId: "season-1",
        teamId: team.teamId,
        phase: "season_end",
        componentId: null,
        cashDelta: 10,
        action: "apply",
        createdAt: "2026-08-08T06:00:00.000Z",
      })),
      seasonSnapshots: [snapshot],
    },
    matchdayState: { matchdayId: "md-2", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: ["f-2"] },
    teams: TEAMS.map((team) => ({ ...team, identityId: `i-${team.teamId}`, humanControlled: false, rosterLimit: 12 })),
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
  } as unknown as GameState;
}

function persistenzMock(state: GameState) {
  let aktuell = { saveId: "save-1", name: "Test", status: "active", createdAt: "", updatedAt: "", gameState: state } as unknown as PersistedSaveGame;
  return {
    persistence: {
      saveSingleplayerState: (saveId: string, next: GameState) => {
        aktuell = { ...aktuell, saveId, gameState: next };
        return aktuell;
      },
      getSaveById: (saveId: string) => (saveId === aktuell.saveId ? aktuell : null),
    } as unknown as PersistenceService,
    jetzt: () => aktuell,
  };
}

function eingefroreneZeilen(state: GameState) {
  const snapshot = (state.seasonState.seasonSnapshots ?? []).find((entry) => entry.seasonId === "season-1");
  return snapshot?.finalStandings ?? [];
}

describe("Saisonende: eingefroren wird am Ende von player_development, vor der Marktoeffnung", () => {
  it("friert den Kontostand jedes Teams ein — auch wenn die Entwicklung in diesem Hop nicht rechnet", async () => {
    // Der reale Fall: die Entwicklung lief in einem frueheren Anlauf schon. Der Freeze hing bisher
    // IM Erfolgszweig dieses Laufs und fiel damit ersatzlos aus.
    const mock = persistenzMock(zustandVorDerMarktoeffnung({ progressionAppliedForSeasonId: "season-1" }));
    const vorher = mock.jetzt().gameState;
    expect(isTransferMarketPhaseOpen(vorher)).toBe(false);
    const kasseVorMarkt = new Map(vorher.teams.map((team) => [team.teamId, team.cash]));

    await advanceSeasonTransitionStep(mock.jetzt(), mock.persistence);

    const nachher = mock.jetzt().gameState;
    // Die Zielphase oeffnet den Verkaufsmarkt — was ab hier einfriert, waere zu spaet.
    expect(nachher.gamePhase).toBe("season_end_management");
    expect(isTransferMarketPhaseOpen(nachher)).toBe(true);

    // Die Entwicklung hat NICHT gerechnet, der Freeze trotzdem.
    expect(runSeasonEndProgressionBatch).not.toHaveBeenCalled();
    const zeilen = eingefroreneZeilen(nachher);
    expect(zeilen).toHaveLength(TEAMS.length);
    for (const zeile of zeilen) {
      expect(zeile.cashSeasonEnd, `cashSeasonEnd fuer ${zeile.teamId}`).toBe(kasseVorMarkt.get(zeile.teamId));
      expect(zeile.seasonEndFrozenAt).toBeTruthy();
    }
  });

  it("friert auch dann ein, wenn die Entwicklung Blocker meldet", async () => {
    runSeasonEndProgressionBatch.mockReset();
    const mock = persistenzMock(zustandVorDerMarktoeffnung());
    const kasseVorMarkt = new Map(mock.jetzt().gameState.teams.map((team) => [team.teamId, team.cash]));
    runSeasonEndProgressionBatch.mockImplementation(({ save }: { save: PersistedSaveGame }) => ({
      save,
      blockingReasons: ["season_end_progression_missing_ratings"],
      warnings: [],
    }));

    const ergebnis = await advanceSeasonTransitionStep(mock.jetzt(), mock.persistence);

    expect(ergebnis.transition.warnings.some((w) => w.startsWith("season_end_progression_deferred:"))).toBe(true);
    for (const zeile of eingefroreneZeilen(mock.jetzt().gameState)) {
      expect(zeile.cashSeasonEnd).toBe(kasseVorMarkt.get(zeile.teamId));
    }
  });

  it("friert auch dann ein, wenn die Entwicklung wirft", async () => {
    runSeasonEndProgressionBatch.mockReset();
    const mock = persistenzMock(zustandVorDerMarktoeffnung());
    const kasseVorMarkt = new Map(mock.jetzt().gameState.teams.map((team) => [team.teamId, team.cash]));
    runSeasonEndProgressionBatch.mockImplementation(() => {
      throw new Error("Entwicklung nicht rechenbar");
    });

    await advanceSeasonTransitionStep(mock.jetzt(), mock.persistence);

    for (const zeile of eingefroreneZeilen(mock.jetzt().gameState)) {
      expect(zeile.cashSeasonEnd).toBe(kasseVorMarkt.get(zeile.teamId));
    }
  });
});

/**
 * DER ANKERPUNKT DES CASH-ABGLEICHS.
 *
 * Aufbau wie am Live-Abbild: Saison 1 ist eingefroren (`cashEnd` = Stand vor der Marktoeffnung),
 * danach bucht die Vertragsalterung des Saisonwechsels noch `contract_exit`-Abgaenge auf die ALTE
 * Saison, und erst dann laeuft Saison 2 mit ihren eigenen Kanaelen.
 */
function abgleichZustand(input?: { mitCarryOver?: boolean }): GameState {
  const teams = [
    { teamId: "T-1", name: "Team Eins", budget: 200 },
    { teamId: "T-2", name: "Team Zwei", budget: 180 },
    { teamId: "T-3", name: "Team Drei", budget: 160 },
  ];
  const sponsorS1 = 20;
  const abloese = [95.63, 112.9, 0];
  const sponsorS2 = 15;
  const kaufS2 = 30;

  // Kasse Schritt fuer Schritt: Budget → Sponsor S1 → Schnappschuss → Vertragsablauf (S1!) →
  // Saisongrenze → Sponsor S2 → Kauf S2.
  const cashEndS1 = teams.map((team) => Number((team.budget + sponsorS1).toFixed(2)));
  const carryOver = teams.map((wert, index) => Number((cashEndS1[index]! + abloese[index]!).toFixed(2)));
  const cashHeute = carryOver.map((wert) => Number((wert + sponsorS2 - kaufS2).toFixed(2)));

  const snapshotZeilen = teams.map((team, index) => ({
    teamId: team.teamId,
    teamCode: team.teamId,
    teamName: team.name,
    rank: index + 1,
    points: 0,
    disciplinePoints: null,
    disciplinePointsByArea: { pow: null, spe: null, men: null, soc: null },
    cashEnd: cashEndS1[index]!,
    cashSeasonEnd: cashEndS1[index]!,
    ...(input?.mitCarryOver === false ? {} : { cashCarryOver: carryOver[index]! }),
    rosterEnd: 0,
    salaryEnd: 0,
    marketValueEnd: 0,
    transferCount: 0,
    transferBuyCount: 0,
    transferSellCount: 0,
    transferNet: 0,
  }));

  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 10, matchdayIds: ["s2-md-1"] },
    matchdayState: { matchdayId: "s2-md-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: teams.map((team, index) => ({
      teamId: team.teamId,
      shortCode: team.teamId,
      name: team.name,
      budget: team.budget,
      cash: cashHeute[index]!,
    })),
    teamIdentities: [],
    players: [],
    rosters: [],
    transferHistory: [
      // Der Vertragsablauf: gebucht beim Saisonwechsel, getaggt mit der ALTEN Saison.
      ...teams
        .map((team, index) => ({
          id: `exit-${team.teamId}`,
          playerId: `p-${team.teamId}`,
          seasonId: "season-1",
          seasonLabel: "Season 1",
          source: "ai_contract_expiry",
          transferType: "contract_exit",
          fromTeamId: team.teamId,
          toTeamId: null,
          fee: abloese[index]!,
          netCashImpact: abloese[index]!,
          salary: 0,
          marketValue: abloese[index]!,
          remainingContractLength: 0,
          happenedAt: "2026-08-08T06:05:20.127Z",
        }))
        .filter((eintrag) => eintrag.fee > 0),
      ...teams.map((team) => ({
        id: `buy-${team.teamId}`,
        playerId: `q-${team.teamId}`,
        seasonId: "season-2",
        seasonLabel: "Season 2",
        source: "manual_transfermarkt_buy",
        transferType: "buy",
        fromTeamId: null,
        toTeamId: team.teamId,
        fee: kaufS2,
        salary: 0,
        marketValue: kaufS2,
        remainingContractLength: 3,
        happenedAt: "2026-08-08T14:33:39.252Z",
      })),
    ],
    seasonState: {
      seasonId: "season-2",
      teamStrategyProfiles: {},
      seasonSnapshots: [
        {
          seasonId: "season-1",
          seasonName: "Season 1",
          finalStandings: snapshotZeilen,
          teamSnapshots: snapshotZeilen,
        },
      ],
      sponsorPayoutLogs: [
        ...teams.map((team) => ({ seasonId: "season-1", teamId: team.teamId, phase: "season_end", cashDelta: sponsorS1 })),
        ...teams.map((team) => ({ seasonId: "season-2", teamId: team.teamId, phase: "season_end", cashDelta: sponsorS2 })),
      ],
    },
  } as unknown as GameState;
}

describe("Cash-Abgleich: verankert auf dem Geld, das wirklich mitgenommen wurde", () => {
  it("meldet ohne cashCarryOver genau die Abloese-Summe als hartes Delta (Gegenprobe)", () => {
    const audit = buildTransferFinanceAudit(abgleichZustand({ mitCarryOver: false }));
    const hart = audit.violations.filter((v) => v.startsWith("cash_reconciliation_delta_hard:season-2:"));

    // Zwei Teams haben einen Vertragsablauf — und genau die zwei melden, in exakt dieser Hoehe.
    expect(hart.sort()).toEqual([
      "cash_reconciliation_delta_hard:season-2:T-1:95.63",
      "cash_reconciliation_delta_hard:season-2:T-2:112.9",
    ]);
  });

  it("meldet mit cashCarryOver nichts mehr — bei identischen Buchungen", () => {
    const audit = buildTransferFinanceAudit(abgleichZustand());
    const hart = audit.violations.filter((v) => v.startsWith("cash_reconciliation_delta_hard"));

    expect(hart).toEqual([]);
    for (const zeile of audit.rows.filter((row) => row.seasonId === "season-2")) {
      expect(Math.abs(zeile.cashReconciliationDelta ?? 0), `Rest fuer ${zeile.teamId}`).toBeLessThanOrEqual(0.1);
    }
  });

  it("laesst cashEnd unangetastet — die Historie zeigt weiter den Stand vor der Marktoeffnung", () => {
    const state = abgleichZustand();
    const zeilen = (state.seasonState.seasonSnapshots ?? [])[0]!.finalStandings;
    for (const zeile of zeilen) {
      expect(zeile.cashEnd).toBe(zeile.cashSeasonEnd);
      expect(zeile.cashCarryOver).toBeGreaterThanOrEqual(zeile.cashEnd ?? 0);
    }
  });
});

describe("patchSeasonSnapshotCashCarryOver", () => {
  it("schreibt den Kontostand der Saisongrenze je Team — write-once", () => {
    const state = abgleichZustand({ mitCarryOver: false });
    // Die Kasse an der Grenze: heute minus die Kanaele der Saison 2 (Sponsor +15, Kauf −30).
    const anDerGrenze = new GameStateHelfer(state).kasseAnDerGrenze();
    const gepatcht = patchSeasonSnapshotCashCarryOver(anDerGrenze, "season-1");

    expect(gepatcht.patched).toBe(true);
    const zeilen = (gepatcht.gameState.seasonState.seasonSnapshots ?? [])[0]!.finalStandings;
    expect(zeilen.map((zeile) => zeile.cashCarryOver)).toEqual([315.63, 312.9, 180]);

    // Zweiter Lauf auf veraendertem Cash darf nichts mehr verschieben.
    const nochmal = patchSeasonSnapshotCashCarryOver(
      { ...gepatcht.gameState, teams: gepatcht.gameState.teams.map((team) => ({ ...team, cash: 0 })) },
      "season-1",
    );
    expect((nochmal.gameState.seasonState.seasonSnapshots ?? [])[0]!.finalStandings.map((z) => z.cashCarryOver)).toEqual([
      315.63, 312.9, 180,
    ]);
  });

  it("tut nichts, wenn es keinen Schnappschuss gibt — ein Saisonwechsel darf daran nicht scheitern", () => {
    const state = abgleichZustand();
    const ohne = { ...state, seasonState: { ...state.seasonState, seasonSnapshots: [] } } as GameState;
    expect(patchSeasonSnapshotCashCarryOver(ohne, "season-1").patched).toBe(false);
  });

  it("wird im Saisonwechsel NACH der Vertragsalterung und VOR der neuen Saison-ID gerufen", () => {
    /**
     * Die Reihenfolge ist die ganze Aussage und laesst sich an keinem Rueckgabewert ablesen:
     * eine Zeile frueher fehlten die Abloesen der auslaufenden Vertraege, eine Zeile spaeter
     * (nach `buildNextSeasonContext` und den Sponsor-Schritten der NEUEN Saison) waeren deren
     * Buchungen schon drin und die Grenze verschoben.
     */
    const workflow = readFileSync(join(process.cwd(), "lib/season/preseason-workflow-service.ts"), "utf8");
    const tick = workflow.indexOf("computeSeasonEndContractTick(inputSave)");
    const grenze = workflow.indexOf("patchSeasonSnapshotCashCarryOver(");
    const neueSaison = workflow.indexOf("buildNextSeasonContext(save.gameState)");

    expect(tick).toBeGreaterThan(-1);
    expect(grenze).toBeGreaterThan(tick);
    expect(neueSaison).toBeGreaterThan(grenze);
  });
});

/** Rechnet die Kasse der Saisongrenze zurueck: heutiges Cash minus die Kanaele der Saison 2. */
class GameStateHelfer {
  constructor(private readonly state: GameState) {}

  kasseAnDerGrenze(): GameState {
    const s2 = new Map<string, number>();
    for (const log of (this.state.seasonState.sponsorPayoutLogs ?? []) as Array<{ seasonId: string; teamId: string; cashDelta: number }>) {
      if (log.seasonId !== "season-2") continue;
      s2.set(log.teamId, (s2.get(log.teamId) ?? 0) + log.cashDelta);
    }
    for (const entry of this.state.transferHistory) {
      if (entry.seasonId !== "season-2" || entry.transferType !== "buy" || !entry.toTeamId) continue;
      s2.set(entry.toTeamId, (s2.get(entry.toTeamId) ?? 0) - (entry.fee ?? 0));
    }
    return {
      ...this.state,
      teams: this.state.teams.map((team) => ({
        ...team,
        cash: Number((team.cash - (s2.get(team.teamId) ?? 0)).toFixed(2)),
      })),
    };
  }
}
