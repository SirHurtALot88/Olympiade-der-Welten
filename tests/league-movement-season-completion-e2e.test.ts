/**
 * TASK #158 — End-to-End: ein voller `runLocalSeasonCompletion`-Lauf auf einem synthetischen
 * Zwei-Liga-Battle-Mode-Save. Deckt genau das ab, was die reinen Unit-Tests
 * (`tests/league-movement-service.test.ts`, `tests/liga-split-pr4-5.test.ts`,
 * `tests/sponsor-liga-leiter.test.ts`) einzeln beweisen, aber hier ZUSAMMEN, durch die echte
 * Produktionspipeline: die richtigen 6 Teams wechseln die Liga, UND das Ergebnis ist fuer alles,
 * was danach liest (Sponsor-Reroll, Apron), sofort sichtbar.
 *
 * Fixture-Muster uebernommen von `tests/season-completion-service.test.ts`
 * (`createCompletedSeasonState`/`createPersistence`) — nur um `leagueByTeamId` + kontrollierte
 * Liga-lokale Raenge ergaenzt, damit Auf-/Abstieg deterministisch ist.
 */
import { describe, expect, it } from "vitest";

import type { GameState, StandingRecord } from "@/lib/data/olyDataTypes";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import {
  runLocalSeasonCompletion,
  SEASON_COMPLETION_CONFIRM_TOKEN,
} from "@/lib/season/season-completion-service";
import { LEAGUE_SIZE, RELEGATION_COUNT, buildInitialLeagueAssignment } from "@/lib/season/league-split";
import { SPONSOR_TOPF_FAKTOR_JE_LIGA } from "@/lib/sponsor/sponsor-liga-leiter";
import { ensureSeasonApronLinesFrozen } from "@/lib/season/apron-settlement-service";
import { applyLeagueMovementOnce, computeLeagueMovement } from "@/lib/season/league-movement-service";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import { patchSeasonSnapshotMarketValueAfterProgression } from "@/lib/season/season-snapshot-service";
import { vertragsjahrAus } from "@/lib/sponsor/sponsor-leih-lifecycle";
import { chooseSponsorOfferForAiTeams } from "@/lib/sponsor/sponsor-offer-service";
import {
  getSponsorV3SalaryFactor,
  getSponsorV3Terms,
  rerollSponsorV3TermsForNewSeason,
} from "@/lib/sponsor/sponsor-v3-offer-service";

const SAVE_ID = "league-movement-e2e-save";

function createPersistence(gameState: GameState): PersistenceService & { getState: () => GameState } {
  let save: PersistedSaveGame = {
    saveId: SAVE_ID,
    name: "League Movement E2E",
    status: "active",
    createdAt: "2026-10-18T00:00:00.000Z",
    updatedAt: "2026-10-18T00:00:00.000Z",
    gameState: structuredClone(gameState),
  };

  return {
    getState() {
      return structuredClone(save.gameState);
    },
    bootstrapSingleplayerSave() {
      return { save: structuredClone(save), createdFromSeed: false };
    },
    getActiveSave() {
      return structuredClone(save);
    },
    getSaveVersionMetadata() {
      return null;
    },
    getSaveById(saveId) {
      return saveId === save.saveId ? structuredClone(save) : null;
    },
    saveSingleplayerState(saveId, nextGameState) {
      if (saveId !== save.saveId) throw new Error(`Unknown save ${saveId}`);
      save = { ...save, updatedAt: "2026-10-18T00:01:00.000Z", gameState: structuredClone(nextGameState) };
      return structuredClone(save);
    },
    createSave() {
      throw new Error("not needed in test");
    },
    createFreshSeasonOneSave() {
      throw new Error("not needed in test");
    },
    cloneSave() {
      throw new Error("not needed in test");
    },
    activateSave(saveId) {
      return saveId === save.saveId ? structuredClone(save) : null;
    },
    listSaves() {
      return [{ saveId: save.saveId, name: save.name, status: save.status, createdAt: save.createdAt, updatedAt: save.updatedAt }];
    },
  };
}

/**
 * Ein abgeschlossenes Saisonende — Battle-Mode mit aktivem Liga-Split, WENN `withLeagueSplit` true
 * ist. `leagueByTeamId` kommt aus der echten `buildInitialLeagueAssignment` (Budget-Startrang 1..16
 * Liga 1, Rest Liga 2) — dieselbe Funktion, die ein echter New-Game-Setup benutzt. Die Endtabelle
 * wird darauf aufsetzend MANUELL mit kontrollierten, liga-lokalen Raengen 1..LEAGUE_SIZE pro Liga
 * ueberschrieben: Liga 1 behaelt die Budget-Reihenfolge (Rang 1 = hoechstes Budget), Liga 2 wird
 * UMGEDREHT (Rang 1 = NIEDRIGSTES Budget) — so bekommt man Auf-/Absteiger mit erkennbar anderem
 * Gehaltsniveau als ihre neue Liga, statt eines Zufallsergebnisses.
 */
function createCompletedTwoLeagueSeasonState(withLeagueSplit: boolean): GameState {
  const gameState = createFreshSeasonOneGameState(SAVE_ID);
  const seasonId = gameState.season.id;
  const lastMatchdayId = gameState.season.matchdayIds[gameState.season.matchdayIds.length - 1]!;

  gameState.season.currentMatchday = gameState.season.matchdayIds.length;
  gameState.gamePhase = "season_completed";
  gameState.matchdayState = { matchdayId: lastMatchdayId, status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] };

  const leagueByTeamId = buildInitialLeagueAssignment(gameState.teams);
  if (withLeagueSplit) {
    gameState.seasonState.leagueByTeamId = leagueByTeamId;
  }

  const liga1Ids = Object.keys(leagueByTeamId).filter((teamId) => leagueByTeamId[teamId] === "liga1");
  const liga2Ids = Object.keys(leagueByTeamId).filter((teamId) => leagueByTeamId[teamId] === "liga2");
  expect(liga1Ids).toHaveLength(LEAGUE_SIZE);
  expect(liga2Ids).toHaveLength(LEAGUE_SIZE);

  // `createFreshSeasonOneGameState` liefert KEINE Rosters (Kader werden erst im echten
  // Preseason-Draft gefuellt) — ohne mindestens einen Roster-Eintrag pro Team faellt JEDES Team auf
  // die Referenz-Gehaltsschranke zurueck (`SPONSOR_V3_REFERENCE_SALARY_PER_TEAM` = 64,9, "gemessene
  // Summe < 25% der erwarteten Referenz"), und Liga 1/Liga 2 waeren ununterscheidbar. Ein Spieler
  // je Team reicht; Liga 1 bekommt ein deutlich teureres Gehalt als Liga 2, damit der Apron-Median
  // je Liga nachweisbar unterschiedlich ausfaellt (10.4).
  const liga1IdSet = new Set(liga1Ids);
  gameState.rosters = gameState.teams.map((team, index) => {
    const player = gameState.players[index % gameState.players.length]!;
    const salary = liga1IdSet.has(team.teamId) ? 500 : 50;
    return {
      id: `e2e-roster-${team.teamId}`,
      teamId: team.teamId,
      playerId: player.id,
      contractLength: 3,
      salary,
      // `resolveNegotiatedAnnualSalary` (player-economy-contract.ts) liest zuerst
      // `negotiatedAnnualSalary`, dann `yearlySalarySchedule`, erst dann `.salary`.
      negotiatedAnnualSalary: salary,
      upkeep: salary * 0.1,
      roleTag: "starter",
      joinedSeasonId: seasonId,
    };
  });

  // Apron-Linien einfrieren, so wie es im echten Spielverlauf beim Finalisieren der Transfers
  // passiert (`ensureSeasonApronLinesFrozen`, lineup-finalize-Flow) — ohne diesen Schritt haette
  // `apron_settlement` am Saisonende nichts zu lesen (`apron_lines_not_frozen`) und keine
  // `apronLinesSnapshotByLeague` entstuende. Mit `withLeagueSplit=false` bleibt das Verhalten exakt
  // der alte, globale Einzel-Snapshot.
  const frozenApron = ensureSeasonApronLinesFrozen(gameState, "transfers_finalized");
  gameState.seasonState.apronLinesSnapshot = frozenApron.seasonState.apronLinesSnapshot;
  gameState.seasonState.apronLinesSnapshotByLeague = frozenApron.seasonState.apronLinesSnapshotByLeague;

  const standings: Record<string, StandingRecord> = {};
  liga1Ids.forEach((teamId, index) => {
    standings[teamId] = { points: 200 - index, rank: withLeagueSplit ? index + 1 : index + 1 };
  });
  // Liga 2 absichtlich UMGEDREHT ggue. ihrer Budget-Reihenfolge, s. Dateikopf.
  const liga2Reversed = [...liga2Ids].reverse();
  liga2Reversed.forEach((teamId, index) => {
    standings[teamId] = { points: 100 - index, rank: index + 1 };
  });
  gameState.seasonState.standings = standings;

  gameState.seasonState.matchdayResults = gameState.season.matchdayIds.map((matchdayId, index) => ({
    id: `completion-result-${matchdayId}`,
    saveId: SAVE_ID,
    seasonId,
    matchdayId,
    status: "preview_applied",
    sourceVersion: "test",
    teamsTotal: gameState.teams.length,
    teamsReady: gameState.teams.length,
    teamsUnderfilled: 0,
    teamsMissingLineup: 0,
    teamsInvalidLineup: 0,
    teamsMissingScoreCoverage: 0,
    warningsCount: 0,
    createdAt: `2026-10-18T00:${String(index).padStart(2, "0")}:00.000Z`,
    updatedAt: `2026-10-18T00:${String(index).padStart(2, "0")}:00.000Z`,
  }));
  gameState.seasonState.standingsApplyLogs = gameState.season.matchdayIds.map((matchdayId, index) => ({
    id: `completion-standings-${matchdayId}`,
    saveId: SAVE_ID,
    seasonId,
    matchdayId,
    action: "apply",
    payload: {
      idempotencyKey: `completion-standings-${matchdayId}`,
      totalTeams: gameState.teams.length,
      appliedTeams: gameState.teams.length,
      tieGroupsCount: 0,
      previewWarningsCount: 0,
    },
    createdAt: `2026-10-18T01:${String(index).padStart(2, "0")}:00.000Z`,
  }));
  gameState.seasonState.cashPrizeApplyLogs = [
    {
      id: "completion-cash-season-end",
      saveId: SAVE_ID,
      seasonId,
      matchdayId: lastMatchdayId,
      action: "apply",
      payload: {
        idempotencyKey: `cash-prize-apply:${SAVE_ID}:${seasonId}:${lastMatchdayId}`,
        totalTeams: gameState.teams.length,
        appliedTeams: gameState.teams.length,
        totalPrizeMoney: 0,
      },
      createdAt: "2026-10-18T02:00:00.000Z",
    },
  ];

  return gameState;
}

describe("league_movement — End-to-End ueber runLocalSeasonCompletion", () => {
  it("Battle-Mode mit Liga-Split: genau 3 Liga-2-Teams steigen auf, genau 3 Liga-1-Teams steigen ab", async () => {
    const gameState = createCompletedTwoLeagueSeasonState(true);
    const leagueByTeamIdBefore = { ...gameState.seasonState.leagueByTeamId! };
    const persistence = createPersistence(gameState);

    const result = await runLocalSeasonCompletion(
      { saveId: SAVE_ID, seasonId: gameState.season.id, source: "sqlite", execute: true, dryRun: false, confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN },
      persistence,
    );
    const saved = persistence.getState();

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    const leagueMovementStep = result.steps.find((step) => step.key === "league_movement");
    expect(leagueMovementStep?.status).toBe("applied");

    expect(result.leagueMovement.applicable).toBe(true);
    expect(result.leagueMovement.promoted).toHaveLength(RELEGATION_COUNT);
    expect(result.leagueMovement.relegated).toHaveLength(RELEGATION_COUNT);
    expect(RELEGATION_COUNT).toBe(3);

    const nextAssignment = saved.seasonState.leagueByTeamId!;
    // Genau 6 Teams haben ihre Liga gewechselt — alle anderen 26 sind unveraendert.
    const changedTeamIds = Object.keys(nextAssignment).filter((teamId) => nextAssignment[teamId] !== leagueByTeamIdBefore[teamId]);
    expect(changedTeamIds).toHaveLength(2 * RELEGATION_COUNT);

    for (const change of result.leagueMovement.promoted) {
      expect(leagueByTeamIdBefore[change.teamId]).toBe("liga2");
      expect(nextAssignment[change.teamId]).toBe("liga1");
    }
    for (const change of result.leagueMovement.relegated) {
      expect(leagueByTeamIdBefore[change.teamId]).toBe("liga1");
      expect(nextAssignment[change.teamId]).toBe("liga2");
    }

    // Idempotenz-Ledger: genau EIN Eintrag, mit genau den beobachteten Team-IDs.
    expect(saved.seasonState.leagueMovementLogs).toHaveLength(1);
    const logRecord = saved.seasonState.leagueMovementLogs![0]!;
    expect(logRecord.promotedTeamIds.sort()).toEqual(result.leagueMovement.promoted.map((t) => t.teamId).sort());
    expect(logRecord.relegatedTeamIds.sort()).toEqual(result.leagueMovement.relegated.map((t) => t.teamId).sort());

    // Apron: PRO LIGA ein eigener, unterschiedlicher Median (10.4) — unsere Fixture gibt Liga 1
    // durchgehend hoehere Budgets/Gehaelter als Liga 2, die Mediane duerfen sich deshalb nicht
    // decken.
    const apronByLeague = saved.seasonState.apronLinesSnapshotByLeague;
    expect(apronByLeague?.liga1).toBeDefined();
    expect(apronByLeague?.liga2).toBeDefined();
    expect(apronByLeague!.liga1!.medianSalary).not.toBeCloseTo(apronByLeague!.liga2!.medianSalary, 1);

    // Sponsor-Topf (10.3): 60/40-Split — beide Faktoren addieren sich zu genau 1 (ein einziger,
    // nicht verdoppelter Topf).
    expect(SPONSOR_TOPF_FAKTOR_JE_LIGA.liga1 + SPONSOR_TOPF_FAKTOR_JE_LIGA.liga2).toBeCloseTo(1, 9);
  }, 240000);

  it("ein zweiter Lauf auf demselben, bereits bewegten Save wendet league_movement NICHT erneut an (Idempotenz)", async () => {
    const gameState = createCompletedTwoLeagueSeasonState(true);
    const persistence = createPersistence(gameState);

    await runLocalSeasonCompletion(
      { saveId: SAVE_ID, seasonId: gameState.season.id, source: "sqlite", execute: true, dryRun: false, confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN },
      persistence,
    );
    const afterFirstRun = persistence.getState();
    expect(afterFirstRun.seasonState.leagueMovementLogs).toHaveLength(1);

    // Zweiter Aufruf fuer dieselbe Saison — darf den Ledger nicht verdoppeln und die bereits
    // bewegte Zuordnung nicht ein zweites Mal gegen sich selbst auswerten.
    const secondResult = await runLocalSeasonCompletion(
      { saveId: SAVE_ID, seasonId: gameState.season.id, source: "sqlite", execute: true, dryRun: false, confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN },
      persistence,
    );
    const afterSecondRun = persistence.getState();

    expect(secondResult.steps.find((step) => step.key === "league_movement")?.status).toBe("already_done");
    expect(afterSecondRun.seasonState.leagueMovementLogs).toHaveLength(1);
    expect(afterSecondRun.seasonState.leagueByTeamId).toEqual(afterFirstRun.seasonState.leagueByTeamId);
  }, 240000);

  it("Manager-Mode / kein Liga-Split: league_movement bleibt ein No-Op (Bit-Identitaets-Kontrollfall)", async () => {
    const gameState = createCompletedTwoLeagueSeasonState(false);
    expect(gameState.seasonState.leagueByTeamId).toBeUndefined();
    const persistence = createPersistence(gameState);

    const result = await runLocalSeasonCompletion(
      { saveId: SAVE_ID, seasonId: gameState.season.id, source: "sqlite", execute: true, dryRun: false, confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN },
      persistence,
    );
    const saved = persistence.getState();

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.leagueMovement.applicable).toBe(false);
    expect(result.leagueMovement.leagueByTeamId).toBeNull();
    expect(result.steps.find((step) => step.key === "league_movement")?.status).toBe("skipped");
    // Kein Liga-Feld, kein Ledger — exakt der Zustand von vor Task #158.
    expect(saved.seasonState.leagueByTeamId).toBeUndefined();
    expect(saved.seasonState.leagueMovementLogs ?? []).toHaveLength(0);
    expect(saved.seasonState.apronLinesSnapshotByLeague).toBeUndefined();
  }, 240000);
});

/**
 * DER ZWEITE WEG ANS SAISONENDE (Chris' Entscheidung vom 27.10.: beim Saisonübergang müssen im Battle
 * Mode alle Mechanismen greifen, gerade die Sponsoren).
 *
 * Die Saisonende-Seite (`FoundationSeasonFinalePanel`) läuft NICHT über `runLocalSeasonCompletion`,
 * sondern über „Abrechnung buchen" (cash-prize-apply) → „Verkäufe & Verträge öffnen" (Transition,
 * deren Schritt `player_development` den Snapshot anlegt) → „Neue Saison starten"
 * (`next_season_setup`). Auf diesem Weg stieg bis hierher kein Team auf oder ab — und damit rollten
 * die Sponsorverträge gegen die ALTE Liga. Diese Tests fahren genau diese Kette (ohne Cockpit-Lauf).
 */
describe("league_movement — Saisonende-Seite ohne Cockpit-Lauf (next_season_setup holt nach)", () => {
  /**
   * Abgeschlossene Saison wie oben, dazu: jedes Team mit einem echten Sponsorvertrag (KI-Wahl ueber
   * den Produktionspfad), alle auf eine Laufzeit von 3 Saisons gestellt — damit sie beim
   * Saisonwechsel ROLLEN (`advanceSponsorContractsForNewSeason`) statt auszulaufen. Danach der
   * Snapshot, so wie ihn auf der Saisonende-Seite der Transition-Schritt `player_development` anlegt.
   */
  function createSeasonEndPageState(withLeagueSplit: boolean): GameState {
    let gameState = createCompletedTwoLeagueSeasonState(withLeagueSplit);
    gameState = chooseSponsorOfferForAiTeams(gameState);
    const contracts = { ...(gameState.seasonState.sponsorContractsByTeamId ?? {}) };
    for (const [teamId, contract] of Object.entries(contracts)) {
      if (contract) contracts[teamId] = { ...contract, termSeasons: 3, seasonsRemaining: 3 };
    }
    gameState = { ...gameState, seasonState: { ...gameState.seasonState, sponsorContractsByTeamId: contracts } };
    return patchSeasonSnapshotMarketValueAfterProgression(gameState, gameState.season.id).gameState;
  }

  function runNextSeasonSetup(persistence: ReturnType<typeof createPersistence>) {
    const save = persistence.getSaveById(SAVE_ID)!;
    const token = buildPreSeasonNextSeasonSetupToken(save).confirmToken;
    return applyPreSeasonNextSeasonSetupLightweight(save, token, persistence);
  }

  it("applyLeagueMovementOnce: ohne Liga-Split dieselbe Referenz zurueck, mit Split genau einmal", () => {
    const managerState = createCompletedTwoLeagueSeasonState(false);
    const managerResult = applyLeagueMovementOnce(managerState, { saveId: SAVE_ID, seasonId: managerState.season.id });
    expect(managerResult.applied).toBe(false);
    expect(managerResult.gameState).toBe(managerState);

    const battleState = createCompletedTwoLeagueSeasonState(true);
    const first = applyLeagueMovementOnce(battleState, { saveId: SAVE_ID, seasonId: battleState.season.id });
    expect(first.applied).toBe(true);
    expect(first.gameState.seasonState.leagueMovementLogs).toHaveLength(1);
    const second = applyLeagueMovementOnce(first.gameState, { saveId: SAVE_ID, seasonId: battleState.season.id });
    expect(second.applied).toBe(false);
    expect(second.alreadyDone).toBe(true);
    expect(second.gameState).toBe(first.gameState);
  });

  it("Battle Mode: Auf-/Abstieg passiert beim Saisonwechsel, Snapshot behaelt die alte Liga, Sponsorvertraege rollen gegen die NEUE Liga", async () => {
    const gameState = createSeasonEndPageState(true);
    const completedSeasonId = gameState.season.id;
    const leagueBefore = { ...gameState.seasonState.leagueByTeamId! };
    const expected = computeLeagueMovement(gameState);
    expect(expected.promoted).toHaveLength(RELEGATION_COUNT);
    expect(expected.relegated).toHaveLength(RELEGATION_COUNT);
    const contractsBefore = structuredClone(gameState.seasonState.sponsorContractsByTeamId ?? {});
    const persistence = createPersistence(gameState);

    const setup = runNextSeasonSetup(persistence);
    const saved = persistence.getState();

    expect(setup.applied).toBe(true);
    expect(saved.season.id).not.toBe(completedSeasonId);
    expect(setup.warnings).toContain(
      `league_movement_applied_at_next_season_setup:promoted=${RELEGATION_COUNT}:relegated=${RELEGATION_COUNT}`,
    );

    // Liga-Zuordnung: genau die 6 erwarteten Teams wechseln, ein einziger Log-Eintrag fuer die ALTE Saison.
    for (const change of expected.promoted) expect(saved.seasonState.leagueByTeamId![change.teamId]).toBe("liga1");
    for (const change of expected.relegated) expect(saved.seasonState.leagueByTeamId![change.teamId]).toBe("liga2");
    const changed = Object.keys(leagueBefore).filter((teamId) => saved.seasonState.leagueByTeamId![teamId] !== leagueBefore[teamId]);
    expect(changed).toHaveLength(2 * RELEGATION_COUNT);
    expect(saved.seasonState.leagueMovementLogs).toHaveLength(1);
    expect(saved.seasonState.leagueMovementLogs![0]!.seasonId).toBe(completedSeasonId);

    // Der Snapshot der abgeschlossenen Saison friert die Endtabelle mit der ALTEN Liga ein.
    const snapshot = saved.seasonState.seasonSnapshots!.find((entry) => entry.seasonId === completedSeasonId)!;
    for (const change of expected.relegated) {
      expect(snapshot.finalStandings.find((row) => row.teamId === change.teamId)?.leagueTier).toBe("liga1");
    }

    // Sponsoren: der gerollte Vertrag jedes Wechslers entspricht dem Neubau gegen die NEUE Liga —
    // nicht dem gegen die alte. Absteiger verlieren. Fuer Aufsteiger wird bewusst nur „anders als
    // vorher" geprueft, nicht „mehr": die Leiter laeuft ueber 32 globale Raenge, und ein Team mit
    // Startrang 29..32 faellt in Liga 1 in die Abstiegszone (Raenge 30..32) — dort zahlt Liga 1
    // heute weniger als Liga 2 (eigene Modellfrage in `sponsor-liga-leiter.ts`, nicht Teil dieses Tests).
    const newSalaryFactor = getSponsorV3SalaryFactor(saved);
    const movers = [
      ...expected.promoted.map((change) => ({ ...change, direction: "up" as const })),
      ...expected.relegated.map((change) => ({ ...change, direction: "down" as const })),
    ];
    let checked = 0;
    for (const mover of movers) {
      const oldContract = contractsBefore[mover.teamId];
      const oldTerms = getSponsorV3Terms(oldContract);
      if (!oldContract || !oldTerms?.curveShape || oldContract.sponsorLeihe) continue;
      const rolled = getSponsorV3Terms(saved.seasonState.sponsorContractsByTeamId?.[mover.teamId]);
      expect(rolled).not.toBeNull();
      const contractYear = vertragsjahrAus({ termSeasons: 3, seasonsRemaining: 2 });
      const withNewTier = rerollSponsorV3TermsForNewSeason(oldTerms, { newSalaryFactor, contractYear, leagueTier: mover.toTier });
      const withOldTier = rerollSponsorV3TermsForNewSeason(oldTerms, { newSalaryFactor, contractYear, leagueTier: mover.fromTier });
      expect(rolled!.anchor).toBeCloseTo(withNewTier.anchor, 9);
      expect(rolled!.anchor).not.toBeCloseTo(withOldTier.anchor, 6);
      if (mover.direction === "down") expect(rolled!.anchor).toBeLessThan(withOldTier.anchor);
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(2);
  }, 240000);

  it("Cockpit-Lauf zuerst, dann Saisonwechsel: kein zweiter Auf-/Abstieg, gleiche Liga wie auf der Saisonende-Seite", async () => {
    const cockpitPersistence = createPersistence(createSeasonEndPageState(true));
    const seasonId = cockpitPersistence.getState().season.id;
    const completion = await runLocalSeasonCompletion(
      { saveId: SAVE_ID, seasonId, source: "sqlite", execute: true, dryRun: false, confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN },
      cockpitPersistence,
    );
    expect(completion.steps.find((step) => step.key === "league_movement")?.status).toBe("applied");
    const afterCompletion = cockpitPersistence.getState();
    const cockpitSetup = runNextSeasonSetup(cockpitPersistence);
    const cockpitSaved = cockpitPersistence.getState();
    expect(cockpitSetup.applied).toBe(true);
    expect(cockpitSetup.warnings.some((warning) => warning.startsWith("league_movement_applied_at_next_season_setup"))).toBe(false);
    expect(cockpitSaved.seasonState.leagueMovementLogs).toHaveLength(1);
    expect(cockpitSaved.seasonState.leagueByTeamId).toEqual(afterCompletion.seasonState.leagueByTeamId);

    // Paritaet: die Saisonende-Seite landet bei exakt derselben Liga-Zuordnung.
    const pagePersistence = createPersistence(createSeasonEndPageState(true));
    expect(runNextSeasonSetup(pagePersistence).applied).toBe(true);
    expect(pagePersistence.getState().seasonState.leagueByTeamId).toEqual(cockpitSaved.seasonState.leagueByTeamId);
  }, 240000);

  it("Manager Mode / kein Liga-Split: der Saisonwechsel schreibt weder Liga noch Log (Bit-Identitaets-Kontrollfall)", async () => {
    const persistence = createPersistence(createSeasonEndPageState(false));
    const setup = runNextSeasonSetup(persistence);
    const saved = persistence.getState();
    expect(setup.applied).toBe(true);
    expect(setup.warnings.some((warning) => warning.includes("league_movement"))).toBe(false);
    expect(saved.seasonState.leagueByTeamId).toBeUndefined();
    expect(saved.seasonState.leagueMovementLogs ?? []).toHaveLength(0);
  }, 240000);
});
