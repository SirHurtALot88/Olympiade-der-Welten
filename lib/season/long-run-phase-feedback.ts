import type { AiPicksRunResult } from "@/lib/ai/ai-picks-run-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import {
  classifyTeamDraftQuality,
  formatPhaseAuditSummaryDe,
  type PhaseAuditResult,
  type LongRunPhaseAuditPhase,
} from "@/lib/season/long-run-phase-audit";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import type { PersistedSaveGame } from "@/lib/persistence/types";

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

export function buildPhaseFeedbackMarkdownDe(input: {
  save: PersistedSaveGame;
  phase: LongRunPhaseAuditPhase;
  audit: PhaseAuditResult;
  picksRun?: AiPicksRunResult | null;
}) {
  const { save, phase, audit, picksRun } = input;
  const gameState = save.gameState;
  const seasonId = gameState.season.id;
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  const identityByTeam = new Map(gameState.teamIdentities.map((entry) => [entry.teamId, entry]));

  const teamRows = gameState.teams.map((team) => {
    const identity = identityByTeam.get(team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const draftFees = gameState.transferHistory
      .filter((entry) => entry.seasonId === seasonId && entry.toTeamId === team.teamId && entry.transferType === "buy")
      .reduce((sum, entry) => sum + (entry.fee ?? 0), 0);
    const marketValue = roster.reduce((sum, entry) => {
      const player = playerById.get(entry.playerId);
      return sum + (resolvePlayerEconomyContract({ player, rosterEntry: entry }).marketValue ?? 0);
    }, 0);
    const salary = roster.reduce((sum, entry) => {
      const player = playerById.get(entry.playerId);
      return sum + (resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0);
    }, 0);
    const quality = classifyTeamDraftQuality(team, identity, team.cash ?? 0, roster.length);
    return {
      code: team.shortCode,
      rosterLabel: `${roster.length}/${playerMin}/${playerOpt}`,
      cash: round(team.cash ?? 0),
      budget: round(team.budget ?? 0),
      marketValue: round(marketValue),
      salary: round(salary),
      draftFees: round(draftFees),
      quality,
      sponsor: getTeamSponsorContract(gameState, team.teamId)?.name ?? "—",
    };
  });

  teamRows.sort((left, right) => left.code.localeCompare(right.code));
  const totalCash = round(teamRows.reduce((sum, row) => sum + row.cash, 0));
  const totalMw = round(teamRows.reduce((sum, row) => sum + row.marketValue, 0));
  const atMin = teamRows.filter((row) => {
    const [roster, min] = row.rosterLabel.split("/").map(Number);
    return roster >= min;
  }).length;
  const atOpt = teamRows.filter((row) => {
    const [roster, , opt] = row.rosterLabel.split("/").map(Number);
    return roster >= opt;
  }).length;

  const factorWindow = getSeasonEconomyFactorWindow({
    saveId: save.saveId,
    seasonId,
    seasonState: gameState.seasonState,
  });

  const lines = [
    `# Long-Run Feedback · ${phase} · ${seasonId}`,
    "",
    `- Save: \`${save.saveId}\``,
    `- Phase: **${phase}**`,
    `- Spielphase: ${gameState.gamePhase ?? "?"} · MD ${gameState.season.currentMatchday ?? "?"}`,
    "",
    "## Liga-Kurz",
    "",
    `- Cash Σ **${totalCash}** · MW Σ **${totalMw}**`,
    `- Kader ≥Min **${atMin}/${teamRows.length}** · ≥Opt **${atOpt}/${teamRows.length}**`,
    `- Salary-Factor-Fenster: ${factorWindow.map((row) => `${row.seasonLabel}=${row.factor}`).join(" · ")}`,
    "",
    "## Audit",
    "",
    `- PASS **${audit.passCount}** · WARN **${audit.warnCount}** · RED **${audit.redCount}**`,
    "",
  ];

  for (const entry of audit.checks) {
    lines.push(`- **${entry.status}** \`${entry.id}\`: ${entry.detail}`);
  }

  if (picksRun) {
    lines.push("", "## Picks-Run", "");
    lines.push(
      `- applied **${picksRun.globalExecution.appliedPickCount}** · preview **${picksRun.performance.previewMs}ms** · execute **${picksRun.performance.executeMs}ms**`,
    );
  }

  lines.push("", "## Teams", "", "| Team | Kader(min/opt) | Qualität | Cash | Budget | MW | Gehalt | Draft-Fees | Sponsor |", "|---|---:|---|---:|---:|---:|---:|---:|---|");
  for (const row of teamRows) {
    lines.push(
      `| ${row.code} | ${row.rosterLabel} | ${row.quality} | ${row.cash} | ${row.budget} | ${row.marketValue} | ${row.salary} | ${row.draftFees} | ${row.sponsor} |`,
    );
  }

  lines.push("", "## Nächster Schritt", "");
  if (phase === "draft") {
    lines.push("- Bei PASS/WARN ohne RED: S1 freigeben mit `OLY_LONG_RUN_SAVE_ID=<id> OLY_LONG_RUN_STOP_AFTER=season_end OLY_LONG_RUN_FINAL_SEASON=1`");
  } else {
    lines.push("- Nächste Saison: `OLY_LONG_RUN_FINAL_SEASON` erhöhen und mit gleicher Save-ID resumen.");
  }

  return lines.join("\n");
}

export function printPhaseFeedbackDe(input: {
  save: PersistedSaveGame;
  phase: LongRunPhaseAuditPhase;
  audit: PhaseAuditResult;
  picksRun?: AiPicksRunResult | null;
}) {
  console.error(formatPhaseAuditSummaryDe(input.audit));
  console.error(buildPhaseFeedbackMarkdownDe(input));
}
