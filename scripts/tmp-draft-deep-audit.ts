import { writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { buildAiNeedsPicksCompare } from "@/lib/ai/ai-needs-picks-compare-service";
import { resolveTeamRosterMarketValue } from "@/lib/ai/planner-cash-buffer-policy";
import type { GameState } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets, deriveSeason1TargetRosterSize } from "@/lib/foundation/roster-limits";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function getPlayerById(gameState: GameState, playerId: string) {
  return gameState.players.find((player) => player.id === playerId) ?? null;
}

function normalizeClass(name: string | null | undefined) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));
  const saveId = process.argv[2] ?? "fresh-season-1-1783314253878";
  const outputDir =
    process.argv[3] ?? path.join(__dirname, "..", "outputs", "s1-draft-audit-2026-07-06T05-04-13");

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save missing: ${saveId}`);

  const gs = save.gameState;
  const seasonId = gs.season.id;

  const leagueRows = gs.teams.map((team) => {
    const identity = gs.teamIdentities.find((entry) => entry.teamId === team.teamId);
    const { playerMin, playerOpt, playerMax } = deriveRosterTargets(team, identity);
    const targetDraft = deriveSeason1TargetRosterSize(playerOpt, playerMax);
    const roster = gs.rosters.filter((entry) => entry.teamId === team.teamId);
    const mw = Math.round(resolveTeamRosterMarketValue(gs, team.teamId));
    const gm = getTeamGeneralManager(gs, team.teamId);
    const buys = gs.transferHistory.filter(
      (entry) => entry.transferType === "buy" && entry.seasonId === seasonId && entry.toTeamId === team.teamId,
    );
    const spent = Math.round(buys.reduce((sum, entry) => sum + (entry.fee ?? entry.marketValue ?? 0), 0));

    const classCounts = new Map<string, number>();
    for (const entry of roster) {
      const player = getPlayerById(gs, entry.playerId);
      const token = normalizeClass(player?.className);
      if (!token) continue;
      classCounts.set(token, (classCounts.get(token) ?? 0) + 1);
    }
    const classBreakdown = [...classCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([className, count]) => ({ className, count }));

    const maxClassCount = classBreakdown[0]?.count ?? 0;
    const topClass = classBreakdown[0]?.className ?? null;
    const classSpamFlag = maxClassCount >= 3;

    return {
      code: team.shortCode ?? team.teamId,
      teamId: team.teamId,
      roster: roster.length,
      playerMin,
      playerOpt,
      playerMax,
      targetDraft,
      gapToOpt: Math.max(playerOpt - roster.length, 0),
      cash: round(team.cash ?? 0, 0),
      mw,
      spent,
      buys: buys.length,
      gmId: gm?.profile.gmId ?? null,
      gmName: gm?.profile.name ?? null,
      gmFinances: gm?.profile.finances ?? null,
      classSpamFlag,
      topClass,
      maxClassCount,
      classBreakdown,
    };
  });

  leagueRows.sort((left, right) => left.code.localeCompare(right.code));

  const classSpamTeams = leagueRows
    .filter((row) => row.classSpamFlag)
    .sort((left, right) => right.maxClassCount - left.maxClassCount || left.code.localeCompare(right.code));

  const tt = leagueRows.find((row) => row.code === "T-T");
  const ttBuys = gs.transferHistory
    .filter((entry) => entry.transferType === "buy" && entry.seasonId === seasonId && entry.toTeamId === tt?.teamId)
    .sort((left, right) => left.happenedAt.localeCompare(right.happenedAt))
    .map((entry, index) => {
      const player = getPlayerById(gs, entry.playerId);
      return {
        step: index + 1,
        playerId: entry.playerId,
        name: player?.name ?? entry.playerName ?? "?",
        className: player?.className ?? "?",
        price: round(entry.fee ?? entry.marketValue ?? 0, 1),
        mw: round(entry.marketValue ?? 0, 1),
        salary: round(entry.salary ?? 0, 1),
        contract: entry.remainingContractLength,
      };
    });

  // Dry replan on fresh save for T-T planner diagnostics (same engine, pre-roster state).
  const fresh = persistence.createFreshSeasonOneSave({ name: `T-T planner diag ${Date.now()}` });
  const freshTeam = fresh.gameState.teams.find((team) => team.shortCode === "T-T") ?? null;
  let ttPlanner: Record<string, unknown> | null = null;
  if (freshTeam) {
      const compare = await buildAiNeedsPicksCompare({
        saveId: fresh.saveId,
        seasonId: fresh.gameState.season.id,
        teamId: freshTeam.teamId,
        steps: 10,
        runMode: "season1_optimum_execute",
        draftSeed: `planner-diag:${fresh.saveId}`,
        candidateScopeMode: "budget_wide",
      });
      const entry = compare.teams.find((team) => team.teamId === freshTeam.teamId) ?? null;
      if (entry) {
        ttPlanner = {
          note: "Dry replan auf frischem Save (gleiche Engine/Steps=10, anderer Seed/Pool-Zustand)",
          stepsRequested: 10,
          plannedPickCount: entry.plannedPicks.length,
          warnings: entry.warnings.slice(0, 15),
          cashStrategy: entry.cashStrategy,
          plannedPicks: entry.plannedPicks.map((pick, index) => ({
            step: index + 1,
            playerName: pick.playerName,
            className: pick.className,
            lane: pick.pickLane,
            price: pick.price,
            finalScore: pick.finalScore,
            focusTeamStatus: pick.focusTeamStatus,
            classSpamPenalty: pick.scoreBreakdown?.classSpamPenalty,
            offThemePenalty: pick.scoreBreakdown?.offThemePenalty,
            reasons: pick.reasons?.slice(0, 3),
          })),
        };
      }
  }

  const md = [
    "# Draft Deep Audit",
    "",
    `- Save: \`${saveId}\``,
    "",
    "## Liga: Cash · MW · Kader (alle Teams)",
    "",
    "| Team | Kader | Opt | Gap | Cash | MW | Spent | Buys | GM | Top-Klasse (×) |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---|---:|",
    ...leagueRows.map(
      (row) =>
        `| ${row.code} | ${row.roster} | ${row.playerOpt} | ${row.gapToOpt} | ${row.cash} | ${row.mw} | ${row.spent} | ${row.buys} | ${row.gmName ?? "—"} | ${row.topClass ?? "—"} ×${row.maxClassCount} |`,
    ),
    "",
    `**Σ** Kader ${leagueRows.reduce((s, r) => s + r.roster, 0)} · Cash ${leagueRows.reduce((s, r) => s + r.cash, 0)} · MW ${leagueRows.reduce((s, r) => s + r.mw, 0)}`,
    "",
    "## Class-Spam (≥3 gleiche Klasse im Kader)",
    "",
    classSpamTeams.length === 0
      ? "_Keine Teams mit ≥3 gleicher Klasse._"
      : [
          "| Team | Max | Verteilung | GM |",
          "|---|---:|---|---|",
          ...classSpamTeams.map(
            (row) =>
              `| ${row.code} | ${row.maxClassCount}× ${row.topClass} | ${row.classBreakdown.map((entry) => `${entry.className}:${entry.count}`).join(", ")} | ${row.gmName ?? "—"} |`,
          ),
        ].join("\n"),
    "",
    "## T-T Detail",
    "",
    tt
      ? `- GM: **${tt.gmName ?? "?"}** (\`${tt.gmId ?? "?"}\`, finances=${tt.gmFinances ?? "?"})`
      : "",
    tt
      ? `- Ziel: Opt **${tt.playerOpt}**, Draft-Target **${tt.targetDraft}**, Max **${tt.playerMax}** · Steps-Cap im Audit: **10**`
      : "",
    tt
      ? `- Ergebnis: **${tt.roster}** Spieler, **${tt.buys}** Buys, **${tt.spent}M** spent, **${tt.cash}M** Cash übrig`
      : "",
    "",
    "### T-T Draft-Picks (chronologisch)",
    "",
    "| # | Spieler | Klasse | Preis | MW |",
    "|---:|---|---|---:|---:|",
    ...ttBuys.map((pick) => `| ${pick.step} | ${pick.name} | ${pick.className} | ${pick.price} | ${pick.mw} |`),
    "",
    ttPlanner
      ? [
          "### T-T Planner (Dry Replan, frischer Save)",
          "",
          `- Geplante Picks: **${ttPlanner.plannedPickCount}** / Steps **${ttPlanner.stepsRequested}**`,
          `- Warnings: ${(ttPlanner.warnings as string[]).join(" · ") || "keine"}`,
          "",
        ].join("\n")
      : "",
  ].join("\n");

  const payload = { leagueRows, classSpamTeams, tt, ttBuys, ttPlanner };
  await writeFile(path.join(outputDir, "draft-deep-audit.json"), JSON.stringify(payload, null, 2));
  await writeFile(path.join(outputDir, "draft-deep-audit.md"), md);
  console.log(md);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
