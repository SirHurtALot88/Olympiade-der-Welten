import fs from "node:fs";
import path from "node:path";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets, getTeamPlayerMax } from "@/lib/foundation/roster-limits";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const OUTPUT_DIR = process.env.OLY_ROSTER_MAX_AUDIT_DIR ?? path.join("outputs", "roster-max-14");

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = Array.isArray(value) ? value.join(" | ") : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(fileName: string, rows: Array<Record<string, unknown>>) {
  ensureOutputDir();
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const content = [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), `${content}\n`, "utf8");
}

function writeMarkdown(fileName: string, lines: string[]) {
  ensureOutputDir();
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), `${lines.join("\n")}\n`, "utf8");
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function groupRostersByTeam(rosters: RosterEntry[]) {
  const map = new Map<string, RosterEntry[]>();
  for (const roster of rosters) {
    const bucket = map.get(roster.teamId) ?? [];
    bucket.push(roster);
    map.set(roster.teamId, bucket);
  }
  return map;
}

function getFatigue(player: Player | undefined) {
  return typeof player?.fatigue === "number" && Number.isFinite(player.fatigue) ? player.fatigue : 0;
}

function deriveDepthStrategy(input: {
  gameState: GameState;
  team: Team;
  rosterCount: number;
  playerOpt: number;
  playerMax: number;
  avgFatigue: number;
  highFatigueCount: number;
  injuryRiskCount: number;
}) {
  const profile = getTeamStrategyProfile(input.gameState, input.team.teamId);
  const cashHigh = input.team.cash >= 220 || (input.team.budget > 0 && input.team.cash >= input.team.budget * 1.15);
  const cashLow = input.team.cash < 60 || (input.team.budget > 0 && input.team.cash < input.team.budget * 0.35);
  const fatiguePressure = input.highFatigueCount >= 2 || input.avgFatigue >= 55 || input.injuryRiskCount >= 2;
  const starOrRisk =
    profile?.prefersStars === "high" ||
    profile?.riskToleranceLevel === "low" ||
    (profile?.bias.starPriority ?? 0) >= 8 ||
    (profile?.bias.riskTolerance ?? 0) <= 3;
  if (cashLow && input.rosterCount >= input.playerOpt - 1) return "eco_lean";
  if (fatiguePressure && input.playerMax >= 13) return "injury_cover";
  if (cashHigh && starOrRisk && input.playerMax >= 13) return "star_protection";
  if (cashHigh && input.playerMax >= 13) return "deep_rotation";
  if (input.rosterCount < input.playerOpt) return "normal_rotation";
  return "lean_core";
}

function deriveRotationPolicy(strategy: string, team: Team) {
  if (strategy === "star_protection") return "protect_stars";
  if (strategy === "injury_cover") return "preserve_for_key_disciplines";
  if (strategy === "deep_rotation") return "balanced_rotation";
  if (strategy === "eco_lean") return "develop_depth";
  if (team.shortCode === "Z-H") return "high_risk_push";
  return "best_score_now";
}

function main() {
  const persistence = createPersistenceService();
  const save = persistence.getActiveSave();
  if (!save) throw new Error("active_save_missing");
  const gameState = save.gameState;
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const identityByTeamId = new Map(gameState.teamIdentities.map((identity) => [identity.teamId, identity] as const));
  const rostersByTeam = groupRostersByTeam(gameState.rosters);

  const rosterRows = gameState.teams.map((team) => {
    const identity = identityByTeamId.get(team.teamId);
    const targets = deriveRosterTargets(team, identity);
    const roster = rostersByTeam.get(team.teamId) ?? [];
    const rosterPlayers = roster.map((entry) => playerById.get(entry.playerId)).filter(Boolean) as Player[];
    const fatigueValues = rosterPlayers.map(getFatigue);
    const avgFatigue = fatigueValues.length ? round(fatigueValues.reduce((sum, value) => sum + value, 0) / fatigueValues.length) : 0;
    const highFatigueCount = fatigueValues.filter((value) => value >= 70).length;
    const veryHighFatigueCount = fatigueValues.filter((value) => value >= 85).length;
    const injuryRiskCount = fatigueValues.filter((value) => value >= 70).length;
    const depthStrategy = deriveDepthStrategy({
      gameState,
      team,
      rosterCount: roster.length,
      playerOpt: targets.playerOpt,
      playerMax: targets.playerMax,
      avgFatigue,
      highFatigueCount,
      injuryRiskCount,
    });
    const rotationPolicy = deriveRotationPolicy(depthStrategy, team);
    const underOpt = roster.length < targets.playerOpt;
    const over12Legal = roster.length > 12 && roster.length <= targets.playerMax;
    const overMax = roster.length > targets.playerMax;
    const underOptReason = !underOpt
      ? "at_or_above_opt"
      : team.cash < 40
        ? "cash_low"
        : depthStrategy === "eco_lean"
          ? "eco_lean"
          : "needs_buy_or_topup";
    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      rosterCount: roster.length,
      playerMin: targets.playerMin,
      playerOpt: targets.playerOpt,
      playerMax: targets.playerMax,
      cash: round(team.cash),
      avgFatigue,
      highFatigueCount,
      veryHighFatigueCount,
      injuryRiskCount,
      rosterDepthStrategy: depthStrategy,
      rotationPolicy,
      over12Legal,
      overMax,
      underOpt,
      underOptReason,
    };
  });

  writeCsv("roster-depth-strategy.csv", rosterRows);
  writeCsv("rotation-policy-by-team.csv", rosterRows.map((row) => ({
    teamId: row.teamId,
    teamCode: row.teamCode,
    teamName: row.teamName,
    rosterDepthStrategy: row.rosterDepthStrategy,
    rotationPolicy: row.rotationPolicy,
    avgFatigue: row.avgFatigue,
    highFatigueCount: row.highFatigueCount,
  })));
  writeCsv("teams-over-12-audit.csv", rosterRows.filter((row) => row.rosterCount > 12));
  writeCsv("teams-under-opt-with-reason.csv", rosterRows.filter((row) => row.underOpt));
  writeCsv("ai-depth-buy-reasons.csv", rosterRows.map((row) => ({
    teamId: row.teamId,
    teamCode: row.teamCode,
    canConsider13Or14: row.playerMax >= 13 && row.rosterCount >= row.playerOpt && !row.overMax,
    reason:
      row.rosterDepthStrategy === "deep_rotation" || row.rosterDepthStrategy === "star_protection" || row.rosterDepthStrategy === "injury_cover"
        ? row.rosterDepthStrategy
        : "no_extra_depth_reason",
    rosterCount: row.rosterCount,
    playerOpt: row.playerOpt,
    playerMax: row.playerMax,
    cash: row.cash,
  })));
  writeCsv("fatigue-aware-lineup-audit.csv", rosterRows.map((row) => ({
    teamId: row.teamId,
    teamCode: row.teamCode,
    avgFatigue: row.avgFatigue,
    highFatigueCount: row.highFatigueCount,
    veryHighFatigueCount: row.veryHighFatigueCount,
    recommendation:
      row.veryHighFatigueCount > 0
        ? "avoid_85_plus_if_alternative"
        : row.highFatigueCount > 0
          ? "rotation_check"
          : "normal",
  })));
  writeCsv("star-protection-audit.csv", rosterRows.map((row) => ({
    teamId: row.teamId,
    teamCode: row.teamCode,
    rotationPolicy: row.rotationPolicy,
    starProtectionRecommended: row.rotationPolicy === "protect_stars" || row.veryHighFatigueCount > 0,
    reason: row.rotationPolicy === "protect_stars" ? "strategy" : row.veryHighFatigueCount > 0 ? "fatigue_85_plus" : "none",
  })));
  writeCsv("future-discipline-reservation.csv", rosterRows.map((row) => ({
    teamId: row.teamId,
    teamCode: row.teamCode,
    futureDisciplineAwareness: "not_evaluated_in_static_roster_audit",
    recommendedNextStep: "lineup_ai_context_should_emit_per_player_reservations",
  })));
  writeCsv("roster-max-14-paths.csv", [
    { path: "lib/foundation/roster-limits.ts", role: "central DEFAULT_ROSTER_MAX and target derivation" },
    { path: "lib/market/transfermarkt-local-service.ts", role: "official local buy path blocks over playerMax" },
    { path: "lib/ai/chunked-redraft-topup-service.ts", role: "redraft target/playerMax uses central limits" },
    { path: "lib/ai/ai-market-plan-apply-service.ts", role: "AI market preflight uses central targets" },
    { path: "lib/data/dataAdapter.ts", role: "fresh Season 1 saves hydrate team max up to 14" },
    { path: "lib/persistence/save-repository.ts", role: "legacy save normalization caps at central max" },
  ]);

  writeMarkdown("roster-max-14-audit.md", [
    "# Roster Max 14 Audit",
    "",
    `- Save: ${save.saveId} (${save.name})`,
    `- Teams: ${gameState.teams.length}`,
    `- DEFAULT_ROSTER_MAX: ${getTeamPlayerMax({ rosterLimit: 14 })}`,
    `- Teams mit legal >12: ${rosterRows.filter((row) => row.over12Legal).length}`,
    `- Teams ueber Max: ${rosterRows.filter((row) => row.overMax).length}`,
    `- Teams unter Opt: ${rosterRows.filter((row) => row.underOpt).length}`,
    "",
    "## Hinweise",
    "- playerMax ist harte Grenze.",
    "- playerOpt bleibt teamabhaengig und wird nicht automatisch 14.",
    "- 13/14 werden als Rotation/Luxus/Protection berichtet, nicht als Standardpflicht.",
    "- Future-Discipline-Reservation ist in diesem statischen Export nur als Folgepunkt markiert.",
  ]);

  console.log(JSON.stringify({ outputDir: path.resolve(OUTPUT_DIR), rows: rosterRows.length }, null, 2));
}

main();
