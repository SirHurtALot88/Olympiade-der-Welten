import { buildLegacyMatchdayReadiness } from "@/lib/lineups/legacy-matchday-readiness";
import { loadAllLocalLegacyLineupContexts } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupContextLoadResult } from "@/lib/lineups/legacy-lineup-types";
import type { GameState } from "@/lib/data/olyDataTypes";
import { resolveLocalPersistedSave } from "@/lib/persistence/resolve-local-save";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  attachMatchdayInjuryPerformanceToContexts,
  buildMatchdayInjuryRollMap,
} from "@/lib/fatigue/fatigue-injury-service";
import {
  buildResolveLabPlayerCatalog,
  buildResolveLabSummary,
  buildResolveLabTeamDetails,
  buildResolveLabTopPlayersBySide,
  getHighlightCandidatesForTeam,
  getTopPlayerNameForTeam,
} from "@/lib/resolve/legacy-resolve-lab";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";

export type LegacyMatchdayResolvePreviewPayload = {
  source: "sqlite" | "prisma";
  params: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  summary: ReturnType<typeof buildResolveLabSummary>;
  preview: ReturnType<typeof buildLegacyMatchdayResolvePreview>;
  teamDetails: ReturnType<typeof buildResolveLabTeamDetails>;
  topPlayers: ReturnType<typeof buildResolveLabTopPlayersBySide>;
  playerCatalog: ReturnType<typeof buildResolveLabPlayerCatalog>;
  warnings: string[];
  teamRows: Array<
    ReturnType<typeof buildLegacyMatchdayResolvePreview>["teamResults"][number] & {
      topPlayer: string | null;
      highlightFlag: boolean;
      readinessStatus: string;
      readinessReasonCodes: string[];
      activePlayersCount: number;
      requiredTotalUniquePlayers: number;
      missingPlayersToRequirement: number;
      shortReason: string;
    }
  >;
};

export function buildLegacyMatchdayResolvePreviewPayload(input: {
  source: "sqlite" | "prisma";
  params: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  contextResults: LegacyLineupContextLoadResult[];
  /**
   * GameState der SQLite-Persistenz. Wird — genau wie im echten Apply-Pfad
   * (legacy-matchday-result-apply-service, matchday-auto-run-service) — nur für
   * die SQLite-Quelle gebraucht, um die DETERMINISTISCHE Same-Day-Injury-Rolle
   * (stableHash-Seed) an die Contexts zu heften. Ohne sie fiele die Vorschau auf
   * injuryMultiplier=1 zurück und würde die Totals gegenüber dem persistierten
   * Ergebnis systematisch überschätzen. Fehlt der GameState (Prisma, Tests),
   * bleibt das Verhalten unverändert.
   */
  gameState?: GameState | null;
}): LegacyMatchdayResolvePreviewPayload | null {
  const warnings = input.contextResults.flatMap((result) => result.warnings);
  const contexts = input.contextResults.flatMap((result) => (result.ok ? [result.context] : []));

  if (contexts.length === 0) {
    return null;
  }

  // Deterministische Same-Day-Verletzungs-Performance (0.75x) exakt wie die
  // Apply-Pfade an die Contexts heften, BEVOR die Vorschau gescored wird — so
  // zeigt die Vorschau denselben Malus, den das angewandte Ergebnis verhängt
  // (Vorschau == angewandtes Ergebnis, nicht divergent).
  if (input.gameState) {
    const injuryRollMap = buildMatchdayInjuryRollMap({
      gameState: input.gameState,
      saveId: input.params.saveId,
      seasonId: input.params.seasonId,
      matchdayId: input.params.matchdayId,
    });
    attachMatchdayInjuryPerformanceToContexts(contexts, injuryRollMap);
  }

  const readinessRows = contexts.map((context) => buildLegacyMatchdayReadiness(context));
  const readinessByTeamId = new Map(readinessRows.map((row) => [row.teamId, row]));
  const preview = buildLegacyMatchdayResolvePreview(contexts);
  const summary = buildResolveLabSummary(preview, contexts, readinessByTeamId);
  const teamDetails = buildResolveLabTeamDetails(contexts, preview, readinessByTeamId);
  const topPlayers = buildResolveLabTopPlayersBySide(preview, contexts);
  const playerCatalog = buildResolveLabPlayerCatalog(contexts);

  return {
    source: input.source,
    params: input.params,
    summary,
    preview,
    teamDetails,
    topPlayers,
    playerCatalog,
    warnings: Array.from(new Set([...warnings, ...preview.warnings])),
    teamRows: preview.teamResults.map((team) => ({
      ...team,
      topPlayer: getTopPlayerNameForTeam(preview, team.teamId),
      highlightFlag: getHighlightCandidatesForTeam(preview, team.teamId).length > 0,
      readinessStatus: readinessByTeamId.get(team.teamId)?.readinessStatus ?? "unknown",
      readinessReasonCodes: readinessByTeamId.get(team.teamId)?.reasonCodes ?? ["readiness_missing"],
      activePlayersCount: readinessByTeamId.get(team.teamId)?.activePlayersCount ?? 0,
      requiredTotalUniquePlayers: readinessByTeamId.get(team.teamId)?.requiredTotalUniquePlayers ?? 0,
      missingPlayersToRequirement: readinessByTeamId.get(team.teamId)?.missingPlayersToRequirement ?? 0,
      shortReason: readinessByTeamId.get(team.teamId)?.shortReason ?? "No readiness explanation available.",
    })),
  };
}

export function loadSqliteLegacyMatchdayResolvePreview(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
}) {
  // Persistenz einmal auflösen und teilen: Contexts UND GameState stammen so aus
  // demselben Save-Snapshot, wie es der Apply-Pfad tut.
  const persistence = createPersistenceService();
  const { save } = resolveLocalPersistedSave(persistence, input.saveId);
  const contextResults = loadAllLocalLegacyLineupContexts(input, persistence);
  return buildLegacyMatchdayResolvePreviewPayload({
    source: "sqlite",
    params: input,
    contextResults,
    gameState: save.gameState,
  });
}
