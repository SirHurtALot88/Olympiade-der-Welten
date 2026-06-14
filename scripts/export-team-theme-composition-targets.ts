import fs from "node:fs";
import path from "node:path";

import {
  calculateThemeCompositionScore,
  buildPlayerThemeTagRows,
  getTeamThemeCompositionTarget,
  listTeamThemeCompositionTargets,
} from "@/lib/ai/team-theme-composition-service";
import { buildIdentityGuardAudit } from "@/lib/ai/ai-manager-doctrine-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function csvEscape(value: unknown) {
  const text = Array.isArray(value) ? value.join("|") : value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(outputDir: string, fileName: string, rows: Array<Record<string, unknown>>) {
  fs.mkdirSync(outputDir, { recursive: true });
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  fs.writeFileSync(
    path.join(outputDir, fileName),
    `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`,
    "utf8",
  );
}

function writeJson(outputDir: string, fileName: string, payload: unknown) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, fileName), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeMarkdown(outputDir: string, fileName: string, lines: string[]) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, fileName), `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const outputDir = path.join(process.cwd(), "outputs", "team-theme-composition");
  const persistence = createPersistenceService();
  const save = persistence.getActiveSave();
  if (!save) {
    throw new Error("Kein aktiver lokaler Save gefunden. Theme Composition Audit benoetigt einen vollstaendigen GameState.");
  }
  const gameState = save.gameState;
  const playerTags = buildPlayerThemeTagRows(gameState.players);
  const targets = listTeamThemeCompositionTargets();
  const tagByPlayerId = new Map(playerTags.map((row) => [row.playerId, new Set(row.playerThemeTags)]));
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  const rosteredPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team]));
  const themePickAudit = gameState.rosters.flatMap((entry) => {
    const team = teamById.get(entry.teamId);
    const player = playerById.get(entry.playerId);
    if (!team || !player || !getTeamThemeCompositionTarget(team)) return [];
    const score = calculateThemeCompositionScore({
      gameState,
      team,
      player,
      candidateQuality: player.ovr ?? player.rating ?? 0,
      candidateRoleFit: 0,
    });
    return [
      {
        teamId: team.teamId,
        teamCode: team.shortCode,
        teamName: team.name,
        playerId: player.id,
        playerName: player.name,
        race: player.race,
        className: player.className,
        marketValue: player.displayMarketValue ?? player.marketValue ?? 0,
        rating: player.ovr ?? player.rating ?? 0,
        themeCompositionScore: score.themeCompositionScore,
        themeTier: score.themeTier,
        exceptionAllowed: score.exceptionAllowed,
        themeTags: score.playerThemeTags,
        reason: score.reason,
      },
    ];
  });
  const themeExceptionAudit = themePickAudit
    .filter((row) => ["outsider_exception", "outsider", "avoid"].includes(String(row.themeTier)))
    .map((row) => ({
      ...row,
      severity: row.themeTier === "avoid" || row.themeTier === "outsider" ? "red" : "yellow",
      requiredFollowup: row.themeTier === "outsider_exception" ? "document_quality_exception" : "review_identity_guard",
    }));
  const identityGuardAudit = buildIdentityGuardAudit(gameState).map((row) => ({
    ...row,
    hardFails: row.hardFails.join("|"),
  })) as unknown as Array<Record<string, unknown>>;
  const audit = targets.map((target) => {
    const team = teamById.get(target.teamId);
    const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === target.teamId);
    const rosterPlayers = rosterEntries.flatMap((entry) => {
      const player = playerById.get(entry.playerId);
      return player ? [player] : [];
    });
    const primaryThemeCount = rosterPlayers.filter((player) =>
      target.primaryThemeTags.some((tag) => tagByPlayerId.get(player.id)?.has(tag)),
    ).length;
    const secondaryThemeCount = rosterPlayers.filter((player) =>
      target.secondaryThemeTags.some((tag) => tagByPlayerId.get(player.id)?.has(tag)),
    ).length;
    const combinedThemeCount = rosterPlayers.filter((player) =>
      [...target.primaryThemeTags, ...target.secondaryThemeTags, ...target.softPreferredTags].some((tag) => tagByPlayerId.get(player.id)?.has(tag)),
    ).length;
    const rosterCount = rosterPlayers.length;
    const primaryThemeShare = rosterCount > 0 ? primaryThemeCount / rosterCount : 0;
    const combinedThemeShare = rosterCount > 0 ? combinedThemeCount / rosterCount : 0;
    const status =
      primaryThemeShare >= target.targetShare
        ? "green_above_target"
        : primaryThemeShare >= target.minimumShare
          ? "yellow_above_minimum"
          : combinedThemeShare >= target.minimumShare
            ? "accepted_exception"
            : "red_below_minimum";
    const outsiderReasons = rosterPlayers
      .filter((player) => ![...target.primaryThemeTags, ...target.secondaryThemeTags, ...target.softPreferredTags, ...target.allowedOutsiderTags].some((tag) => tagByPlayerId.get(player.id)?.has(tag)))
      .map((player) => `${player.name}:no_theme_match`);
    return {
      teamId: target.teamId,
      teamName: team?.name ?? target.teamId,
      rosterCount,
      primaryThemeCount,
      primaryThemeShare: Number(primaryThemeShare.toFixed(3)),
      secondaryThemeCount,
      combinedThemeShare: Number(combinedThemeShare.toFixed(3)),
      targetShare: target.targetShare,
      minimumShare: target.minimumShare,
      status,
      outsiderCount: outsiderReasons.length,
      outsiderReasons: outsiderReasons.join("|"),
      bestThemePick: rosterPlayers.find((player) => target.primaryThemeTags.some((tag) => tagByPlayerId.get(player.id)?.has(tag)))?.name ?? "",
      worstThemeMiss: outsiderReasons[0] ?? "",
      missedThematicCandidates: gameState.players
        .filter((player) => !rosteredPlayerIds.has(player.id))
        .filter((player) => [...target.primaryThemeTags, ...target.secondaryThemeTags].some((tag) => tagByPlayerId.get(player.id)?.has(tag)))
        .slice(0, 5)
        .map((player) => player.name)
        .join("|"),
    };
  });

  writeCsv(outputDir, "player-theme-tags.csv", playerTags as unknown as Array<Record<string, unknown>>);
  writeJson(outputDir, "player-theme-tags.json", playerTags);
  writeCsv(outputDir, "team-theme-targets.csv", targets as unknown as Array<Record<string, unknown>>);
  writeJson(outputDir, "team-theme-targets.json", targets);
  writeCsv(outputDir, "team-theme-composition-targets.csv", targets as unknown as Array<Record<string, unknown>>);
  writeJson(outputDir, "team-theme-composition-targets.json", targets);
  writeCsv(outputDir, "team-theme-composition-audit.csv", audit as unknown as Array<Record<string, unknown>>);
  writeJson(outputDir, "team-theme-composition-audit.json", audit);
  writeCsv(outputDir, "theme-pick-audit.csv", themePickAudit as unknown as Array<Record<string, unknown>>);
  writeJson(outputDir, "theme-pick-audit.json", themePickAudit);
  writeCsv(outputDir, "theme-exception-audit.csv", themeExceptionAudit as unknown as Array<Record<string, unknown>>);
  writeJson(outputDir, "theme-exception-audit.json", themeExceptionAudit);
  writeCsv(outputDir, "identity-guard-audit.csv", identityGuardAudit);
  writeJson(outputDir, "identity-guard-audit.json", identityGuardAudit);
  writeMarkdown(outputDir, "team-theme-composition-summary.md", [
    "# Team Theme Composition Targets V1",
    "",
    `Source: ${save ? `active local save ${save.saveId}` : "seed snapshot fallback"}`,
    `Teams mit Theme-Target: ${targets.length}`,
    `Spieler mit abgeleiteten Theme-Tags: ${playerTags.filter((row) => row.playerThemeTags.length > 0).length}/${playerTags.length}`,
    `Pick-Audit Rows: ${themePickAudit.length}`,
    `Theme Exceptions: ${themeExceptionAudit.length}`,
    "",
    "## Status",
    ...audit.map(
      (row) =>
        `- ${row.teamId} ${row.teamName}: ${row.status}, primary ${(row.primaryThemeShare * 100).toFixed(1)}%, combined ${(row.combinedThemeShare * 100).toFixed(1)}%`,
    ),
  ]);

  console.log(
    JSON.stringify(
      {
        outputDir,
        source: save ? `active-save:${save.saveId}` : "seed-snapshot",
        playerTagRows: playerTags.length,
        teamTargets: targets.length,
        auditRows: audit.length,
        themePickAuditRows: themePickAudit.length,
        themeExceptionRows: themeExceptionAudit.length,
        identityGuardRows: identityGuardAudit.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
