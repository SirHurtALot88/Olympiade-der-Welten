import fs from "node:fs";
import path from "node:path";

import { DEFAULT_ACTIVE_OWNER_ID, AI_OWNER_ID, buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import type { GameState, TeamControlSettings } from "@/lib/data/olyDataTypes";

const OUTPUT_DIR =
  process.env.OLY_OUTPUT_DIR ??
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";

const CHRIS_OWNER_ID = DEFAULT_ACTIVE_OWNER_ID;
const RAMONA_OWNER_ID = "ramona_local";
const FRANKY_OWNER_ID = "franky_remote_placeholder";
const CHRIS_TEAMS = ["M-M", "V-W"];
const RAMONA_TEAMS = ["P-S", "D-P"];
const LOCAL_HUMAN_TEAMS = [...RAMONA_TEAMS, ...CHRIS_TEAMS];
const FRANKY_TEAMS = ["M-S", "P-C", "C-S", "G-G"];

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function teamLabel(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  return team ? `${team.shortCode} ${team.name}` : teamId;
}

function buildScenarioControlSettings(gameState: GameState) {
  const current = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  const chrisSet = new Set(CHRIS_TEAMS);
  const ramonaSet = new Set(RAMONA_TEAMS);
  const frankySet = new Set(FRANKY_TEAMS);

  return Object.fromEntries(
    gameState.teams.map((team) => {
      const existing = current[team.teamId];
      const isChris = chrisSet.has(team.teamId);
      const isRamona = ramonaSet.has(team.teamId);
      const isFranky = frankySet.has(team.teamId);
      const controlMode: TeamControlSettings["controlMode"] = isChris || isRamona || isFranky ? "manual" : "ai";
      const ownerId = isChris ? CHRIS_OWNER_ID : isRamona ? RAMONA_OWNER_ID : isFranky ? FRANKY_OWNER_ID : AI_OWNER_ID;
      const ownerIndex = isChris
        ? CHRIS_TEAMS.indexOf(team.teamId) + 1
        : isRamona
          ? RAMONA_TEAMS.indexOf(team.teamId) + 1
          : isFranky
            ? FRANKY_TEAMS.indexOf(team.teamId) + 1
            : 0;

      return [
        team.teamId,
        {
          ...existing,
          teamId: team.teamId,
          controlMode,
          ownerId,
          ownerSlot: isChris ? `user_${ownerIndex}` : isRamona ? `ramona_${ownerIndex}` : isFranky ? `franky_${ownerIndex}` : "ai",
          displayLabel: isChris
            ? `Chris · ${team.shortCode}`
            : isRamona
              ? `Ramona · ${team.shortCode}`
              : isFranky
                ? `Franky · ${team.shortCode}`
                : `AI · ${team.shortCode}`,
          aiLineupPreviewEnabled: controlMode === "ai",
          aiLineupApplyEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: controlMode === "ai",
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: controlMode === "ai",
          aiSellAutoApplyEnabled: false,
          notes: isChris
            ? "manager_scenario_chris_team"
            : isRamona
              ? "manager_scenario_ramona_local_human_team"
              : isFranky
                ? "manager_scenario_franky_remote_human_team"
                : "manager_scenario_ai_team",
        } satisfies TeamControlSettings,
      ];
    }),
  );
}

function writeSummary(summary: Record<string, unknown>) {
  ensureOutputDir();
  const jsonPath = path.join(OUTPUT_DIR, "manager-scenario-testsave-v1.json");
  const markdownPath = path.join(OUTPUT_DIR, "manager-scenario-testsave-v1.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    markdownPath,
    [
      "# Manager Scenario Testsave V1",
      "",
      `- Save: ${summary.saveName} (${summary.saveId})`,
      `- Source Save: ${summary.sourceSaveName} (${summary.sourceSaveId})`,
      `- Scenario: ${summary.scenarioType}`,
      `- Active Season: ${summary.activeSeasonId}`,
      `- Active Matchday: ${summary.activeMatchday}`,
      `- Chris Teams: ${(summary.chrisTeams as string[]).join(", ")}`,
      `- Ramona Teams: ${(summary.ramonaTeams as string[]).join(", ")}`,
      `- Franky Teams: ${(summary.frankyTeams as string[]).join(", ")}`,
      `- AI Teams: ${summary.aiTeamCount}`,
      `- Manual Teams: ${summary.manualTeamCount}`,
      `- Active Manager Team Target: ${summary.activeManagerTeamTarget}`,
      "",
      "## Guardrails",
      "",
      "- Chris-Teams sind User/local.",
      "- Ramona-Teams sind Human/local_friend und bleiben lokal spielbar.",
      "- Franky-Teams sind Human/remote, aber nicht Chris/User.",
      "- AI-Auto-Flags sind nur fuer AI-Teams aktiv.",
      "- Human-Teams werden von AI-Auto-Flows nicht automatisch veraendert.",
      "- Multiplayer-Room-Preset 4+4+AI passt zur Save-Verteilung.",
      "",
    ].join("\n"),
    "utf8",
  );
  return { jsonPath, markdownPath };
}

function main() {
  const persistence = createPersistenceService();
  const source = persistence.bootstrapSingleplayerSave().save;
  const clone = persistence.cloneSave(source.saveId, `Manager Scenario 4+4+AI ${new Date().toLocaleString("de-DE")}`);
  const controlSettings = buildScenarioControlSettings(clone.gameState);
  const gameState = withScenarioMeta(
    {
      ...clone.gameState,
      teams: clone.gameState.teams.map((team) => ({
        ...team,
        humanControlled: LOCAL_HUMAN_TEAMS.includes(team.teamId) || FRANKY_TEAMS.includes(team.teamId),
      })),
      seasonState: {
        ...clone.gameState.seasonState,
        teamControlSettings: controlSettings,
      },
    },
    {
      scenarioType: "manager_multiplayer_test",
      label: "Manager Scenario 4+4+AI",
      description: "Dedizierter Testsave fuer Home Screen, Team-first Views, Flow-Controller und Multiplayer-Ownership mit Chris/Franky/AI.",
      sourceSaveId: source.saveId,
      isStableTestPoint: true,
      allowTestWrites: true,
      containsSeasonHistory: clone.gameState.scenarioMeta?.containsSeasonHistory ?? true,
      containsFinalStandings: clone.gameState.scenarioMeta?.containsFinalStandings ?? false,
    },
  );
  const saved = persistence.saveSingleplayerState(clone.saveId, gameState);
  persistence.activateSave(saved.saveId);

  const activeSettings = buildTeamControlSettingsMap(saved.gameState.teams, saved.gameState.seasonState.teamControlSettings);
  const manualTeamIds = saved.gameState.teams.filter((team) => activeSettings[team.teamId]?.controlMode === "manual").map((team) => team.teamId);
  const aiTeamIds = saved.gameState.teams.filter((team) => activeSettings[team.teamId]?.controlMode === "ai").map((team) => team.teamId);
  const frankyTeamIds = saved.gameState.teams
    .filter((team) => activeSettings[team.teamId]?.ownerId === FRANKY_OWNER_ID)
    .map((team) => team.teamId);
  const ramonaTeamIds = saved.gameState.teams
    .filter((team) => activeSettings[team.teamId]?.ownerId === RAMONA_OWNER_ID)
    .map((team) => team.teamId);
  const chrisTeamIds = saved.gameState.teams
    .filter((team) => activeSettings[team.teamId]?.ownerId === CHRIS_OWNER_ID)
    .map((team) => team.teamId);

  const summary = {
    saveId: saved.saveId,
    saveName: saved.name,
    sourceSaveId: source.saveId,
    sourceSaveName: source.name,
    scenarioType: saved.gameState.scenarioMeta?.scenarioType,
    activeSeasonId: saved.gameState.season.id,
    activeMatchday: saved.gameState.season.currentMatchday,
    activeManagerTeamTarget: CHRIS_TEAMS[0],
    chrisTeams: chrisTeamIds.map((teamId) => teamLabel(saved.gameState, teamId)),
    ramonaTeams: ramonaTeamIds.map((teamId) => teamLabel(saved.gameState, teamId)),
    frankyTeams: frankyTeamIds.map((teamId) => teamLabel(saved.gameState, teamId)),
    aiTeamCount: aiTeamIds.length,
    manualTeamCount: manualTeamIds.length,
    aiTeams: aiTeamIds,
    controlAudit: saved.gameState.teams.map((team) => ({
      teamId: team.teamId,
      teamName: team.name,
      controlMode: activeSettings[team.teamId]?.controlMode,
      ownerId: activeSettings[team.teamId]?.ownerId,
      aiTransferPreviewEnabled: activeSettings[team.teamId]?.aiTransferPreviewEnabled,
      aiSellPreviewEnabled: activeSettings[team.teamId]?.aiSellPreviewEnabled,
      aiLineupPreviewEnabled: activeSettings[team.teamId]?.aiLineupPreviewEnabled,
    })),
  };
  const paths = writeSummary(summary);
  console.log(JSON.stringify({ ...summary, ...paths }, null, 2));
}

main();
