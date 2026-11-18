import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildTeamPlayerTrainingLoadPlans,
  type AiTeamTrainingIntensity,
} from "@/lib/ai/ai-player-training-load-service";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { resolveTeamDelegation } from "@/lib/foundation/team-delegation";
import { buildTeamPlayerTrainingClassPlans } from "@/lib/ai/ai-player-training-class-service";
import { createCaptureBatchPersistence } from "@/lib/persistence/capture-batch-persistence";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import {
  applyPlayerTrainingClasses,
  applyPlayerTrainingModes,
  previewPlayerTrainingClasses,
  previewPlayerTrainingModes,
} from "@/lib/training/training-settings-service";

/**
 * Per-Spieltag-Neubewertung der individuellen AI-Trainingsmodi (Fatigue-Schoner).
 *
 * Hintergrund / Problem: Der per-Spieler-`trainingMode` (leicht/mittel/hart) wurde bisher NUR
 * EINMAL pro Saison (Preseason, applyAiManagerPlan("set_player_training_modes")) gesetzt und dann
 * fuer alle 10 Spieltage EINGEFROREN. Die Fatigue-Schoner-Logik in resolveModeForPlayer feuert aber
 * erst ab einem Fatigue-Boden — und in der Preseason ist jeder Spieler bei ~0 Fatigue, also feuerte
 * sie nie. Die Fatigue akkumuliert danach pro Spieltag (matchday-training-accumulator), doch der Modus
 * passte sich nie an: muede Spieler wurden nie auf "leicht" umgestellt.
 *
 * Diese Funktion laeuft JEDEN Spieltag (bevor die AI-Aufstellung gebaut wird) und bewertet fuer jedes
 * AI-gesteuerte Team die Trainings-Last-Entscheidung mit der AKTUELLEN Fatigue neu: ein muede
 * gewordener Spieler wird auf "leicht" gesetzt (und zurueck Richtung Normal, sobald er wieder frisch
 * ist). Sie speist damit sowohl die Fatigue-Akkumulation als auch die Aufstellungs-/Schonen-
 * Entscheidung des Spieltags.
 *
 * Sicherheit / Determinismus:
 *  - Beruehrt AUSSCHLIESSLICH AI-gesteuerte Teams (controlMode === "ai"). Manuell (menschlich)
 *    gesteuerte Teams werden NIE angefasst — ihre gewaehlten Trainingsmodi bleiben unveraendert.
 *  - Die Team-Baseline-Intensitaet stammt aus der eingefrorenen Preseason-Einstellung
 *    (aiManagerTrainingSettings) — die Preseason-Modus-Setzung bleibt der Ausgangspunkt, hier wird
 *    nur die per-Spieler-Anpassung an die aktuelle Fatigue OBEN DRAUF gelegt.
 *  - DELEGATION (18.11., lib/foundation/team-delegation.ts): ein MENSCHLICHES Team, dessen Training
 *    an die KI delegiert ist (Halbautomatik/Voll KI), wird genauso bewertet wie ein KI-Team — mit
 *    einer Ausnahme: Spieler, deren Training der Mensch selbst gesetzt hat
 *    (`delegation.trainingSelbstSpielerIds`), fasst die KI nicht an. Zusaetzlich setzt sie Spielern
 *    ohne Trainingsklasse einmal eine (dieselbe Auswahl wie die Vorsaison-KI). Teams ohne Delegation
 *    bleiben unberuehrt wie zuvor.
 *  - Kein Zufall/Datum: die Modus-Entscheidung ist deterministisch (stabile Hash-Seeds pro
 *    (Spieler, Spieltag) in resolveModeForPlayer / shouldRestForFatigue).
 *  - Persistiert ueber den bestehenden Trainings-Settings-Pfad (applyPlayerTrainingModes) — derselbe,
 *    den applyAiManagerPlan("set_player_training_modes") nutzt. Alle Team-Writes werden in-memory
 *    gebatcht und genau EINMAL geflusht.
 */

function resolveTeamBaselineIntensity(gameState: GameState, teamId: string): AiTeamTrainingIntensity {
  const settings = gameState.seasonState.aiManagerTrainingSettings?.[teamId];
  if (settings?.trainingIntensity === "light") return "light";
  if (settings?.trainingIntensity === "hard") return "hard";
  return "normal";
}

export type AiTrainingModeReevaluationResult = {
  teamsEvaluated: number;
  teamsUpdated: number;
  playersReassigned: number;
  skippedManual: number;
  /** Menschliche Teams mit delegiertem Training, die bewertet wurden. */
  delegatedTeamsEvaluated: number;
  /** Spieler, deren Training der Mensch selbst gesetzt hat und die deshalb unberuehrt blieben. */
  delegatedPlayersRespected: number;
};

export function reevaluateAiTrainingModesForMatchday(input: {
  saveId: string;
  persistence?: PersistenceService;
}): AiTrainingModeReevaluationResult {
  const basePersistence = input.persistence ?? createPersistenceService();
  const seed = basePersistence.getSaveById(input.saveId);
  const empty: AiTrainingModeReevaluationResult = {
    teamsEvaluated: 0,
    teamsUpdated: 0,
    playersReassigned: 0,
    skippedManual: 0,
    delegatedTeamsEvaluated: 0,
    delegatedPlayersRespected: 0,
  };
  if (!seed) return empty;

  // Alle Team-Writes in-memory batchen, genau einmal auf den Delegate flushen.
  const deferred = createCaptureBatchPersistence({
    delegate: basePersistence,
    saveId: input.saveId,
    seed,
  });
  const persistence = deferred.persistence;
  let currentSave: PersistedSaveGame = seed;

  const controlSettingsMap = buildTeamControlSettingsMap(
    currentSave.gameState.teams,
    currentSave.gameState.seasonState.teamControlSettings,
  );

  let teamsEvaluated = 0;
  let teamsUpdated = 0;
  let playersReassigned = 0;
  let skippedManual = 0;
  let delegatedTeamsEvaluated = 0;
  let delegatedPlayersRespected = 0;

  for (const team of currentSave.gameState.teams) {
    const teamSettings = controlSettingsMap[team.teamId];
    const controlMode = teamSettings?.controlMode ?? "manual";
    const delegation = controlMode === "manual" ? resolveTeamDelegation(teamSettings) : null;
    const trainingDelegiert = delegation?.bereiche.training === "ki";
    // AI-gesteuerte Teams und menschliche Teams mit delegiertem Training. Menschliche Teams ohne
    // Delegation NIE ueberschreiben.
    if (controlMode !== "ai" && !trainingDelegiert) {
      if (controlMode === "manual") skippedManual += 1;
      continue;
    }
    teamsEvaluated += 1;
    const selbstGesetzt = new Set(delegation?.trainingSelbstSpielerIds ?? []);
    if (trainingDelegiert) {
      delegatedTeamsEvaluated += 1;
      const rosterIds = new Set(
        currentSave.gameState.rosters.filter((entry) => entry.teamId === team.teamId).map((entry) => entry.playerId),
      );
      delegatedPlayersRespected += [...selbstGesetzt].filter((playerId) => rosterIds.has(playerId)).length;
      currentSave = fillMissingTrainingClassesForDelegatedTeam(currentSave, team.teamId, selbstGesetzt, persistence);
    }

    const intensity = resolveTeamBaselineIntensity(currentSave.gameState, team.teamId);
    const plans = buildTeamPlayerTrainingLoadPlans({
      gameState: currentSave.gameState,
      teamId: team.teamId,
      teamBaselineIntensity: intensity,
    });
    if (plans.length === 0) continue;

    const currentModeById = new Map(
      currentSave.gameState.players.map((player) => [player.id, player.trainingMode] as const),
    );
    const assignments = plans
      .filter((plan) => !selbstGesetzt.has(plan.playerId))
      .map((plan) => ({ playerId: plan.playerId, trainingMode: plan.selectedMode }));
    if (assignments.length === 0) continue;
    // Nur echte Aenderungen zaehlen (und ueberhaupt schreiben) — spart Writes, wenn nichts kippt.
    const changedCount = assignments.filter(
      (assignment) => currentModeById.get(assignment.playerId) !== assignment.trainingMode,
    ).length;
    if (changedCount === 0) continue;

    const preview = previewPlayerTrainingModes({ save: currentSave, teamId: team.teamId, assignments });
    if (!preview.ok || !preview.confirmToken) continue;

    const result = applyPlayerTrainingModes(
      currentSave,
      team.teamId,
      assignments,
      preview.confirmToken,
      persistence,
      trainingDelegiert ? "delegation_matchday_training_reeval" : "ai_matchday_training_reeval",
    );
    if (result.applied) {
      teamsUpdated += 1;
      playersReassigned += changedCount;
      currentSave = result.save ?? persistence.getSaveById(currentSave.saveId) ?? currentSave;
    }
  }

  deferred.flush();

  return {
    teamsEvaluated,
    teamsUpdated,
    playersReassigned,
    skippedManual,
    delegatedTeamsEvaluated,
    delegatedPlayersRespected,
  };
}

/**
 * Delegiertes Training: Spieler OHNE Trainingsklasse bekommen die Klasse, die die Vorsaison-KI
 * ihnen geben wuerde (`buildTeamPlayerTrainingClassPlans`, Schwerpunkt aus den KI-Trainings-
 * Einstellungen des Teams, sonst ausgewogen). Eine vorhandene Klasse bleibt — die hat entweder der
 * Mensch gewaehlt oder ein frueherer Lauf, und Klassenwechsel je Spieltag waeren Unruhe ohne Grund.
 */
function fillMissingTrainingClassesForDelegatedTeam(
  save: PersistedSaveGame,
  teamId: string,
  selbstGesetzt: ReadonlySet<string>,
  persistence: PersistenceService,
): PersistedSaveGame {
  const playersById = new Map(save.gameState.players.map((player) => [player.id, player] as const));
  const focus = save.gameState.seasonState.aiManagerTrainingSettings?.[teamId]?.trainingFocus ?? "BALANCED";
  const assignments = buildTeamPlayerTrainingClassPlans({ gameState: save.gameState, teamId, trainingFocus: focus })
    .filter((plan) => !selbstGesetzt.has(plan.playerId) && !playersById.get(plan.playerId)?.trainingClass)
    .map((plan) => ({ playerId: plan.playerId, trainingClass: plan.trainingClass }));
  if (assignments.length === 0) return save;
  const preview = previewPlayerTrainingClasses({ save, teamId, assignments });
  if (!preview.ok || !preview.confirmToken) return save;
  const result = applyPlayerTrainingClasses(save, teamId, assignments, preview.confirmToken, persistence);
  return result.applied ? (result.save ?? persistence.getSaveById(save.saveId) ?? save) : save;
}
