import fs from "node:fs";
import path from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { prepareLegacyMatchdayResultApply } from "@/lib/resolve/legacy-matchday-result-apply-service";
import { getRankToPointsValue } from "@/lib/resolve/rank-to-points";

const OUTPUT_DIR =
  process.env.OLY_OUTPUT_DIR ??
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";

function roundValue(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function writeFile(name: string, content: string) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, name);
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  return filePath;
}

function rankByScore<T>(rows: T[], accessor: (row: T) => number) {
  return [...rows]
    .sort((left, right) => accessor(right) - accessor(left))
    .map((row, index) => ({ row, rank: index + 1 }));
}

async function main() {
  const persistence = createPersistenceService();
  const activeSave = persistence.getActiveSave();
  if (!activeSave) {
    throw new Error("No active local save found for mutator scoring audit.");
  }

  const scope = {
    saveId: activeSave.saveId,
    seasonId: activeSave.gameState.season.id,
    matchdayId: activeSave.gameState.matchdayState.matchdayId,
  };
  const warnings: string[] = [];
  const teamRows: Array<Record<string, unknown>> = [];
  const playerRows: Array<Record<string, unknown>> = [];
  const parityRows: Array<Record<string, unknown>> = [];

  let previewStatus: string | null = null;
  let canApply = false;
  let blockingReasons: string[] = [];

  try {
    const prepared = await prepareLegacyMatchdayResultApply(
      {
        ...scope,
        source: "sqlite",
        forceReplace: true,
        allowIncompleteOverride: true,
      },
      {
        persistence,
        resolveOptions: {
          modifierMode: "legacy_selected_traits",
          captainMode: "legacy_strongest_selected",
        },
      },
    );
    previewStatus = prepared.preview.status;
    canApply = prepared.canApply;
    blockingReasons = prepared.blockingReasons;

    const storedResult = (activeSave.gameState.seasonState.matchdayResults ?? []).find(
      (result) =>
        result.saveId === scope.saveId &&
        result.seasonId === scope.seasonId &&
        result.matchdayId === scope.matchdayId,
    );
    const storedDisciplineRows = activeSave.gameState.seasonState.disciplineResults ?? [];

    for (const disciplinePreview of prepared.preview.disciplinePreviews) {
      const beforeRanks = new Map(
        rankByScore(disciplinePreview.teamResults, (team) => team.finalPreviewScore - (team.mutatorModifier ?? 0)).map(
          ({ row, rank }) => [`${row.teamId}::${row.disciplineSide}`, rank] as const,
        ),
      );
      for (const team of disciplinePreview.teamResults) {
        const matchingMutators = team.mutatorSlots.filter((slot) => (slot.scoreModifier ?? 0) > 0).length;
        const scoreBeforeMutator = roundValue(team.finalPreviewScore - (team.mutatorModifier ?? 0), 1);
        const rankBeforeMutator = beforeRanks.get(`${team.teamId}::${team.disciplineSide}`) ?? null;
        const pointsBeforeMutator =
          rankBeforeMutator == null ? null : getRankToPointsValue(team.entries.length, rankBeforeMutator);
        const pointsAfterMutator = team.teamPoints;

        teamRows.push({
          Matchday: scope.matchdayId,
          Discipline: disciplinePreview.disciplineName,
          DisciplineId: disciplinePreview.disciplineId,
          Side: disciplinePreview.disciplineSide,
          Team: team.teamName,
          TeamId: team.teamId,
          MatchingMutators: matchingMutators,
          ScoreBefore: scoreBeforeMutator,
          MutatorScoreBonus: team.mutatorModifier ?? 0,
          ScoreAfter: team.finalPreviewScore,
          RankBefore: rankBeforeMutator,
          RankAfter: team.rank,
          PointsBefore: pointsBeforeMutator,
          PointsAfter: pointsAfterMutator,
          PointsDelta: pointsBeforeMutator == null || pointsAfterMutator == null ? null : roundValue(pointsAfterMutator - pointsBeforeMutator, 4),
          MutatorMode: team.mutatorMode,
          Source: "legacy_selected_traits",
          Warnings: team.warnings.join(" | "),
        });

        const stored = storedResult
          ? storedDisciplineRows.find(
              (row) =>
                row.matchdayResultId === storedResult.id &&
                row.teamId === team.teamId &&
                row.disciplineId === disciplinePreview.disciplineId &&
                row.disciplineSide === team.disciplineSide,
            )
          : null;
        parityRows.push({
          Matchday: scope.matchdayId,
          Discipline: disciplinePreview.disciplineName,
          Side: disciplinePreview.disciplineSide,
          Team: team.teamName,
          PreviewScore: team.finalPreviewScore,
          AppliedScore: stored?.totalScore ?? null,
          Delta: stored?.totalScore == null ? null : roundValue(team.finalPreviewScore - stored.totalScore, 4),
          Status: stored ? (Math.abs(team.finalPreviewScore - stored.totalScore) < 0.0001 ? "match" : "mismatch") : "no_applied_result_for_scope",
        });
      }

      for (const player of disciplinePreview.topPlayers) {
        const mutatorPps = player.mutatorPpsBonus ?? 0;
        const basePps = player.pointsAwarded ?? 0;
        playerRows.push({
          Matchday: scope.matchdayId,
          Discipline: disciplinePreview.disciplineName,
          DisciplineId: disciplinePreview.disciplineId,
          Side: disciplinePreview.disciplineSide,
          TeamId: player.teamId,
          Player: player.playerName,
          PlayerId: player.playerId,
          BasePPs: basePps,
          MutatorPPs: mutatorPps,
          TotalPPs: roundValue(basePps + mutatorPps, 4),
          MutatorScoreBonus: player.mutatorBonus ?? 0,
          FinalPlayerScore: player.finalPlayerScore,
          Source: "legacy_selected_traits",
          Warnings: mutatorPps > 0 ? "" : "no_matching_player_mutator",
        });
      }
    }
  } catch (error) {
    warnings.push(`preview_unavailable:${error instanceof Error ? error.message : String(error)}`);
  }

  if (teamRows.length === 0) {
    warnings.push("no_mutator_team_preview_rows");
  }
  if (playerRows.length === 0) {
    warnings.push("no_mutator_player_preview_rows");
  }

  const summary = {
    scope,
    save: {
      name: activeSave.name,
      scenarioType: activeSave.gameState.scenarioMeta?.scenarioType ?? null,
      allowTestWrites: activeSave.gameState.scenarioMeta?.allowTestWrites ?? false,
    },
    source: {
      mutatorStorage: "lineupDraft.modifiers.d1/d2.mutatorTrait1/mutatorTrait2",
      mutatorMode: "legacy_selected_traits",
      d1AndD2HaveSeparateMutatorSelections: true,
      scoreRule: "matchingMutatorCount * 6",
      playerPpsRule: "matchingMutatorCountForPlayer * 0.3",
      playerMatchRule: "selected mutator trait matches player positive/negative traits",
    },
    previewStatus,
    canApply,
    blockingReasons,
    rowCounts: {
      teamScoreRows: teamRows.length,
      playerPpsRows: playerRows.length,
      parityRows: parityRows.length,
    },
    warnings,
  };

  const jsonPath = writeFile("mutator-scoring-audit.json", JSON.stringify({ summary, teamRows, playerRows, parityRows }, null, 2));
  const teamCsvPath = writeFile(
    "mutator-team-score-audit.csv",
    toCsv(teamRows, [
      "Matchday",
      "Discipline",
      "DisciplineId",
      "Side",
      "Team",
      "TeamId",
      "MatchingMutators",
      "ScoreBefore",
      "MutatorScoreBonus",
      "ScoreAfter",
      "RankBefore",
      "RankAfter",
      "PointsBefore",
      "PointsAfter",
      "PointsDelta",
      "MutatorMode",
      "Source",
      "Warnings",
    ]),
  );
  const playerCsvPath = writeFile(
    "mutator-player-pps-audit.csv",
    toCsv(playerRows, [
      "Matchday",
      "Discipline",
      "DisciplineId",
      "Side",
      "TeamId",
      "Player",
      "PlayerId",
      "BasePPs",
      "MutatorPPs",
      "TotalPPs",
      "MutatorScoreBonus",
      "FinalPlayerScore",
      "Source",
      "Warnings",
    ]),
  );
  const parityCsvPath = writeFile(
    "mutator-preview-apply-parity.csv",
    toCsv(parityRows, ["Matchday", "Discipline", "Side", "Team", "PreviewScore", "AppliedScore", "Delta", "Status"]),
  );
  const markdownPath = writeFile(
    "mutator-scoring-audit.md",
    [
      "# Mutator Scoring Audit",
      "",
      `- Save: ${activeSave.name} (${activeSave.saveId})`,
      `- Scope: ${scope.seasonId} / ${scope.matchdayId}`,
      `- Preview status: ${previewStatus ?? "unavailable"}`,
      `- Score rule: ${summary.source.scoreRule}`,
      `- Player-PP rule: ${summary.source.playerPpsRule}`,
      `- Player match source: ${summary.source.playerMatchRule}`,
      `- Team score rows: ${teamRows.length}`,
      `- Player PPs rows: ${playerRows.length}`,
      `- Parity rows: ${parityRows.length}`,
      `- Warnings: ${warnings.length > 0 ? warnings.join(" | ") : "none"}`,
      "",
      "## Files",
      "",
      `- JSON: ${jsonPath}`,
      `- Team score CSV: ${teamCsvPath}`,
      `- Player PPs CSV: ${playerCsvPath}`,
      `- Preview/apply parity CSV: ${parityCsvPath}`,
      "",
    ].join("\n"),
  );

  console.log(
    JSON.stringify(
      {
        ok: warnings.length === 0 || teamRows.length > 0,
        summary,
        exports: {
          markdown: markdownPath,
          json: jsonPath,
          teamCsv: teamCsvPath,
          playerCsv: playerCsvPath,
          parityCsv: parityCsvPath,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
