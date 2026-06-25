import fs from "node:fs";
import path from "node:path";

import type { ContractShape, GameState, RosterEntry } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import {
  buildContractNegotiationPreview,
  recommendContractOfferForPlayer,
} from "@/lib/market/contract-negotiation-preview";
import { calculateTransfermarktFit } from "@/lib/market/transfermarkt-fit";
import { buildPlayerMoralePerformanceMap } from "@/lib/morale/player-morale-performance";
import { assessPlayerMorale } from "@/lib/morale/player-morale-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function hasArg(name: string) {
  return process.argv.includes(name);
}

function argValue(name: string) {
  const inline = process.argv.find((entry) => entry.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function contractLengthDistribution(rosters: RosterEntry[]) {
  const distribution: Record<string, number> = {};
  for (const roster of rosters) {
    const key = String(Math.max(1, Math.round(roster.contractLength ?? 1)));
    distribution[key] = (distribution[key] ?? 0) + 1;
  }
  return distribution;
}

function getControlMode(gameState: GameState, teamId: string) {
  const settings = gameState.seasonState.teamControlSettings as unknown;
  if (Array.isArray(settings)) {
    return settings.find((entry: { teamId?: string; controlMode?: string }) => entry.teamId === teamId)?.controlMode ?? null;
  }
  if (settings && typeof settings === "object") {
    return (settings as Record<string, { controlMode?: string } | string | undefined>)[teamId];
  }
  return null;
}

function isManualTeam(gameState: GameState, teamId: string) {
  const control = getControlMode(gameState, teamId);
  if (typeof control === "string") return control === "manual";
  return control?.controlMode === "manual";
}

function inferDealRole(roster: RosterEntry, marketValue: number | null) {
  const role = roster.roleTag ?? roster.promisedRole ?? "";
  if ((marketValue ?? 0) >= 70) return "premium";
  if ((marketValue ?? 0) >= 45) return "core";
  if (role === "starter" && (marketValue ?? 0) >= 25) return "core";
  if (role === "prospect") return "prospect";
  if (role === "bench") return "depth";
  return (marketValue ?? 0) >= 35 ? "core" : "depth";
}

function teamSalary(gameState: GameState, teamId: string) {
  return round(
    gameState.rosters
      .filter((entry) => entry.teamId === teamId)
      .reduce((sum, entry) => sum + (entry.salary ?? entry.upkeep ?? 0), 0),
    2,
  );
}

function moraleSummary(gameState: GameState, teamIds: Set<string>) {
  const rows = gameState.rosters
    .filter((entry) => teamIds.has(entry.teamId))
    .map((roster) => {
      const morale = assessPlayerMorale({ gameState, playerId: roster.playerId, teamId: roster.teamId });
      const signal = buildPlayerMoralePerformanceMap({
        gameState,
        teamId: roster.teamId,
        rosterEntries: [roster],
      })?.[roster.playerId] ?? null;
      return {
        teamId: roster.teamId,
        playerId: roster.playerId,
        morale: morale?.morale ?? null,
        mood: morale?.visibleMood ?? null,
        scoreEffectPct: signal?.modifierPct ?? null,
      };
    });
  const moraleValues = rows.map((row) => row.morale).filter((value): value is number => typeof value === "number");
  const scoreEffects = rows.map((row) => row.scoreEffectPct).filter((value): value is number => typeof value === "number");
  return {
    players: rows.length,
    avgMorale: moraleValues.length ? round(moraleValues.reduce((sum, value) => sum + value, 0) / moraleValues.length, 1) : null,
    minMorale: moraleValues.length ? round(Math.min(...moraleValues), 1) : null,
    maxMorale: moraleValues.length ? round(Math.max(...moraleValues), 1) : null,
    avgScoreEffectPct: scoreEffects.length ? round(scoreEffects.reduce((sum, value) => sum + value, 0) / scoreEffects.length, 2) : null,
    riskCount: rows.filter((row) => (row.scoreEffectPct ?? 0) < -0.3).length,
    boostCount: rows.filter((row) => (row.scoreEffectPct ?? 0) > 0.3).length,
  };
}

function main() {
  const persistence = createPersistenceService();
  const saveId = argValue("--save-id") ?? undefined;
  const save = saveId ? persistence.getSaveById(saveId) : persistence.getActiveSave();
  if (!save) throw new Error("No active save found.");

  const outputDir =
    argValue("--output-dir") ??
    path.join(process.cwd(), "outputs", `ai-contract-repair-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const gameState = save.gameState;
  const includeManualTeams = hasArg("--include-manual");
  const manualTeamIds = new Set(gameState.teams.filter((team) => isManualTeam(gameState, team.teamId) || team.humanControlled).map((team) => team.teamId));
  const aiTeamIds = new Set(gameState.teams.filter((team) => includeManualTeams || !manualTeamIds.has(team.teamId)).map((team) => team.teamId));
  const beforeRosters = gameState.rosters.filter((entry) => aiTeamIds.has(entry.teamId));
  const beforeDistribution = contractLengthDistribution(beforeRosters);
  const currentRosterCountByTeam = new Map<string, number>();
  for (const roster of gameState.rosters) {
    currentRosterCountByTeam.set(roster.teamId, (currentRosterCountByTeam.get(roster.teamId) ?? 0) + 1);
  }
  const changes: Array<Record<string, unknown>> = [];

  const nextGameState: GameState = {
    ...gameState,
    rosters: gameState.rosters.map((roster) => {
      if (!aiTeamIds.has(roster.teamId)) {
        return roster;
      }

      const player = gameState.players.find((entry) => entry.id === roster.playerId) ?? null;
      const team = gameState.teams.find((entry) => entry.teamId === roster.teamId) ?? null;
      const identity = gameState.teamIdentities.find((entry) => entry.teamId === roster.teamId) ?? null;
      if (!player || !team) {
        return roster;
      }

      const economy = resolvePlayerEconomyContract({ player, rosterEntry: roster });
      const marketValue = roster.currentValue ?? roster.purchasePrice ?? economy.marketValue ?? null;
      const rosterBefore = currentRosterCountByTeam.get(roster.teamId) ?? 0;
      const currentTeamSalary = teamSalary(gameState, roster.teamId);
      const reconstructedDecisionCash = Math.max(team.cash ?? 0, team.budget ?? 0);
      const rosterPlayersWithoutCurrent = gameState.rosters
        .filter((entry) => entry.teamId === roster.teamId && entry.playerId !== roster.playerId)
        .map((entry) => gameState.players.find((candidate) => candidate.id === entry.playerId))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
      const teamFit = calculateTransfermarktFit(player, rosterPlayersWithoutCurrent, { teamId: roster.teamId }).teamFit;
      const recommended = recommendContractOfferForPlayer({
        player,
        teamStrategyProfile: getTeamStrategyProfile(gameState, roster.teamId),
        teamIdentity: identity,
        teamCash: reconstructedDecisionCash,
        marketValue,
        teamFit,
        currentTeamSalary,
        dealRole: inferDealRole(roster, marketValue),
        rosterCountBefore: rosterBefore,
        teamRosterMin: identity?.playerMin ?? team.rosterMinTarget ?? null,
        teamRosterOpt: identity?.playerOpt ?? team.rosterOptTarget ?? null,
        isFirstSeason: gameState.season.id === "season-1",
      });
      const preview = buildContractNegotiationPreview({
        saveId: save.saveId,
        seasonId: gameState.season.id,
        teamId: roster.teamId,
        team,
        teamIdentity: identity,
        teamStrategyProfile: getTeamStrategyProfile(gameState, roster.teamId),
        player,
        rosterEntry: roster,
        rosterPlayers: rosterPlayersWithoutCurrent,
        contractLength: recommended.contractLength,
        contractShape: recommended.contractShape,
        offeredSalary: null,
        seasonIdBase: gameState.season.id,
        seasonLabelBase: gameState.season.name,
      });

      const nextSalary = preview.offeredSalary ?? roster.salary;
      const nextShape: ContractShape = recommended.contractShape;
      const salaryChanged = Math.abs((roster.salary ?? 0) - nextSalary) >= 0.01;
      const lengthChanged = roster.contractLength !== recommended.contractLength;
      const shapeChanged = (roster.contractShape ?? "balanced") !== nextShape;

      if (lengthChanged || shapeChanged || salaryChanged) {
        changes.push({
          teamId: roster.teamId,
          teamCode: team.shortCode,
          teamName: team.name,
          playerId: roster.playerId,
          playerName: player.name,
          marketValue,
          oldLength: roster.contractLength,
          newLength: recommended.contractLength,
          oldShape: roster.contractShape ?? "balanced",
          newShape: nextShape,
          oldSalary: roster.salary,
          newSalary: nextSalary,
          reasons: recommended.reasons.join(" | "),
        });
      }

      return {
        ...roster,
        contractLength: recommended.contractLength,
        contractShape: nextShape,
        salary: nextSalary,
        upkeep: nextSalary,
        yearlySalarySchedule: preview.yearlySalarySchedule,
      };
    }),
    logs: [
      {
        id: `ai-contract-repair-${Date.now()}`,
        type: "ai",
        message: `AI-Vertraege neu bewertet: ${changes.length} bestehende Roster-Eintraege angepasst. Manuelle Teams unveraendert.`,
        createdAt: new Date().toISOString(),
      },
      ...(gameState.logs ?? []),
    ],
  };

  const afterRosters = nextGameState.rosters.filter((entry) => aiTeamIds.has(entry.teamId));
  const summary = {
    dryRun: !hasArg("--write"),
    saveId: save.saveId,
    saveName: save.name,
    outputDir,
    manualTeamsSkipped: includeManualTeams
      ? []
      : gameState.teams
          .filter((team) => manualTeamIds.has(team.teamId))
          .map((team) => ({ teamId: team.teamId, teamCode: team.shortCode, teamName: team.name })),
    includeManualTeams,
    aiTeams: aiTeamIds.size,
    aiRosterEntries: beforeRosters.length,
    changedEntries: changes.length,
    beforeDistribution,
    afterDistribution: contractLengthDistribution(afterRosters),
    moraleCurrent: moraleSummary(nextGameState, aiTeamIds),
    changes,
  };

  fs.writeFileSync(path.join(outputDir, "ai-contract-repair-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(outputDir, "ai-contract-repair-changes.csv"),
    [
      "teamCode,playerName,oldLength,newLength,oldSalary,newSalary,oldShape,newShape,marketValue",
      ...changes.map((row) =>
        [
          row.teamCode,
          JSON.stringify(row.playerName),
          row.oldLength,
          row.newLength,
          row.oldSalary,
          row.newSalary,
          row.oldShape,
          row.newShape,
          row.marketValue,
        ].join(","),
      ),
    ].join("\n"),
    "utf8",
  );

  if (hasArg("--write")) {
    const backup = persistence.cloneSave(save.saveId, `${save.name} · Backup vor AI-Vertragsrepair ${new Date().toLocaleString("de-DE")}`);
    persistence.saveSingleplayerState(backup.saveId, backup.gameState, { status: "archived" });
    persistence.saveSingleplayerState(save.saveId, nextGameState, { status: "active" });
    persistence.activateSave(save.saveId);
    summary["backupSaveId" as keyof typeof summary] = backup.saveId as never;
    fs.writeFileSync(path.join(outputDir, "ai-contract-repair-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(summary, null, 2));
}

main();
