export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { applyAiManagerPlan, type AiManagerAction, type AiManagerActionType } from "@/lib/ai/ai-manager-apply-service";
import { applyAiInjuryDepthTopup } from "@/lib/ai/ai-injury-depth-topup-service";
import { runAutoRosterFillForMatchdaySetup } from "@/lib/ai/auto-roster-fill-service";
import { AUTO_ROSTER_FILL_CONFIRM_TOKEN } from "@/lib/ai/auto-roster-fill-contract";
import { buildAiActionBreakdown } from "@/lib/ai/ai-action-breakdown";
import { AI_PRESEASON_RUN_STALE_MS } from "@/lib/ai/ai-preseason-run-timing";
import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import { patchCompletedSeasonSnapshotAfterPreseasonBuy } from "@/lib/season/season-snapshot-service";
import { resolveAiLoanDecision } from "@/lib/ai/ai-loan-decision-service";
import { applyInsolvencyBackstop, buildLoanOffers, originateLoan } from "@/lib/finance/loan-service";
import type { AiPreseasonAutomationRunRecord, GameState } from "@/lib/data/olyDataTypes";
import {
  allowsAiPreseasonManualTeamOverride,
  getProtectedHumanTeamIds,
  protectManualPlayerTeams,
} from "@/lib/ai/ai-preseason-manual-team-guard";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import { resolveAiBulkTeamWriteScope } from "@/lib/room/ai-bulk-team-write-scope";
import { parseRoomWriteContextFromRequestAndBody } from "@/lib/room/parse-room-write-context";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

// Roster-abhängige Manager-Aktionen: Training/Einsatzlisten-Setup braucht Spieler im Kader. Im Setup-Draft
// (Season 1, frische Teams) sind die Kader zu Beginn LEER — laufen diese Aktionen vor dem Draft, werden sie
// alle mit `team_roster_empty` blockiert (das vom Owner beobachtete „120 blockiert"). Daher werden sie
// bewusst NACH dem Draft ausgeführt.
const ROSTER_DEPENDENT_MANAGER_ACTIONS: AiManagerActionType[] = [
  "set_training_focus",
  "set_training_intensity",
  "set_player_training_modes",
  "set_player_training_classes",
];

// Vor-Draft-Aktionen: Budget-Reservierung, Gebäude, Strategie-Marker — hängen NICHT vom Kader ab und dürfen
// (bzw. sollen, damit der Draft das reservierte Budget nutzt) vor dem Draft laufen.
const PRE_DRAFT_MANAGER_ACTIONS: AiManagerActionType[] = [
  "reserve_transfer_budget",
  "reserve_salary_budget",
  "reserve_maintenance_budget",
  "maintain_building",
  "upgrade_building",
  "buy_building",
  "mark_contract_strategy",
  "mark_sell_strategy",
];

// Season-Market-Modus (Kader existieren bereits): eine Runde mit allen Aktionen.
const ALL_PRESEASON_MANAGER_ACTIONS: AiManagerActionType[] = [
  ...PRE_DRAFT_MANAGER_ACTIONS,
  ...ROSTER_DEPENDENT_MANAGER_ACTIONS,
];

const inFlightRunKeys = new Set<string>();

function claimPreseasonRunKey(runKey: string) {
  if (inFlightRunKeys.has(runKey)) {
    return false;
  }
  inFlightRunKeys.add(runKey);
  return true;
}

function nowIso() {
  return new Date().toISOString();
}

function buildRunKey(saveId: string, seasonId: string) {
  return `${saveId}:${seasonId}`;
}

// `protectManualPlayerTeams`/`getProtectedHumanTeamIds` already exclude every human-controlled team
// (Chris's AND Franky's alike) via `seasonState.teamControlSettings`. `callerWritableTeamIds` (read
// from `room.state.teamOwnership` when a room is active — see `resolveAiBulkTeamWriteScope`) is an
// additional, authoritative-source intersection: defense-in-depth for the case where room ownership
// and `teamControlSettings` briefly disagree about who owns a team (S6). In the common case the two
// sets already agree and this intersection changes nothing.
function getAiTeamIds(gameState: GameState, callerWritableTeamIds: Set<string> | null) {
  const control = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  const protectedHumanTeamIds = getProtectedHumanTeamIds(gameState);
  return gameState.teams
    .filter(
      (team) =>
        control[team.teamId]?.controlMode === "ai" &&
        !protectedHumanTeamIds.has(team.teamId) &&
        (!callerWritableTeamIds || callerWritableTeamIds.has(team.teamId)),
    )
    .map((team) => team.teamId);
}

function isStaleRunningRun(run: AiPreseasonAutomationRunRecord | null) {
  if (run?.status !== "running") return false;
  const started = Date.parse(run.startedAt);
  if (!Number.isFinite(started)) return true;
  // Schwelle über der realen ~131 s-Laufzeit (siehe AI_PRESEASON_RUN_STALE_MS), damit ein echt laufender
  // 31-Team-Draft nicht fälschlich als stale gilt und der Server keinen Duplikat-Lauf startet.
  return Date.now() - started > AI_PRESEASON_RUN_STALE_MS;
}

function getSetupRosterTarget(gameState: GameState, teamId: string) {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  return Math.max(1, identity?.playerMin ?? identity?.playerOpt ?? team?.rosterLimit ?? 12);
}

function shouldRunSetupDraft(gameState: GameState, teamIds: string[]) {
  if (gameState.season.id !== "season-1") return false;
  if (gameState.gamePhase && gameState.gamePhase !== "preseason_management") return false;
  if (gameState.seasonState.newGameFlow?.active === false) return false;
  // GEMELDET: „nein das ist mein save und da wurden die schon wieder bei mir rein gepickt"
  //
  // `preseason_management` bedeutet ZWEI Dinge: frischer Saison-1-Aufbau UND erste Station jedes
  // Saisonendes (`season-transition-chain.ts`). Die Bedingungen darueber treffen am Saisonende von
  // Saison 1 alle zu — also feuerte hier der komplette Setup-Draft ein zweites Mal und kaufte
  // Kader voll, die laengst spielten.
  //
  // Derselbe Fehler steckte im Client (`use-foundation-shell-router-body-scope.tsx`) und ist dort
  // bereits behoben; hier stand er ein zweites Mal. Ein Fix an einer Stelle haette den anderen Weg
  // offen gelassen — genau deshalb ist es dem Spieler ein zweites Mal passiert.
  //
  // Unterscheidungsmerkmal ist nicht die Phase, sondern ob ueberhaupt schon gespielt wurde: ein
  // frischer Aufbau hat kein einziges Spieltagsergebnis, jedes Saisonende hat welche.
  if ((gameState.seasonState.matchdayResults ?? []).some((result) => result.seasonId === gameState.season.id)) {
    return false;
  }

  return teamIds.some((teamId) => {
    const rosterCount = gameState.rosters.filter((entry) => entry.teamId === teamId).length;
    return rosterCount < getSetupRosterTarget(gameState, teamId);
  });
}

function writeRunRecord(saveId: string, record: AiPreseasonAutomationRunRecord) {
  const persistence = createPersistenceService();
  const latest = persistence.getSaveById(saveId);
  if (!latest) return null;
  const nextGameState: GameState = {
    ...latest.gameState,
    seasonState: {
      ...latest.gameState.seasonState,
      aiPreseasonAutomationRuns: {
        ...(latest.gameState.seasonState.aiPreseasonAutomationRuns ?? {}),
        [record.seasonId]: record,
      },
    },
  };
  return persistence.saveSingleplayerState(saveId, nextGameState, { status: latest.status });
}

async function executeAiPreseasonBackgroundWork(input: {
  saveId: string;
  seasonId: string;
  baseRecord: AiPreseasonAutomationRunRecord;
  aiTeamIds: string[];
  setupDraftMode: boolean;
  protectedSave: NonNullable<ReturnType<PersistenceService["getSaveById"]>>;
}): Promise<AiPreseasonAutomationRunRecord> {
  const { saveId, seasonId, baseRecord, aiTeamIds, setupDraftMode, protectedSave } = input;
  const persistence = createPersistenceService();

  try {
    const latestBeforeManager = persistence.getSaveById(saveId) ?? protectedSave;

    if (setupDraftMode) {
      // REIHENFOLGE-FIX: Im Setup-Draft (frische Teams, leere Kader) MUSS erst der Draft die Kader füllen,
      // bevor Training/Einsatzlisten-Setup läuft — sonst blockiert jede dieser Aktionen mit
      // `team_roster_empty` (das vom Owner beobachtete „120 blockiert"). Ablauf:
      //   1) Vor-Draft-Manageraktionen (Budget/Gebäude/Strategie, kader-unabhängig)
      //   2) Draft pro Team (füllt die Kader)
      //   3) roster-abhängiges Training/Setup ERST DANACH, gegen den frischen Save mit gefüllten Kadern
      const preDraftManager = applyAiManagerPlan({
        save: latestBeforeManager,
        dryRun: false,
        teamIds: aiTeamIds,
        actionTypes: PRE_DRAFT_MANAGER_ACTIONS,
        persistence,
      });

      let completedTeams = 0;
      let transferBuysApplied = 0;
      let managerActionsApplied = preDraftManager.actions.filter((action) => action.applied).length;
      const warnings = [...preDraftManager.warnings];
      const blockingReasons = [...preDraftManager.blockers];
      // Kategorie-Aufstellung (angewandt/blockiert) über alle Manager-Runden hinweg sammeln,
      // damit das Diagnose-UI angewandt vs. blockiert je Kategorie ohne Neu-Ableitung zeigen kann.
      let managerActions: AiManagerAction[] = [...preDraftManager.actions];

      for (const teamId of aiTeamIds) {
        const picksRun = await runAiPicksExecutePreview(
          {
            source: "sqlite",
            saveId,
            seasonId,
            dryRun: false,
            confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
            teamScope: "ai",
            teamIds: [teamId],
            stepsPerTeam: 12,
            runMode: "season1_optimum_execute",
            draftSeed: `${saveId}:${seasonId}:preseason:${teamId}`,
          },
          persistence,
        );
        const teamCompleted = picksRun.teams.some((team) => {
          if (team.teamId !== teamId || team.blockingReasons.length > 0) {
            return false;
          }
          const rosterAfter = team.rosterAfter ?? team.previewSummary.plannedRosterCount ?? 0;
          return team.targetRosterMin == null || rosterAfter >= team.targetRosterMin;
        });
        const appliedPickCount = picksRun.globalExecution.appliedPickCount;
        if (teamCompleted) completedTeams += 1;
        transferBuysApplied += appliedPickCount;
        warnings.push(...picksRun.warnings);
        blockingReasons.push(...picksRun.blockingReasons);
        writeRunRecord(saveId, {
          ...baseRecord,
          status: "running",
          completedAt: null,
          aiTeamsCompleted: completedTeams,
          managerActionsApplied,
          transferBuysApplied,
          transferSellsApplied: 0,
          warnings: Array.from(new Set(warnings)),
          blockingReasons: Array.from(new Set(blockingReasons)),
        });
      }

      // 3) Training/Einsatzlisten-Setup ERST, wenn ALLE AI-Teams einen gefüllten Kader haben (Owner-Wunsch).
      //    Ist der Draft unvollständig (Bug/Kadertiefe), wird das Training NICHT gefeuert — es würde nur mit
      //    `team_roster_empty` blockieren. Stattdessen bleibt es aufgeschoben: der Owner kann nachpicken und
      //    den Preseason-Lauf erneut anstoßen, dann greift Schritt 3 sauber.
      if (completedTeams >= aiTeamIds.length) {
        const latestAfterPicks = persistence.getSaveById(saveId) ?? latestBeforeManager;
        const trainingManager = applyAiManagerPlan({
          save: latestAfterPicks,
          dryRun: false,
          teamIds: aiTeamIds,
          actionTypes: ROSTER_DEPENDENT_MANAGER_ACTIONS,
          persistence,
        });
        managerActionsApplied += trainingManager.actions.filter((action) => action.applied).length;
        managerActions = [...managerActions, ...trainingManager.actions];
        warnings.push(...trainingManager.warnings);
        blockingReasons.push(...trainingManager.blockers);
      } else {
        // Aufgeschoben, damit die 120 „team_roster_empty"-Blocker nicht mehr entstehen; klare Meldung fürs UI.
        warnings.push("setup_draft_training_deferred_until_rosters_complete");
      }

      const finalRecord: AiPreseasonAutomationRunRecord = {
        ...baseRecord,
        status: completedTeams >= aiTeamIds.length ? "completed" : "failed",
        completedAt: nowIso(),
        aiTeamsCompleted: completedTeams,
        managerActionsApplied,
        transferBuysApplied,
        transferSellsApplied: 0,
        warnings: Array.from(new Set(warnings)),
        blockingReasons: Array.from(new Set(blockingReasons)),
        actionBreakdown: buildAiActionBreakdown(managerActions),
      };
      writeRunRecord(saveId, finalRecord);
      return finalRecord;
    }

    // Season-Market-Modus: Kader existieren bereits → alle Manager-Aktionen in einer Runde, dann Markt.
    const managerResult = applyAiManagerPlan({
      save: latestBeforeManager,
      dryRun: false,
      teamIds: aiTeamIds,
      actionTypes: ALL_PRESEASON_MANAGER_ACTIONS,
      persistence,
    });

    /**
     * KREDITE — der Schritt, den es nie gab.
     *
     * GEMELDET: „Kredite sollen verfügbar sein und ich will sehen ob die genutzt werden. Gerade
     * auch bei teams wie D-P die mit negativem Cash rein gehen. … Wenn kein team sich dafür
     * interessiert wäre das auch falsch."
     *
     * BEFUND, am Klon von Chris' Spielstand gemessen: `resolveAiLoanDecision` qualifiziert Teams
     * (zwei im Kauffenster), aber im Spielstand stand `seasonState.loans` auf LEER — kein einziger
     * KI-Kredit, ueber die ganze Historie.
     *
     * URSACHE, mit Zeile: der einzige KI-Kredit-Aufruf liegt in
     * `ai-transfer-window-session-service.ts:704` und haengt an
     * `isPreseasonBuyPhase && allowBuys`. Der einzige Aufrufer dieser Sitzung im Spiel ist
     * `season-transition-service.ts` — und der ruft sie mit `phase: "season_end"` und
     * `allowBuys: false` auf. `phase: "preseason"` benutzen nur noch Skripte. Der Kredit-Hook war
     * damit im laufenden Spiel unerreichbar; das Kauffenster hier laeuft ueber
     * `applyAiMarketPlanLocally` und den Fuell-Dienst, die beide nichts von Krediten wissen.
     *
     * ZWEI DURCHGAENGE, und der zweite ist der wichtigere. Vor dem Markt liest sich fast jedes Team
     * als `cash_sufficient` — das Geld ist ja noch da. Erst NACH dem Markt steht fest, wer sich
     * leergekauft hat und trotzdem unter seinem Kader-Ziel steht. Am Klon gemessen, jeweils ab
     * demselben Zustand nach dem Saisonwechsel:
     *
     *   ohne Kredite       : 0 Kredite, Kader 343, 3 Teams unter Optimum
     *   nur Pass 1         : 2 Kredite, Kader 342, 3 Teams unter Optimum
     *   Pass 1 + Pass 2    : 8 Kredite, Kader 346, 2 Teams unter Optimum (A-A 9 -> 11, B-B am Ziel)
     *
     * Nach dem Fuell-Lauf wird NICHT mehr geliehen: dann kaeme das Geld zu spaet und waere nur
     * Zinslast ohne Gegenwert.
     */
    const kreditNotizen: string[] = [];
    const kreditPass = () => {
      for (const teamId of aiTeamIds) {
        const aktuell = persistence.getSaveById(saveId);
        if (!aktuell) break;
        const entscheidung = resolveAiLoanDecision(aktuell.gameState, teamId);
        if (!entscheidung.shouldBorrow) continue;
        // `buildLoanOffers` ist aufsteigend nach Zinssatz sortiert und enthaelt immer die Bank —
        // es gibt also mindestens ein Angebot, und das erste ist das guenstigste.
        const angebote = buildLoanOffers(
          aktuell.gameState,
          teamId,
          entscheidung.loanAmount,
          entscheidung.termSeasons,
        );
        const bestes = angebote[0] ?? null;
        const ergebnis = originateLoan(
          aktuell.gameState,
          {
            borrowerTeamId: teamId,
            principal: entscheidung.loanAmount,
            termSeasons: entscheidung.termSeasons,
            lenderType: bestes?.lenderType ?? "bank",
            lenderTeamId: bestes?.lenderTeamId ?? undefined,
          },
          { execute: true },
        );
        if (!ergebnis.ok) {
          kreditNotizen.push(`ai_loan_abgelehnt:${teamId}:${ergebnis.reason ?? "unbekannt"}`);
          continue;
        }
        persistence.saveSingleplayerState(saveId, ergebnis.gameState);
        kreditNotizen.push(
          `ai_loan_borrow:${teamId}:${entscheidung.loanAmount}:${entscheidung.termSeasons}s:${entscheidung.reason}`,
        );
      }
    };
    kreditPass();

    const market = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId,
      seasonId,
      teamScope: "ai",
      dryRun: false,
      includeWarningTeams: false,
      confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
      transferPhase: LOCAL_TRANSFER_WINDOW_PHASE,
      options: {
        includeWarningTeams: false,
        stopOnTeamFailure: false,
        // Kauffenster der neuen Saison = reine KAUF-Phase (Chris: verkauft wird als separater
        // Schritt am Saisonende, ueber die Saisonende-Kette). Ein Verkaufslauf hier wuerde die
        // frisch am Saisonende verkauften Teams ein zweites Mal schrumpfen — und das Fenster
        // ist fuer den Menschen aus demselben Grund ebenfalls kauf-only
        // (`isEarlySeasonTransferSetup` zaehlt nur fuers Kaufen, transfer-window-policy).
        applySellSteps: false,
      },
    });
    const completedTeams = market.results.filter(
      (team) => team.result !== "blocked" && team.result !== "failed_buy" && team.result !== "failed_sell",
    ).length;
    // Zweiter Kredit-Durchgang: jetzt ist die Kasse leer und die Luecke sichtbar (Begruendung und
    // Messung oben beim ersten Pass). Er laeuft vor dem Fuell-Lauf, damit das Geld noch wirkt.
    kreditPass();
    /**
     * KADER AUFS OPTIMUM FUELLEN — mit demselben Dienst, der das in Saison 1 tut.
     *
     * GEMELDET: „wieso ist die Logik nicht wie beim kaufen in season 1? da haben wir doch auch
     * teils teams die 10 oder 12 spieler haben?" und „schau dass kein team was das geld hat nur
     * auf minimum geht"
     *
     * Der Kommentar ueber dem Saison-Markt-Zweig sagt „Kader existieren bereits". Seit die
     * Verkaeufe an das Saisonende gewandert sind, stimmt das nicht mehr: die Teams stehen beim
     * Saisonstart bei 3 bis 7 Spielern. Saison 1 BAUT Kader auf (`runAiPicksExecutePreview`),
     * der Marktplan PFLEGT sie nur — fuer einen leergeraeumten Kader ist Pflege das falsche
     * Werkzeug.
     *
     * Am Klon von Chris' Spielstand gemessen, jeweils nach dem Saisonwechsel (Kader 234,
     * kleinster 3, 20 Teams unter Minimum, 30 unter Optimum):
     *
     *   nur Marktplan, VIER Laeufe : Kader 314, kleinster 5, 6 unter Minimum, 13 unter Optimum
     *   Fuell-Dienst, EIN Lauf     : Kader 350, kleinster 8, 0 unter Minimum,  1 unter Optimum
     *
     * `auto-roster-fill-service` zielt auf `teamIdentity.playerOpt` (dort Zeile 205-209), macht
     * einen Minimum- und danach einen Optimum-Durchgang und hat KEIN Saison-Gate — er lief in
     * Saison 2 nur nie. Genau das wird hier nachgeholt.
     *
     * Er laeuft NACH dem Markt, nicht statt seiner: der Markt macht die strategisch begruendeten
     * Zugaenge, der Fuell-Lauf schliesst danach die Luecke bis zum Optimum. Wie viel er kauft,
     * entscheidet weiterhin das Geld — `target_unreachable_cash` ist ein regulaeres Ergebnis.
     */
    const rosterFill = await runAutoRosterFillForMatchdaySetup(
      {
        source: "sqlite",
        saveId,
        seasonId,
        dryRun: false,
        confirmToken: AUTO_ROSTER_FILL_CONFIRM_TOKEN,
      },
      persistence,
    );
    const rosterFillFilled = rosterFill.teams.filter(
      (team) => team.status === "filled" || team.status === "partially_filled",
    ).length;

    // Owner request: after a season with too many injuries, an AI team should buy one or two
    // cheap depth players. Runs AFTER the regular market pipeline above (so it only tops up
    // whatever that pipeline already did) and is scoped to the same AI-only `aiTeamIds` — see
    // lib/ai/ai-injury-depth-topup-service.ts for the injury signal / cheap-price / afford gating.
    const injuryDepthTopup = applyAiInjuryDepthTopup({ saveId, seasonId, aiTeamIds });

    /**
     * KEIN MINUS MEHR, WENN DAS FENSTER ZU IST.
     *
     * CHRIS' REGEL: „d-p darf negativ in die neue Saison gehen das ist ok! Nur nach dem kaufen und
     * kredite aufnehmen darf es nicht mehr negativ sein."
     *
     * Der regulaere Kredit-Pass oben kann ein Minus stehen lassen: er prueft Kapazitaet und
     * Tragfaehigkeit, und beides darf nein sagen. Danach hat das Team keinen Weg mehr — verkauft
     * wird erst am naechsten Saisonende. Der Notkredit ist genau dafuer da (`emergency: true`
     * umgeht Kapazitaet, Distress-Gate und die S1-Sperre, weil er unfreiwillig ist) und deckt exakt
     * den Fehlbetrag; Cash steht danach auf 0, die Restschuld laeuft im normalen Kreditsystem.
     *
     * Er steht bewusst am ENDE: erst wenn Markt, Fuellung und Verletzungs-Topup fertig sind, steht
     * der Kontostand fest, mit dem das Team in die Saison geht.
     */
    const vorAusgleich = persistence.getSaveById(saveId);
    let notkredite: Array<{ teamId: string; principal: number }> = [];
    if (vorAusgleich) {
      const ausgleich = applyInsolvencyBackstop({ gameState: vorAusgleich.gameState, saveId });
      if (ausgleich.emergencyLoans.length > 0) {
        persistence.saveSingleplayerState(saveId, ausgleich.gameState);
        notkredite = ausgleich.emergencyLoans;
      }
      kreditNotizen.push(
        ...ausgleich.warnings,
        ...notkredite.map((kredit) => `ai_notkredit:${kredit.teamId}:${kredit.principal}`),
      );
    }

    /**
     * SNAPSHOT DER VORSAISON AUF DEN EINTRITTSSTAND NACHZIEHEN.
     *
     * CHRIS' VORGABE: „die snapshots für Cash und Marktwert sollen ja auch erst am anfang der
     * Saison nach den Käufen stattfinden für die ewige Tabelle / Finanzen."
     *
     * BEFUND: `patchCompletedSeasonSnapshotAfterPreseasonBuy` gibt es seit Langem und tut genau
     * das — aufgerufen hat es im Spiel aber NIEMAND. Die einzigen Aufrufer waren
     * `scripts/long-run-sandbox-s1-s6.ts:3514` und die Tests. In der ewigen Tabelle stand deshalb
     * der Stand vom Saisonende; seit die Verkaeufe dorthin gewandert sind (#445) heisst das: Kader
     * von 3 bis 7 Spielern und ein entsprechend kleiner Marktwert.
     *
     * Hier ist der richtige Zeitpunkt: Markt, Fuellung, Verletzungs-Topup und der
     * Zahlungsausgleich sind durch, der Eintrittsstand steht fest.
     */
    let snapshotPatchNotiz: string[] = [];
    const vorPatch = persistence.getSaveById(saveId);
    if (vorPatch) {
      const patch = patchCompletedSeasonSnapshotAfterPreseasonBuy(vorPatch.gameState, seasonId);
      if (patch.patched) {
        persistence.saveSingleplayerState(saveId, patch.gameState);
        snapshotPatchNotiz = [`snapshot_eintrittsstand_gesetzt:${patch.completedSeasonId}`];
      } else {
        snapshotPatchNotiz = patch.warnings;
      }
    }

    const finalRecord: AiPreseasonAutomationRunRecord = {
      ...baseRecord,
      status: market.status === "blocked" ? "failed" : "completed",
      completedAt: nowIso(),
      aiTeamsCompleted: completedTeams,
      managerActionsApplied: managerResult.actions.filter((action) => action.applied).length,
      transferBuysApplied:
        market.summary.appliedBuys + injuryDepthTopup.playersBoughtTotal + rosterFill.summary.appliedBuys,
      transferSellsApplied: market.summary.appliedSells,
      warnings: [
        ...managerResult.warnings,
        ...market.warnings,
        ...injuryDepthTopup.warnings,
        `roster_fill_auf_optimum:${rosterFillFilled}/${rosterFill.teams.length}`,
        ...kreditNotizen,
        ...snapshotPatchNotiz,
      ],
      blockingReasons: [...managerResult.blockers, ...market.blockingReasons],
      actionBreakdown: buildAiActionBreakdown(managerResult.actions),
    };
    writeRunRecord(saveId, finalRecord);
    return finalRecord;
  } catch (error) {
    const failedRecord: AiPreseasonAutomationRunRecord = {
      ...baseRecord,
      status: "failed",
      completedAt: nowIso(),
      warnings: [],
      blockingReasons: [error instanceof Error ? error.message : "ai_preseason_background_failed"],
    };
    writeRunRecord(saveId, failedRecord);
    console.error("AI preseason background failed.", error);
    return failedRecord;
  } finally {
    inFlightRunKeys.delete(buildRunKey(saveId, seasonId));
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() ?? "";
  const seasonId = searchParams.get("seasonId")?.trim() ?? "";
  const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";

  if (!saveId || !seasonId) {
    return NextResponse.json({ error: "saveId and seasonId are required." }, { status: 400 });
  }

  if (source === "prisma") {
    return NextResponse.json({ error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
  }

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    return NextResponse.json({ error: `Save ${saveId} not found.` }, { status: 404 });
  }
  if (save.gameState.season.id !== seasonId) {
    return NextResponse.json({ error: `Season ${seasonId} is not active in save ${saveId}.` }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const roomWriteContext = parseRoomWriteContextFromRequestAndBody(request, body);
  const writeAuth = authorizeServerRoomWrite({
    ...roomWriteContext,
    saveId,
    action: "ai_preseason_background",
    source: "sqlite",
    dryRun: false,
  });
  if (!writeAuth.allowed) {
    return NextResponse.json({ error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
  }

  const runKey = buildRunKey(saveId, seasonId);
  if (!claimPreseasonRunKey(runKey)) {
    const latestRun = persistence.getSaveById(saveId)?.gameState.seasonState.aiPreseasonAutomationRuns?.[seasonId] ?? null;
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "ai_preseason_already_running",
      run: latestRun,
    });
  }

  let handedToExecute = false;

  try {
    const freshSave = persistence.getSaveById(saveId);
    if (!freshSave) {
      return NextResponse.json({ error: `Save ${saveId} not found.` }, { status: 404 });
    }

    const existingRun = freshSave.gameState.seasonState.aiPreseasonAutomationRuns?.[seasonId] ?? null;
    if (
      existingRun?.status === "completed" ||
      (existingRun?.status === "running" && !isStaleRunningRun(existingRun))
    ) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: existingRun?.status === "running" ? "ai_preseason_already_running" : "ai_preseason_already_completed",
        run: existingRun,
      });
    }

    const skipManualProtection = allowsAiPreseasonManualTeamOverride({
      saveId,
      gameState: freshSave.gameState,
    });
    const protectedGameState = skipManualProtection ? freshSave.gameState : protectManualPlayerTeams(freshSave.gameState);
    const protectedSave =
      protectedGameState === freshSave.gameState
        ? freshSave
        : persistence.saveSingleplayerState(freshSave.saveId, protectedGameState, { status: freshSave.status });
    // S6 defense-in-depth: intersect with the room-ownership-authoritative writable set (see
    // `getAiTeamIds`'s comment above) so a run can never touch a team room.state.teamOwnership
    // says belongs to a different human, even if teamControlSettings briefly disagrees.
    const callerWritableTeamIds = resolveAiBulkTeamWriteScope({
      gameState: protectedSave.gameState,
      room: writeAuth.room,
      participant: writeAuth.participant,
      activeOwnerId: roomWriteContext.activeOwnerId,
    }).writableTeamIds;
    const aiTeamIds = getAiTeamIds(protectedSave.gameState, callerWritableTeamIds);
    const startedAt = nowIso();
    const setupDraftMode = shouldRunSetupDraft(protectedSave.gameState, aiTeamIds);

    /**
     * CHRIS' REGEL: „wir verkaufen als separaten schritt zum ende der saison und gekauft wird
     * erst in der folgesaison."
     *
     * Der Season-Market-Lauf gehoert ins Kauffenster der NEUEN Saison. Solange der Spielstand
     * noch in der Saisonende-Kette steht (`isSeasonEndPhase`), laufen die Verkaeufe dort ueber
     * den Saisonende-Assistenten (`runSeasonEndAiSellsIfDue`) — ein Marktlauf hier waere ein
     * zweiter, konkurrierender Schreiber mitten in der Kette. Bewusst wird KEIN Run-Record
     * geschrieben: der Lauf ist nicht erledigt, sondern verschoben; im Kauffenster der neuen
     * Saison stoesst der Client ihn unter der neuen Saison-ID regulaer an.
     */
    if (!setupDraftMode && isSeasonEndPhase(protectedSave.gameState.gamePhase)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "ai_preseason_deferred_until_new_season_buy_window",
        run: null,
      });
    }
    const baseRecord: AiPreseasonAutomationRunRecord = {
      runId: `ai-preseason-${saveId}-${seasonId}-${Date.now()}`,
      seasonId,
      status: aiTeamIds.length === 0 ? "skipped" : "running",
      mode: aiTeamIds.length === 0 ? "none" : setupDraftMode ? "setup_draft" : "season_market",
      startedAt,
      completedAt: null,
      aiTeamsTotal: aiTeamIds.length,
      aiTeamsCompleted: 0,
      managerActionsApplied: 0,
      transferBuysApplied: 0,
      transferSellsApplied: 0,
      warnings: [],
      blockingReasons: [],
    };

    if (aiTeamIds.length === 0) {
      const skippedRecord: AiPreseasonAutomationRunRecord = { ...baseRecord, completedAt: nowIso() };
      writeRunRecord(saveId, skippedRecord);
      return NextResponse.json({ ok: true, skipped: true, reason: "no_ai_teams", run: skippedRecord });
    }

    const latestBeforeStart = persistence.getSaveById(saveId);
    const runningRecord = latestBeforeStart?.gameState.seasonState.aiPreseasonAutomationRuns?.[seasonId] ?? null;
    if (runningRecord?.status === "running" && !isStaleRunningRun(runningRecord)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "ai_preseason_already_running",
        run: runningRecord,
      });
    }

    writeRunRecord(saveId, baseRecord);
    handedToExecute = true;
    const finalRun = await executeAiPreseasonBackgroundWork({
      saveId,
      seasonId,
      baseRecord,
      aiTeamIds,
      setupDraftMode,
      protectedSave,
    });

    const succeeded = finalRun.status === "completed";
    if (succeeded) {
      notifyRoomGameplayWrite(writeAuth, {
        saveId,
        teamId: null,
        action: "ai_preseason_background",
        eventType: "save_updated",
        affectedViews: ["home", "team", "market", "lineup", "facilities", "training"],
        dryRun: false,
        success: true,
      });
    }
    return NextResponse.json(
      {
        ok: succeeded,
        skipped: false,
        run: finalRun,
      },
      { status: succeeded ? 200 : 500 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI preseason background failed.",
      },
      { status: 500 },
    );
  } finally {
    if (!handedToExecute) {
      inFlightRunKeys.delete(runKey);
    }
  }
}
