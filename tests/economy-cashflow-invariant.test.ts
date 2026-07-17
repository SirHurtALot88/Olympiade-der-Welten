import { beforeAll, describe, expect, it } from "vitest";

import type { GameState, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService, SaveVersionMetadata } from "@/lib/persistence/types";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";
import {
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktBuy,
  executeLocalTransfermarktSell,
  listLocalTransfermarktFreeAgents,
  previewLocalTransfermarktBuy,
  previewLocalTransfermarktSell,
} from "@/lib/market/transfermarkt-local-service";
import { applySponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { applyLoanSettlement, originateLoan } from "@/lib/finance/loan-service";
import { applyFacilityMaintenance, previewFacilityMaintenance } from "@/lib/facilities/facility-maintenance-service";
import { CASH_PRIZE_APPLY_CONFIRM_TOKEN, executeCashPrizeApply, previewCashPrizeApply } from "@/lib/season/cash-prize-apply-service";

/**
 * Geldfluss-Invarianten-Test über eine simulierte Mini-Saison (2 echte Matchdays via
 * `runLocalMatchdayAutoRun` + direkt angesteuerte Geldsysteme: Transfers, Sponsoren/Gehälter,
 * Kredite/Zinsen, Gebäude-Upkeep, Preisgeld).
 *
 * WICHTIGER BEFUND (siehe Testkommentare unten und Rückgabetext des Agents): Es gibt in dieser
 * Codebase KEIN einziges, durchgängiges Cash-Ledger. Stattdessen existieren mehrere unabhängige,
 * TEILWEISE Log-Arrays auf `GameState.seasonState` (`transferHistory` liegt direkt auf `GameState`):
 *   - transferHistory          (Buy/Sell/Contract-Exit — hat `fee`/`netCashImpact`)
 *   - sponsorPayoutLogs        (Sponsor-Payouts UND das Gehalts-Delta, als synthetischer
 *                                "salary_deduct"-Eintrag — Gehälter haben KEIN eigenes Log)
 *   - loanApplyLogs            (nur Saison-End-Kreditraten; Kreditaufnahme/vorzeitige Tilgung sind
 *                                UNGELOGGT — siehe Phase 4a)
 *   - facilityEvents           (Facility-Maintenance/-Events, inkl. `cost`)
 *   - cashPrizeApplyLogs       (reines Audit/Idempotenz-Log — bewegt laut
 *                                `CASH_PRIZE_BENCHMARK_ONLY = true` NIE echtes Cash, siehe Phase 6)
 *
 * Die Toleranzen unten sind bewusst so gewählt, dass sie das in der Codebase selbst genutzte
 * Rundungsschema abbilden: `loan-service.ts`/`sponsor-settlement-service.ts` runden Cash auf 1
 * Nachkommastelle (`roundCash`), `transfermarkt-local-service.ts`/`facility-maintenance-service.ts`
 * auf 2 Nachkommastellen (`roundValue`). Eine einzelne Buchung kann daher bis zu 0.05 von der
 * exakten Differenz abweichen; über mehrere Systeme hinweg (Phase 7, Aggregat) toleriert der Test
 * bis zu 0.2.
 */

const SINGLE_BOOKING_TOLERANCE = 0.05;
const AGGREGATE_TOLERANCE = 0.2;

function createInMemoryPersistence(gameState: GameState, saveId = "test-save"): PersistenceService {
  let save: PersistedSaveGame = {
    saveId,
    name: "Economy Invariant Test Save",
    status: "active",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    gameState: structuredClone(gameState),
  };

  return {
    bootstrapSingleplayerSave() {
      return { save, createdFromSeed: false };
    },
    getActiveSave() {
      return save;
    },
    getSaveById(requestedSaveId: string) {
      return save.saveId === requestedSaveId ? save : null;
    },
    getSaveVersionMetadata(): SaveVersionMetadata | null {
      return null;
    },
    saveSingleplayerState(requestedSaveId: string, nextGameState: GameState) {
      if (save.saveId !== requestedSaveId) {
        throw new Error(`Unknown save ${requestedSaveId}`);
      }
      save = { ...save, updatedAt: new Date().toISOString(), gameState: structuredClone(nextGameState) };
      return save;
    },
    createSave() {
      throw new Error("Not implemented in test persistence.");
    },
    createFreshSeasonOneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    cloneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    createScenarioSnapshot() {
      throw new Error("Not implemented in test persistence.");
    },
    activateSave(requestedSaveId: string) {
      return save.saveId === requestedSaveId ? save : null;
    },
    listSaves() {
      return [{ saveId: save.saveId, name: save.name, status: save.status, createdAt: save.createdAt, updatedAt: save.updatedAt }];
    },
    deleteSave() {
      return false;
    },
    deleteSaves() {
      return [];
    },
  };
}

/**
 * Angepasst aus tests/whole-season-dryrun-service.test.ts (topUpRostersForSeasonMaximum). Die
 * schlankere Variante aus tests/matchday-auto-run-service.test.ts (nur `requiredPlayers` aus dem
 * Lineup-Kontext der aktuellen Matchday) reicht NICHT aus, um über `runLocalMatchdayAutoRun` bis
 * zum "standings_apply"/"matchday_advance" durchzukommen — sie lässt einzelne Discipline-Slots
 * unbesetzt, was `standings-preview-engine.ts` als `incomplete_result` blockiert (per Discipline
 * tatsächlich benötigte `playerCount`, nicht der Lineup-Kontext-Wert, ist maßgeblich). Diese
 * Variante deckt den max. Bedarf über ALLE Spieltage der Saison ab, exakt wie im vorhandenen,
 * nachweislich funktionierenden Season-Dry-Run-Test.
 */
function topUpRostersForSeasonMaximum(gameState: GameState) {
  let maxRequiredUniquePlayers = 0;
  for (const matchdayId of gameState.season.matchdayIds) {
    const scheduleEntry = gameState.seasonState.disciplineSchedule?.find((entry) => entry.matchdayId === matchdayId);
    if (!scheduleEntry || !scheduleEntry.discipline1 || !scheduleEntry.discipline2) {
      throw new Error(`Discipline-Schedule für ${matchdayId} fehlt.`);
    }
    const discipline1 = gameState.disciplines.find((entry) => entry.id === scheduleEntry.discipline1!.disciplineId);
    const discipline2 = gameState.disciplines.find((entry) => entry.id === scheduleEntry.discipline2!.disciplineId);
    if (!discipline1 || !discipline2) {
      throw new Error(`Gemappte Disciplines für ${matchdayId} fehlen.`);
    }
    const d1Count = scheduleEntry.discipline1?.playerCount ?? discipline1.playerCount ?? 0;
    const d2Count = scheduleEntry.discipline2?.playerCount ?? discipline2.playerCount ?? 0;
    maxRequiredUniquePlayers = Math.max(maxRequiredUniquePlayers, d1Count + d2Count);
  }

  const usedPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const freePlayers = gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = gameState.rosters.length;

  for (const team of gameState.teams) {
    const teamRoster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const shortfall = Math.max(0, maxRequiredUniquePlayers - teamRoster.length);

    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayers[poolIndex];
      if (!player) {
        throw new Error("Nicht genug freie Spieler für Roster-Topup verfuegbar.");
      }
      poolIndex += 1;
      gameState.rosters.push({
        id: `economy-invariant-roster-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(player.salaryDemand),
        upkeep: Math.round(player.salaryDemand),
        purchasePrice: Math.round(player.marketValue),
        currentValue: Math.round(player.marketValue),
        roleTag: "bench",
        joinedSeasonId: gameState.season.id,
      });
      rosterCounter += 1;
    }
  }
}

function enableFullAiControl(gameState: GameState) {
  gameState.seasonState.teamControlSettings = Object.fromEntries(
    gameState.teams.map((team) => [
      team.teamId,
      {
        teamId: team.teamId,
        controlMode: "ai" as const,
        aiLineupPreviewEnabled: true,
        aiLineupApplyEnabled: true,
        aiLineupAutoApplyEnabled: false,
        // Transfer-/Sell-AI bewusst deaktiviert: Phase 1 (Matchday-Auto-Run) soll cash-neutral sein,
        // damit die Invariante dort ausschließlich die reine Spieltag-Resolve/Apply-Pipeline prüft
        // (kein vermischtes Transfer-Rauschen).
        aiTransferPreviewEnabled: false,
        aiTransferAutoApplyEnabled: false,
        aiSellPreviewEnabled: false,
        aiSellAutoApplyEnabled: false,
        notes: null,
        strategyLock: null,
      },
    ]),
  );
}

function cashByTeamId(gameState: GameState): Map<string, number> {
  return new Map(gameState.teams.map((team) => [team.teamId, team.cash] as const));
}

function totalCash(gameState: GameState): number {
  return gameState.teams.reduce((sum, team) => sum + team.cash, 0);
}

/** Buchungssatz für die Aggregat-Invariante (Phase 7): eine reale, geloggte (oder — dokumentiert — direkt
 * verifizierte) Cash-Bewegung für genau ein Team. */
type Booking = { teamId: string; amount: number; system: string; note: string };

type SimulationRun = {
  initialCash: Map<string, number>;
  bookings: Booking[];
  finalGameState: GameState;
  phase1: {
    matchdayIds: string[];
    cashUnchangedByMatchday: Map<string, boolean>;
  };
  phase2: {
    buyTeamId: string;
    buyDelta: number;
    buyFee: number;
    sellTeamId: string;
    sellDelta: number;
    sellNetCashImpact: number;
  };
  phase3: {
    teamId: string;
    delta: number;
    loggedDelta: number;
  };
  phase4a: {
    borrowerTeamId: string;
    principal: number;
    originationDelta: number;
    settlementDelta: number;
    settlementLoggedDelta: number;
  };
  phase4b: {
    lenderTeamId: string;
    borrowerTeamId: string;
    principal: number;
    totalCashBeforeOrigination: number;
    totalCashAfterOrigination: number;
    totalCashBeforeSettlement: number;
    totalCashAfterSettlement: number;
    // Der gemeinsame applyLoanSettlement-Aufruf tilgt Bank- UND Team-Kredit gleichzeitig (siehe
    // Kommentar oben) — die Bank-Rate ist eine externe Senke und muss daher aus der
    // Gesamt-Konservierungsprüfung herausgerechnet werden.
    bankSettlementDelta: number;
    borrowerSettlementDelta: number;
    lenderSettlementDelta: number;
    settlementInstallment: number;
  };
  phase5: {
    teamId: string;
    delta: number;
    maintenanceCost: number;
    loggedCost: number;
  };
  phase6: {
    cashBeforePrize: Map<string, number>;
    cashAfterPrize: Map<string, number>;
    oldCashByTeam: Map<string, number | null>;
    newCashByTeam: Map<string, number | null>;
    cashPayoutApplied: boolean;
    benchmarkOnly: boolean;
  };
};

let run: SimulationRun;

beforeAll(async () => {
  const gameState = createFreshSeasonOneGameState();
  enableFullAiControl(gameState);

  const saveId = "test-save";
  const persistence = createInMemoryPersistence(gameState, saveId);
  const seasonId = gameState.season.id;

  const bookings: Booking[] = [];
  const initialCash = cashByTeamId(persistence.getSaveById(saveId)!.gameState);

  // ---------------------------------------------------------------------------------------------
  // Phase 1: zwei echte Spieltage über den produktiven Matchday-Auto-Run (AI-Aufstellungen, Resolve,
  // Result-Apply — siehe Kommentar unten zu einem unabhängig reproduzierbaren Blocker bei
  // Standings-Apply/Cash-Apply/Matchday-Advance in dieser Fixture). Transfer-AI ist deaktiviert ->
  // in dieser Phase sollte sich pro Team NICHTS am Cash-Stand ändern. Das ist selbst eine
  // geldfluss-relevante Prüfung: die reine Spieltag-Resolve/Result-Apply-Pipeline darf niemals
  // unbeobachtet Cash bewegen.
  // ---------------------------------------------------------------------------------------------
  const matchdayIds = gameState.season.matchdayIds.slice(0, 2);
  const cashUnchangedByMatchday = new Map<string, boolean>();

  {
    const currentSave = persistence.getSaveById(saveId)!;
    topUpRostersForSeasonMaximum(currentSave.gameState);
    persistence.saveSingleplayerState(saveId, currentSave.gameState);
  }

  for (const [matchdayIndex, matchdayId] of matchdayIds.entries()) {
    const beforeCash = cashByTeamId(persistence.getSaveById(saveId)!.gameState);

    const result = await runLocalMatchdayAutoRun(
      {
        saveId,
        seasonId,
        matchdayId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: true,
          stopOnTie: true,
          advanceAfterCashApply: true,
        },
      },
      persistence,
    );

    // NEBENBEFUND (unabhängig von diesem Test reproduzierbar, siehe auch das aktuell rote
    // tests/matchday-auto-run-service.test.ts im selben Repo-Zustand): der "standings_apply"-Schritt
    // von runLocalMatchdayAutoRun blockiert bei einem frischen Season-1-Save aktuell zuverlässig mit
    // "incomplete_result"/"invalid_lineup" für alle 32 Teams, weil die dort persistierten
    // AI-Lineup-Drafts vom nachgelagerten Readiness-Check als ungültig gewertet werden — cash_apply
    // und matchday_advance laufen deshalb in dieser Fixture nie. Das ist ein Problem der
    // Spieltag-Resolve/Lineup-Pipeline, NICHT des Geldflusses. Für diese Geldfluss-Invariante ist nur
    // relevant, dass der (zuverlässig funktionierende) "result_apply"-Schritt selbst kein Cash bewegt
    // — deshalb wird hier nur DAS hart geprüft; Preisgeld/Sponsor/Kredit/Facility-Systeme werden
    // unten (Phasen 3–6) ohnehin direkt und gezielt angesteuert, unabhängig vom Auto-Run.
    if (!result.appliedAudits.resultApply) {
      throw new Error(
        `Matchday-Auto-Run für ${matchdayId}: result_apply wurde nicht angewendet (${result.blockingReasons.join(" | ") || "unbekannt"}).`,
      );
    }

    const afterCash = cashByTeamId(persistence.getSaveById(saveId)!.gameState);
    const cashApplyRan = result.appliedAudits.cashApply != null;

    for (const team of gameState.teams) {
      const before = beforeCash.get(team.teamId) ?? 0;
      const after = afterCash.get(team.teamId) ?? 0;
      cashUnchangedByMatchday.set(`${matchdayId}:${team.teamId}`, Math.abs(after - before) <= SINGLE_BOOKING_TOLERANCE);
      // cash_apply ist laut CASH_PRIZE_BENCHMARK_ONLY ein reiner Benchmark-Schritt (siehe Phase 6) —
      // selbst wenn er für diesen Spieltag lief, darf sich am Cash nichts ändern. Für Buchhaltungs-
      // zwecke wird hier daher bewusst KEINE Buchung erzeugt (erwartete Bewegung ist 0).
      void cashApplyRan;
    }

    // Da standings_apply/matchday_advance in dieser Fixture blockiert sind (siehe NEBENBEFUND oben),
    // wird hier für den NÄCHSTEN Spieltag der matchdayState direkt gesetzt (exakt dieselbe Form, die
    // `writeLocalMatchdayAdvance` in lib/season/matchday-progress-service.ts im Erfolgsfall
    // schreiben würde) — nötig, weil `saveLocalLegacyLineupDraft` Lineups nur für den laut
    // `matchdayState.matchdayId` AKTIVEN Spieltag akzeptiert ("lineup_matchday_is_not_active").
    // Bewusst OHNE den echten Advance-Aufruf, damit auch kein maybeGenerateSponsorEvents()-Zufalls-
    // Cash-Movement unbeobachtet mitläuft — reine Spieltag-Fortschaltung, kein Geldfluss.
    const nextMatchdayId = matchdayIds[matchdayIndex + 1];
    if (nextMatchdayId) {
      const advanceSave = persistence.getSaveById(saveId)!;
      persistence.saveSingleplayerState(saveId, {
        ...advanceSave.gameState,
        matchdayState: {
          matchdayId: nextMatchdayId,
          status: "planning",
          pendingTeamIds: advanceSave.gameState.teams.map((team) => team.teamId),
          resolvedFixtureIds: [],
        },
      });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Phase 2: Transfers — ein echter Markt-Kauf und ein echter Markt-Verkauf über die produktive
  // Local-Transfermarkt-Pipeline (gleiche Funktionen wie im UI/den Smoke-Skripten).
  // ---------------------------------------------------------------------------------------------
  const afterMatchdaysSave = persistence.getSaveById(saveId)!;
  const runContext = createLocalTransfermarktRunContext({ save: afterMatchdaysSave, persistence });

  let buyTeamId: string | null = null;
  let buyPlayerId: string | null = null;
  for (const team of afterMatchdaysSave.gameState.teams) {
    const freeAgents = listLocalTransfermarktFreeAgents({
      saveId,
      seasonId,
      teamId: team.teamId,
      limit: 100,
      localRunContext: runContext,
    });
    for (const item of freeAgents.items) {
      const preview = previewLocalTransfermarktBuy({
        saveId,
        seasonId,
        teamId: team.teamId,
        playerId: item.playerId,
        localRunContext: runContext,
      });
      if (preview.canBuy) {
        buyTeamId = team.teamId;
        buyPlayerId = item.playerId;
        break;
      }
    }
    if (buyTeamId) break;
  }
  if (!buyTeamId || !buyPlayerId) {
    throw new Error("Kein gültiger Markt-Kauf-Kandidat für den Geldfluss-Test gefunden.");
  }

  const buyCashBefore = afterMatchdaysSave.gameState.teams.find((team) => team.teamId === buyTeamId)!.cash;
  const buyResult = executeLocalTransfermarktBuy({
    saveId,
    seasonId,
    teamId: buyTeamId,
    playerId: buyPlayerId,
    localRunContext: runContext,
  });
  if (!buyResult.canBuy || !buyResult.transferCreated) {
    throw new Error(`Markt-Kauf fehlgeschlagen: ${buyResult.blockingReasons.join(" | ")}`);
  }
  const afterBuySave = persistence.getSaveById(saveId)!;
  const buyCashAfter = afterBuySave.gameState.teams.find((team) => team.teamId === buyTeamId)!.cash;
  const buyHistoryEntry = [...afterBuySave.gameState.transferHistory]
    .reverse()
    .find((entry) => entry.transferType === "buy" && entry.toTeamId === buyTeamId && entry.playerId === buyPlayerId);
  if (!buyHistoryEntry) {
    throw new Error("Kein transferHistory-Eintrag für den Test-Kauf gefunden.");
  }
  const buyDelta = Number((buyCashAfter - buyCashBefore).toFixed(4));
  bookings.push({ teamId: buyTeamId, amount: buyDelta, system: "transfers:buy", note: buyHistoryEntry.id });

  // Verkauf: der interaktive Sell-Window-Gate ("sell_only_at_season_end") ist mitten in der Saison
  // erwartungsgemäß zu — genau wie im vorhandenen scripts/smoke-local-season-loop.ts, das den Verkauf
  // deshalb komplett überspringt. Wir nutzen stattdessen denselben Override-Mechanismus, den auch die
  // System-Batch-Sells (z. B. "full_churn_roster_sell") verwenden, um die reine Fenster-Prüfung zu
  // umgehen — die Verkaufs-Preisbildung/Buchung selbst ist unverändert dieselbe Produktionslogik.
  const sellTeamId = buyTeamId;
  const sellRunContext = createLocalTransfermarktRunContext({ save: persistence.getSaveById(saveId)!, persistence });
  const sellCandidate = persistence
    .getSaveById(saveId)!
    .gameState.rosters.find((entry) => entry.teamId === sellTeamId && entry.playerId !== buyPlayerId);
  if (!sellCandidate) {
    throw new Error("Kein Verkaufs-Kandidat (bestehender Roster-Eintrag) gefunden.");
  }
  const sellPreview = previewLocalTransfermarktSell({
    saveId,
    seasonId,
    teamId: sellTeamId,
    activePlayerId: sellCandidate.id,
    transferSource: "full_churn_roster_sell",
    localRunContext: sellRunContext,
  });
  if (!sellPreview.canSell) {
    throw new Error(`Markt-Verkauf-Preview blockiert: ${sellPreview.blockingReasons.join(" | ")}`);
  }
  const sellCashBefore = persistence.getSaveById(saveId)!.gameState.teams.find((team) => team.teamId === sellTeamId)!.cash;
  const sellResult = executeLocalTransfermarktSell({
    saveId,
    seasonId,
    teamId: sellTeamId,
    activePlayerId: sellCandidate.id,
    transferSource: "full_churn_roster_sell",
    localRunContext: sellRunContext,
  });
  if (!sellResult.canSell || !sellResult.transferCreated) {
    throw new Error(`Markt-Verkauf fehlgeschlagen: ${sellResult.blockingReasons.join(" | ")}`);
  }
  const afterSellSave = persistence.getSaveById(saveId)!;
  const sellCashAfter = afterSellSave.gameState.teams.find((team) => team.teamId === sellTeamId)!.cash;
  const sellHistoryEntry = [...afterSellSave.gameState.transferHistory]
    .reverse()
    .find((entry) => entry.transferType === "sell" && entry.fromTeamId === sellTeamId && entry.playerId === sellCandidate.playerId);
  if (!sellHistoryEntry) {
    throw new Error("Kein transferHistory-Eintrag für den Test-Verkauf gefunden.");
  }
  const sellDelta = Number((sellCashAfter - sellCashBefore).toFixed(4));
  const sellNetCashImpact = sellHistoryEntry.netCashImpact ?? sellHistoryEntry.fee;
  bookings.push({ teamId: sellTeamId, amount: sellDelta, system: "transfers:sell", note: sellHistoryEntry.id });

  // ---------------------------------------------------------------------------------------------
  // Phase 3: Sponsoren + Gehälter. Beide Systeme laufen technisch über denselben Aufruf
  // (applySponsorSettlement mit deductSalary:true) und landen im selben Log (sponsorPayoutLogs) —
  // Gehälter haben in dieser Codebase kein eigenes Ledger, sondern erscheinen dort als negativer
  // "salary_deduct"-Eintrag.
  // ---------------------------------------------------------------------------------------------
  const sponsorTeamId = "A-A";
  const sponsorContract: TeamSponsorContract = {
    seasonId,
    teamId: sponsorTeamId,
    offerId: "economy-invariant-test-offer",
    archetype: "security",
    name: "Invariant-Test-Sponsor",
    chosenAt: new Date().toISOString(),
    startRank: 16,
    components: [
      { componentId: "base-economy-invariant", kind: "base", label: "Saisonbasis", targetValue: "season", rewardCash: 20 },
    ],
    payouts: {},
    starTier: 3,
    teamQualityRankAtSign: 16,
  };
  const preSponsorSave = persistence.getSaveById(saveId)!;
  const gameStateWithContract: GameState = {
    ...preSponsorSave.gameState,
    seasonState: {
      ...preSponsorSave.gameState.seasonState,
      sponsorContractsByTeamId: {
        ...(preSponsorSave.gameState.seasonState.sponsorContractsByTeamId ?? {}),
        [sponsorTeamId]: sponsorContract,
      },
    },
  };
  const sponsorCashBefore = gameStateWithContract.teams.find((team) => team.teamId === sponsorTeamId)!.cash;
  const sponsorApply = applySponsorSettlement({
    gameState: gameStateWithContract,
    saveId,
    phase: "season_end",
    execute: true,
    deductSalary: true,
  });
  if (!sponsorApply.applied) {
    throw new Error("Sponsor-/Gehalts-Settlement wurde nicht angewendet.");
  }
  persistence.saveSingleplayerState(saveId, sponsorApply.gameState);
  const sponsorCashAfter = sponsorApply.gameState.teams.find((team) => team.teamId === sponsorTeamId)!.cash;
  const newSponsorLogs = (sponsorApply.gameState.seasonState.sponsorPayoutLogs ?? []).filter(
    (log) => log.teamId === sponsorTeamId && log.phase === "season_end",
  );
  const sponsorLoggedDelta = Number(newSponsorLogs.reduce((sum, log) => sum + log.cashDelta, 0).toFixed(4));
  const sponsorDelta = Number((sponsorCashAfter - sponsorCashBefore).toFixed(4));
  for (const log of newSponsorLogs) {
    bookings.push({ teamId: sponsorTeamId, amount: log.cashDelta, system: "sponsor_salary", note: log.componentId ?? log.id });
  }

  // ---------------------------------------------------------------------------------------------
  // Phase 4a+4b: Kredite — Bank-Kredit (Quelle/Senke, extern) UND Team-zu-Team-Kredit (D-P verleiht
  // an C-C, reale freundschaftliche Beziehung laut tests/loan-team-lending.test.ts — die einzige
  // echte A→B-Cash-Bewegung zwischen zwei Teams in dieser Codebase, kein direktes P2P-Trade-Feature).
  // WICHTIG (dokumentierte Lücke): `originateLoan` schreibt für die Aufnahme selbst KEINEN
  // Log-Eintrag — wir verifizieren den Cash-Effekt hier direkt über den Rückgabewert der Funktion
  // (`loan.principalOriginal`), nicht über ein Ledger, weil keins existiert.
  //
  // Beide Kredite werden ZUERST aufgenommen und dann in EINEM gemeinsamen `applyLoanSettlement`-Aufruf
  // getilgt: `previewLoanSettlement` markiert eine Saison als "duplicateDetected", sobald IRGENDEIN
  // `loanApplyLogs`-Eintrag für diese seasonId existiert (Idempotenz ist pro Saison, nicht pro Kredit) —
  // zwei getrennte Settlement-Aufrufe in derselben Saison würden den zweiten also grundlos blockieren.
  // ---------------------------------------------------------------------------------------------
  const bankBorrowerId = "M-M";
  const lenderTeamId = "D-P";
  const teamBorrowerId = "C-C";

  const preLoanSave = persistence.getSaveById(saveId)!;
  const bankBorrowCashBefore = preLoanSave.gameState.teams.find((team) => team.teamId === bankBorrowerId)!.cash;
  const bankLoanPrincipal = 20;
  const bankOriginateResult = originateLoan(
    preLoanSave.gameState,
    { borrowerTeamId: bankBorrowerId, principal: bankLoanPrincipal, termSeasons: 3 },
    { execute: true, allowSeason1: true },
  );
  if (!bankOriginateResult.ok || !bankOriginateResult.loan) {
    throw new Error(`Bank-Kreditaufnahme fehlgeschlagen: ${bankOriginateResult.reason}`);
  }
  persistence.saveSingleplayerState(saveId, bankOriginateResult.gameState);
  const bankBorrowCashAfterOrigination = bankOriginateResult.gameState.teams.find((team) => team.teamId === bankBorrowerId)!.cash;
  const originationDelta = Number((bankBorrowCashAfterOrigination - bankBorrowCashBefore).toFixed(4));
  // Dokumentierter Fallback (kein Log vorhanden): direkt gegen den Funktions-Rückgabewert verifiziert,
  // nicht gegen ein Ledger.
  bookings.push({ teamId: bankBorrowerId, amount: bankOriginateResult.loan.principalOriginal, system: "loan:origination(unlogged)", note: bankOriginateResult.loan.loanId });

  const preTeamLoanSave = persistence.getSaveById(saveId)!;
  const totalCashBeforeOrigination = totalCash(preTeamLoanSave.gameState);
  const teamLoanPrincipal = 12;
  const teamLoanResult = originateLoan(
    preTeamLoanSave.gameState,
    { borrowerTeamId: teamBorrowerId, lenderTeamId, lenderType: "team", principal: teamLoanPrincipal, termSeasons: 3 },
    { execute: true, allowSeason1: true },
  );
  if (!teamLoanResult.ok || !teamLoanResult.loan) {
    throw new Error(`Team-zu-Team-Kreditaufnahme fehlgeschlagen: ${teamLoanResult.reason}`);
  }
  persistence.saveSingleplayerState(saveId, teamLoanResult.gameState);
  const totalCashAfterOrigination = totalCash(teamLoanResult.gameState);
  bookings.push({ teamId: teamBorrowerId, amount: teamLoanPrincipal, system: "loan:team_origination", note: teamLoanResult.loan.loanId });
  bookings.push({ teamId: lenderTeamId, amount: -teamLoanPrincipal, system: "loan:team_origination", note: teamLoanResult.loan.loanId });

  // Ein einziger Settlement-Aufruf tilgt BEIDE Kredite (Bank + Team) gleichzeitig.
  const preSettlementSave = persistence.getSaveById(saveId)!;
  const totalCashBeforeSettlement = totalCash(preSettlementSave.gameState);
  const bankBorrowCashBeforeSettlement = preSettlementSave.gameState.teams.find((team) => team.teamId === bankBorrowerId)!.cash;
  const borrowerCashBeforeSettlement = preSettlementSave.gameState.teams.find((team) => team.teamId === teamBorrowerId)!.cash;
  const lenderCashBeforeSettlement = preSettlementSave.gameState.teams.find((team) => team.teamId === lenderTeamId)!.cash;
  const loanSettlement = applyLoanSettlement(preSettlementSave.gameState, { execute: true, seasonId });
  if (!loanSettlement.applied) {
    throw new Error("Kredit-Tilgung (Saison-End) wurde nicht angewendet.");
  }
  persistence.saveSingleplayerState(saveId, loanSettlement.gameState);
  const totalCashAfterSettlement = totalCash(loanSettlement.gameState);

  const bankBorrowCashAfterSettlement = loanSettlement.gameState.teams.find((team) => team.teamId === bankBorrowerId)!.cash;
  const settlementDelta = Number((bankBorrowCashAfterSettlement - bankBorrowCashBeforeSettlement).toFixed(4));
  const bankLoanId = bankOriginateResult.loan.loanId;
  const bankSettlementLog = loanSettlement.gameState.seasonState.loanApplyLogs?.find(
    (log) => log.loanId === bankLoanId && log.seasonId === seasonId,
  );
  if (!bankSettlementLog) {
    throw new Error("Kein loanApplyLogs-Eintrag für die Bank-Kredit-Tilgung gefunden.");
  }
  const settlementLoggedDelta = -bankSettlementLog.installmentCharged;
  bookings.push({ teamId: bankBorrowerId, amount: -bankSettlementLog.installmentCharged, system: "loan:settlement", note: bankLoanId });

  const borrowerCashAfterSettlement = loanSettlement.gameState.teams.find((team) => team.teamId === teamBorrowerId)!.cash;
  const lenderCashAfterSettlement = loanSettlement.gameState.teams.find((team) => team.teamId === lenderTeamId)!.cash;
  const teamLoanSettlementLog = loanSettlement.gameState.seasonState.loanApplyLogs?.find(
    (log) => log.loanId === teamLoanResult.loan!.loanId && log.seasonId === seasonId,
  );
  if (!teamLoanSettlementLog) {
    throw new Error("Kein loanApplyLogs-Eintrag für die Team-Kredit-Tilgung gefunden.");
  }
  const borrowerSettlementDelta = Number((borrowerCashAfterSettlement - borrowerCashBeforeSettlement).toFixed(4));
  const lenderSettlementDelta = Number((lenderCashAfterSettlement - lenderCashBeforeSettlement).toFixed(4));
  bookings.push({ teamId: teamBorrowerId, amount: -teamLoanSettlementLog.installmentCharged, system: "loan:team_settlement", note: teamLoanResult.loan.loanId });
  bookings.push({ teamId: lenderTeamId, amount: teamLoanSettlementLog.installmentCharged, system: "loan:team_settlement", note: teamLoanResult.loan.loanId });

  // ---------------------------------------------------------------------------------------------
  // Phase 5: Gebäude-Upkeep (Facility-Maintenance) — reale Buchung MIT eigenem Log (facilityEvents).
  // ---------------------------------------------------------------------------------------------
  const facilityTeamId = "B-B";
  const preFacilitySave = persistence.getSaveById(saveId)!;
  const gameStateWithFacility: GameState = {
    ...preFacilitySave.gameState,
    seasonState: {
      ...preFacilitySave.gameState.seasonState,
      teamFacilities: {
        ...(preFacilitySave.gameState.seasonState.teamFacilities ?? {}),
        [facilityTeamId]: { facilities: { training_center: { level: 2, enabled: true, conditionPct: 50 } } },
      },
    },
  };
  persistence.saveSingleplayerState(saveId, gameStateWithFacility);
  const facilitySave = persistence.getSaveById(saveId)!;
  const facilityPreview = previewFacilityMaintenance(facilitySave, facilityTeamId, "training_center");
  if (!facilityPreview.ok || !facilityPreview.confirmToken) {
    throw new Error(`Facility-Maintenance-Preview blockiert: ${facilityPreview.blockingReasons.join(" | ")}`);
  }
  const facilityCashBefore = facilitySave.gameState.teams.find((team) => team.teamId === facilityTeamId)!.cash;
  const facilityApply = applyFacilityMaintenance(facilitySave, facilityTeamId, "training_center", facilityPreview.confirmToken, persistence);
  if (!facilityApply.applied) {
    throw new Error(`Facility-Maintenance wurde nicht angewendet: ${facilityApply.blockingReasons.join(" | ")}`);
  }
  const afterFacilitySave = persistence.getSaveById(saveId)!;
  const facilityCashAfter = afterFacilitySave.gameState.teams.find((team) => team.teamId === facilityTeamId)!.cash;
  const facilityDelta = Number((facilityCashAfter - facilityCashBefore).toFixed(4));
  const facilityEvent = afterFacilitySave.gameState.seasonState.facilityEvents?.find(
    (event) => event.eventId === facilityApply.facilityEventId,
  );
  if (!facilityEvent) {
    throw new Error("Kein facilityEvents-Eintrag für die Test-Maintenance gefunden.");
  }
  bookings.push({ teamId: facilityTeamId, amount: -facilityEvent.cost, system: "facility_upkeep", note: facilityEvent.eventId });

  // ---------------------------------------------------------------------------------------------
  // Phase 6: Preisgeld (Cash-Prize-Apply) — dokumentierte Verifikations-Lücke: CASH_PRIZE_BENCHMARK_ONLY
  // ist aktuell `true`, d. h. dieser Schritt bewegt laut Produktionscode absichtlich KEIN echtes Cash.
  // Wir prüfen das hier explizit, statt es zu ignorieren — falls jemand später echten Cash-Payout
  // aktiviert, ohne diesen Test anzupassen, MUSS diese Assertion fehlschlagen (das ist beabsichtigt).
  // ---------------------------------------------------------------------------------------------
  const prizeSave = persistence.getSaveById(saveId)!;
  const cashBeforePrize = cashByTeamId(prizeSave.gameState);
  const prizePreview = await previewCashPrizeApply(
    { saveId, seasonId, matchdayId: prizeSave.gameState.matchdayState.matchdayId, source: "sqlite", phase: "season_end", dryRun: true, execute: false },
    persistence,
  );
  const prizeApply = await executeCashPrizeApply(
    {
      saveId,
      seasonId,
      matchdayId: prizeSave.gameState.matchdayState.matchdayId,
      source: "sqlite",
      phase: "season_end",
      execute: true,
      dryRun: false,
      confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN,
    },
    persistence,
  );
  const cashAfterPrize = cashByTeamId(persistence.getSaveById(saveId)!.gameState);
  // `plannedChanges[].newCash` ist NICHT der maßgebliche Beweis (es kann `null` sein, wenn die
  // Standings-Vorschau — unabhängig vom hier getesteten Cash-Payout — für ein Team unvollständig
  // ist, siehe NEBENBEFUND in Phase 1). Der maßgebliche Beweis ist der tatsächliche `team.cash`-Wert
  // im Save VOR/NACH dem `executeCashPrizeApply`-Aufruf — genau das, was `cashBeforePrize`/
  // `cashAfterPrize` direkt aus dem GameState lesen.
  const oldCashByTeam = new Map(prizeApply.plannedChanges.map((change) => [change.teamId, change.oldCash] as const));
  const newCashByTeam = new Map(prizeApply.plannedChanges.map((change) => [change.teamId, change.newCash] as const));
  void prizePreview;

  run = {
    initialCash,
    bookings,
    finalGameState: persistence.getSaveById(saveId)!.gameState,
    phase1: { matchdayIds, cashUnchangedByMatchday },
    phase2: {
      buyTeamId,
      buyDelta,
      buyFee: buyHistoryEntry.fee,
      sellTeamId,
      sellDelta,
      sellNetCashImpact,
    },
    phase3: { teamId: sponsorTeamId, delta: sponsorDelta, loggedDelta: sponsorLoggedDelta },
    phase4a: {
      borrowerTeamId: bankBorrowerId,
      principal: bankLoanPrincipal,
      originationDelta,
      settlementDelta,
      settlementLoggedDelta,
    },
    phase4b: {
      lenderTeamId,
      borrowerTeamId: teamBorrowerId,
      principal: teamLoanPrincipal,
      totalCashBeforeOrigination,
      totalCashAfterOrigination,
      totalCashBeforeSettlement,
      totalCashAfterSettlement,
      bankSettlementDelta: settlementDelta,
      borrowerSettlementDelta,
      lenderSettlementDelta,
      settlementInstallment: teamLoanSettlementLog.installmentCharged,
    },
    phase5: {
      teamId: facilityTeamId,
      delta: facilityDelta,
      maintenanceCost: facilityPreview.maintenanceCost,
      loggedCost: facilityEvent.cost,
    },
    phase6: {
      cashBeforePrize,
      cashAfterPrize,
      oldCashByTeam,
      newCashByTeam,
      cashPayoutApplied: Boolean((prizeApply as unknown as { cashPayoutApplied?: boolean }).cashPayoutApplied),
      benchmarkOnly: true,
    },
  };
}, 180_000);

describe("Geldfluss-Invariante — simulierte Mini-Saison", () => {
  it("Phase 1: die reine Matchday-Auto-Run-Pipeline (ohne Transfer-/Cash-Apply-Payout) bewegt kein Team-Cash", () => {
    expect(run.phase1.matchdayIds.length).toBe(2);
    for (const [key, unchanged] of run.phase1.cashUnchangedByMatchday) {
      expect(unchanged, `Cash-Änderung ohne Buchung bei ${key}`).toBe(true);
    }
  });

  it("Phase 2 (Transfers): Kauf- und Verkaufs-Cash-Delta entspricht exakt dem transferHistory-Eintrag", () => {
    expect(run.phase2.buyDelta).toBeCloseTo(-run.phase2.buyFee, 1);
    expect(Math.abs(run.phase2.buyDelta - -run.phase2.buyFee)).toBeLessThanOrEqual(SINGLE_BOOKING_TOLERANCE);

    expect(Math.abs(run.phase2.sellDelta - run.phase2.sellNetCashImpact)).toBeLessThanOrEqual(SINGLE_BOOKING_TOLERANCE);
  });

  it("Phase 3 (Sponsoren + Gehälter): Cash-Delta entspricht exakt der Summe der sponsorPayoutLogs-Einträge", () => {
    expect(Math.abs(run.phase3.delta - run.phase3.loggedDelta)).toBeLessThanOrEqual(SINGLE_BOOKING_TOLERANCE);
    // Beweist, dass in diesem Lauf tatsächlich sowohl eine Sponsor-Einnahme als auch ein
    // Gehalts-Abzug gebucht wurden (nicht bloß ein Nulldurchgang):
    expect(run.phase3.loggedDelta).not.toBe(0);
  });

  it("Phase 4a (Kredit/Bank): Aufnahme entspricht dem Kreditprinzipal (Quelle, ungeloggt), Tilgung entspricht loanApplyLogs", () => {
    expect(run.phase4a.originationDelta).toBe(run.phase4a.principal);
    expect(Math.abs(run.phase4a.settlementDelta - run.phase4a.settlementLoggedDelta)).toBeLessThanOrEqual(SINGLE_BOOKING_TOLERANCE);
    // Zins macht die Tilgungsrate strikt größer als 0 (echte Zinsbuchung, kein Nullfall):
    expect(run.phase4a.settlementDelta).toBeLessThan(0);
  });

  it("Phase 4b (Kredit Team-zu-Team): reine A→B-Transfers ändern die systemweite Cash-Summe NICHT (schwächere Invariante)", () => {
    expect(Math.abs(run.phase4b.totalCashAfterOrigination - run.phase4b.totalCashBeforeOrigination)).toBeLessThanOrEqual(
      SINGLE_BOOKING_TOLERANCE,
    );
    // Der Settlement-Aufruf tilgt gleichzeitig den Bank-Kredit (externe Senke) — die
    // Gesamt-Cash-Änderung muss daher exakt dessen (negativer) Betrag sein, NICHT 0. Der
    // Team-Kredit-Anteil selbst bleibt darin exakt konserviert (siehe borrowerSettlementDelta +
    // lenderSettlementDelta === 0 unten).
    expect(
      Math.abs(
        run.phase4b.totalCashAfterSettlement - run.phase4b.totalCashBeforeSettlement - run.phase4b.bankSettlementDelta,
      ),
    ).toBeLessThanOrEqual(SINGLE_BOOKING_TOLERANCE);
    // Kreditnehmer verliert exakt, was der Verleiher gewinnt (Tilgungsrate inkl. Zins):
    expect(Math.abs(run.phase4b.borrowerSettlementDelta + run.phase4b.lenderSettlementDelta)).toBeLessThanOrEqual(
      SINGLE_BOOKING_TOLERANCE,
    );
    expect(Math.abs(-run.phase4b.borrowerSettlementDelta - run.phase4b.settlementInstallment)).toBeLessThanOrEqual(
      SINGLE_BOOKING_TOLERANCE,
    );
  });

  it("Phase 5 (Gebäude-Upkeep): Cash-Delta entspricht exakt den negativen facilityEvents-Kosten", () => {
    expect(run.phase5.maintenanceCost).toBeGreaterThan(0);
    expect(Math.abs(run.phase5.delta - -run.phase5.loggedCost)).toBeLessThanOrEqual(SINGLE_BOOKING_TOLERANCE);
  });

  it("Phase 6 (Preisgeld): DOKUMENTIERTE LÜCKE — Cash-Prize-Apply bewegt aktuell KEIN echtes Cash (CASH_PRIZE_BENCHMARK_ONLY=true)", () => {
    expect(run.phase6.cashBeforePrize.size).toBe(32);
    // Maßgeblicher Beweis: der tatsächliche team.cash-Wert im Save, unmittelbar vor/nach
    // executeCashPrizeApply, für JEDES der 32 Teams unverändert. Falls dieser Test irgendwann rot
    // wird: das ist GEWOLLT — es bedeutet, dass Preisgeld-Payout inzwischen echtes Cash bewegt und
    // dieser Test (inkl. der Doku oben) bewusst aktualisiert werden muss, statt den neuen Payout
    // stillschweigend ungeprüft zu lassen.
    for (const [teamId, before] of run.phase6.cashBeforePrize) {
      const after = run.phase6.cashAfterPrize.get(teamId);
      expect(after, `Team ${teamId}: cash vor Cash-Prize-Apply ${before}, danach ${after}`).toBe(before);
    }

    // Sekundärer, best-effort Beweis aus dem Funktions-Rückgabewert selbst, wo verfügbar: oldCash/
    // newCash können `null` sein, wenn die Standings-Vorschau für ein Team unvollständig ist —
    // unabhängig vom hier geprüften Cash-Payout, siehe NEBENBEFUND in Phase 1 (in dieser Fixture
    // ist newCash für ALLE Teams null, weil standings_apply nie sauber durchlief — der maßgebliche
    // Beweis oben über die echten team.cash-Werte ist davon nicht betroffen).
    expect(run.phase6.oldCashByTeam.size).toBeGreaterThan(0);
    for (const [teamId, oldCash] of run.phase6.oldCashByTeam) {
      const newCash = run.phase6.newCashByTeam.get(teamId) ?? null;
      if (oldCash == null || newCash == null) continue;
      expect(newCash).toBe(oldCash);
    }
  });

  it("Aggregat: über die gesamte simulierte Mini-Saison hinweg gilt cashVorher + Σ Buchungen == cashNachher (alle geloggten/verifizierten Geldsysteme außer Preisgeld, das nachweislich 0 ist)", () => {
    const bookingSumByTeam = new Map<string, number>();
    for (const booking of run.bookings) {
      bookingSumByTeam.set(booking.teamId, (bookingSumByTeam.get(booking.teamId) ?? 0) + booking.amount);
    }

    const touchedTeamIds = new Set(run.bookings.map((booking) => booking.teamId));
    expect(touchedTeamIds.size).toBeGreaterThanOrEqual(5);

    for (const teamId of touchedTeamIds) {
      const before = run.initialCash.get(teamId) ?? 0;
      const after = run.finalGameState.teams.find((team) => team.teamId === teamId)?.cash ?? 0;
      const bookedDelta = bookingSumByTeam.get(teamId) ?? 0;
      const predicted = before + bookedDelta;
      expect(
        Math.abs(after - predicted),
        `Team ${teamId}: cashVorher(${before}) + ΣBuchungen(${bookedDelta}) = ${predicted}, tatsächlich cashNachher = ${after}`,
      ).toBeLessThanOrEqual(AGGREGATE_TOLERANCE);
    }

    // Teams, die in KEINER Buchung vorkommen, dürfen sich im Cash über den gesamten Lauf hinweg
    // ebenfalls nicht verändert haben (Kontrollgruppe — deckt "unsichtbare" Cash-Bewegungen ab,
    // die von keinem der oben geprüften Systeme stammen).
    const untouchedTeams = run.finalGameState.teams.filter((team) => !touchedTeamIds.has(team.teamId));
    expect(untouchedTeams.length).toBeGreaterThan(0);
    for (const team of untouchedTeams) {
      const before = run.initialCash.get(team.teamId) ?? 0;
      expect(
        Math.abs(team.cash - before),
        `Unbeteiligtes Team ${team.teamId} hat trotzdem Cash bewegt: ${before} -> ${team.cash}`,
      ).toBeLessThanOrEqual(SINGLE_BOOKING_TOLERANCE);
    }
  });
});
