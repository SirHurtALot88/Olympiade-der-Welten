import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildTeamPlayerTrainingLoadPlans,
  type AiTeamTrainingIntensity,
} from "@/lib/ai/ai-player-training-load-service";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { createCaptureBatchPersistence } from "@/lib/persistence/capture-batch-persistence";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { applyPlayerTrainingModes, previewPlayerTrainingModes } from "@/lib/training/training-settings-service";

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

  for (const team of currentSave.gameState.teams) {
    const controlMode = controlSettingsMap[team.teamId]?.controlMode ?? "manual";
    // NUR AI-gesteuerte Teams. Menschlich (manual) gesteuerte Teams NIE ueberschreiben.
    if (controlMode !== "ai") {
      if (controlMode === "manual") skippedManual += 1;
      continue;
    }
    teamsEvaluated += 1;

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
    const assignments = plans.map((plan) => ({ playerId: plan.playerId, trainingMode: plan.selectedMode }));
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
      "ai_matchday_training_reeval",
    );
    if (result.applied) {
      teamsUpdated += 1;
      playersReassigned += changedCount;
      currentSave = result.save ?? persistence.getSaveById(currentSave.saveId) ?? currentSave;
    }
  }

  deferred.flush();

  return { teamsEvaluated, teamsUpdated, playersReassigned, skippedManual };
}
