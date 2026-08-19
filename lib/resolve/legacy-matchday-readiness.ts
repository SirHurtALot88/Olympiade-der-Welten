import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { countSelectedAvailablePlayers, isPartialLineupComplete } from "@/lib/lineups/legacy-matchday-partial-lineup-rule";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";

export type LegacyMatchdayReadinessStatus =
  | "ready"
  | "underfilled_roster"
  | "missing_lineup"
  | "invalid_lineup"
  | "missing_score_coverage"
  | "unknown";

export type LegacyMatchdayReadiness = {
  teamId: string;
  teamName: string;
  activePlayersCount: number;
  requiredTotalUniquePlayers: number;
  readinessStatus: LegacyMatchdayReadinessStatus;
  reasonCodes: string[];
  shortReason: string;
};

/**
 * Slot-Zahlen IMMER seitenspezifisch (`<disciplineId>::d1|d2`) mit Rückfall auf die generische
 * Disziplin-Zahl — identisch zu `lib/lineups/legacy-matchday-readiness.ts`.
 *
 * Vorher las diese Variante ausschliesslich `disciplinePlayerCounts`, also den generischen Wert der
 * Disziplin statt der fuer DIESEN Spieltag angesetzten Slot-Zahl. Folge: die Auswertung verlangte
 * z. B. 4/4 Spieler, wo der Spielplan 2/6 vorsah. Da die SUMME in beiden Faellen gleich ist (8),
 * meldete jede Gesamt-Pruefung weiterhin "8/8 bereit" — der Fehler trat erst pro Seite auf und
 * setzte dort `wrong_player_count` -> `invalid_lineup`.
 *
 * Wirkung des Bugs: `legacy-matchday-result-apply-service` schrieb JEDES Team als
 * `invalid_lineup` in das gespeicherte Spieltagsergebnis (`teamsReady: 0/32`), obwohl Aufstellungen
 * gueltig waren und Scores/Raenge korrekt berechnet wurden. Die Standings-Vorschau leitete daraus
 * `incomplete_result` fuer alle Teams ab, und `standings-apply-service` blockierte die Uebernahme —
 * die Liga-Tabelle liess sich nicht mehr fortschreiben. Die Resolve-VORSCHAU war nie betroffen, weil
 * sie die andere Readiness-Implementierung nutzt; genau diese Diskrepanz machte den Bug unsichtbar.
 */
function getRequiredCounts(context: LegacyLineupLoadedContext) {
  const d1DisciplineId = context.contextMeta.d1DisciplineId;
  const d2DisciplineId = context.contextMeta.d2DisciplineId;
  const d1Required = d1DisciplineId
    ? context.disciplineSidePlayerCounts?.[`${d1DisciplineId}::d1`] ?? context.disciplinePlayerCounts[d1DisciplineId] ?? 0
    : 0;
  const d2Required = d2DisciplineId
    ? context.disciplineSidePlayerCounts?.[`${d2DisciplineId}::d2`] ?? context.disciplinePlayerCounts[d2DisciplineId] ?? 0
    : 0;

  return {
    d1Required,
    d2Required,
    requiredTotalUniquePlayers: d1Required + d2Required,
  };
}

export function buildLegacyMatchdayReadiness(
  context: LegacyLineupLoadedContext,
): LegacyMatchdayReadiness {
  const { d1Required, d2Required, requiredTotalUniquePlayers } = getRequiredCounts(context);
  const activePlayersCount = context.activePlayers.length;
  const draft = context.existingDraft;

  if (!draft) {
    return {
      teamId: context.team.id,
      teamName: context.team.name,
      activePlayersCount,
      requiredTotalUniquePlayers,
      readinessStatus: "missing_lineup",
      reasonCodes: ["no_existing_draft"],
      shortReason: "No legacy lineup draft exists for this team.",
    };
  }

  const selectedPlayerCount = new Set(draft.entries.map((entry) => entry.playerId)).size;
  const allowPartialLineup = isPartialLineupComplete({
    activePlayersCount,
    requiredTotalUniquePlayers,
    selectedAvailablePlayerCount: countSelectedAvailablePlayers(
      draft.entries.map((entry) => entry.playerId),
      context.activePlayers.map((eintrag) => eintrag.playerId),
    ),
  });
  const validation = validateLegacyLineupContext({
    ...context,
    entries: draft.entries,
    disciplinePlayerCounts: Object.fromEntries(
      [
        context.contextMeta.d1DisciplineId
          ? [context.contextMeta.d1DisciplineId, d1Required]
          : null,
        context.contextMeta.d2DisciplineId
          ? [context.contextMeta.d2DisciplineId, d2Required]
          : null,
      ].filter((entry): entry is [string, number] => Boolean(entry)),
    ),
    disciplineSidePlayerCounts: Object.fromEntries(
      [
        context.contextMeta.d1DisciplineId
          ? [`${context.contextMeta.d1DisciplineId}::d1`, d1Required]
          : null,
        context.contextMeta.d2DisciplineId
          ? [`${context.contextMeta.d2DisciplineId}::d2`, d2Required]
          : null,
      ].filter((entry): entry is [string, number] => Boolean(entry)),
    ),
  }, {
    enforceCompleteness: !allowPartialLineup,
  });

  if (!validation.isValid) {
    const reasonCodes = validation.errors.map((error) => {
      if (error.includes("duplicate")) return "duplicate_player_usage";
      if (error.includes("Expected")) return "wrong_player_count";
      if (error.includes("does not match")) return "player_mismatch";
      return "invalid_lineup";
    });

    return {
      teamId: context.team.id,
      teamName: context.team.name,
      activePlayersCount,
      requiredTotalUniquePlayers,
      readinessStatus: "invalid_lineup",
      reasonCodes,
      shortReason: validation.errors[0] ?? "Draft validation failed.",
    };
  }

  const scoreWarnings = [
    ...(context.contextMeta.d1DisciplineId
      ? scoreLegacyLineupDisciplineSide({
          disciplineId: context.contextMeta.d1DisciplineId,
          disciplineSide: "d1",
          entries: draft.entries,
          disciplineScores: context.disciplineScores,
        }).missingScores
      : []),
    ...(context.contextMeta.d2DisciplineId
      ? scoreLegacyLineupDisciplineSide({
          disciplineId: context.contextMeta.d2DisciplineId,
          disciplineSide: "d2",
          entries: draft.entries,
          disciplineScores: context.disciplineScores,
        }).missingScores
      : []),
  ];

  if (scoreWarnings.length > 0) {
    return {
      teamId: context.team.id,
      teamName: context.team.name,
      activePlayersCount,
      requiredTotalUniquePlayers,
      readinessStatus: "missing_score_coverage",
      reasonCodes: ["missing_discipline_scores"],
      shortReason: `Missing ${scoreWarnings.length} discipline score entries for used players.`,
    };
  }

  if (d1Required === 0 && d2Required === 0) {
    return {
      teamId: context.team.id,
      teamName: context.team.name,
      activePlayersCount,
      requiredTotalUniquePlayers,
      readinessStatus: "unknown",
      reasonCodes: ["missing_matchday_requirements"],
      shortReason: "Matchday requirements could not be derived.",
    };
  }

  return {
    teamId: context.team.id,
    teamName: context.team.name,
    activePlayersCount,
    requiredTotalUniquePlayers,
    readinessStatus: "ready",
    reasonCodes: allowPartialLineup ? ["partial_lineup_allowed"] : [],
    shortReason: allowPartialLineup
      ? `All ${activePlayersCount} available players are used. Partial lineup is allowed (${activePlayersCount}/${requiredTotalUniquePlayers}).`
      : `Draft is valid for ${d1Required}+${d2Required} slots.`,
  };
}
