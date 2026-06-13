import fs from "node:fs";
import path from "node:path";

import {
  BASE_MATCHDAY_RECOVERY,
  FATIGUE_INJURY_SOURCE,
  MATCHDAY_FATIGUE_LOAD,
  calculateTeamRecovery,
  getInjuryRiskBand,
  getPlayerAvailabilityView,
  injuryRiskBands,
  rollInjuryRisk,
} from "@/lib/fatigue/fatigue-injury-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { assertOlyProjectRoot } from "@/lib/persistence/project-root-guard";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";

const OUTPUT_DIR =
  process.env.OLY_OUTPUT_DIR ??
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";

type ScenarioId = "current_max" | "max_14_preview" | "max_15_preview";

type RotationPlayer = {
  playerId: string;
  playerName: string;
  teamId: string;
  fatigue: number;
  injuryStatus: "healthy" | "injured" | "recovering";
  injuredUntilMatchdayIndex: number | null;
  isVirtualRotationSlot: boolean;
};

type PlayerAuditRow = {
  scenarioId: ScenarioId;
  matchdayIndex: number;
  matchdayId: string;
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
  fatigueBeforeMatchday: number;
  fatigueAfterMatchday: number;
  injuryRiskBand: string;
  injuryRiskPercent: number;
  injuryRoll: number | null;
  injuryEvent: boolean;
  normalRecovery: number;
  injuryRecovery: number;
  lineupBlocker: string | null;
  teamRosterSize: number;
  availablePlayers: number;
  blockedPlayers: number;
  source: string;
};

type ScenarioTeamMatchdayRow = {
  scenarioId: ScenarioId;
  maxRoster: number;
  matchdayIndex: number;
  matchdayId: string;
  d1: string;
  d2: string;
  requiredSlots: number;
  teamId: string;
  teamName: string;
  currentRosterSize: number;
  modeledRosterSize: number;
  rosterBucket: string;
  availablePlayers: number;
  blockedPlayers: number;
  lineupPressure: boolean;
  injuriesThisMatchday: number;
  playersFatigue70Plus: number;
  playersFatigue85Plus: number;
  averageFatigueAfter: number;
};

type ScenarioSummary = {
  scenarioId: ScenarioId;
  maxRoster: number;
  teams: number;
  avgFatigueAfterMd3: number | null;
  avgFatigueAfterMd5: number | null;
  avgFatigueAfterMd10: number | null;
  playersFatigue70PlusAfterMd10: number;
  playersFatigue85PlusAfterMd10: number;
  injuriesTotal: number;
  injuriesPerMatchday: number;
  teamsWithTwoPlusInjuredPeak: number;
  teamsWithLineupPressure: number;
  aiTeamsWithEnoughRotationPlayers: number;
  warnings: string[];
};

function escapeCsv(value: string | number | boolean | null | undefined) {
  const text = value == null ? "—" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function writeCsv(filePath: string, header: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  fs.writeFileSync(filePath, [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n") + "\n");
}

function clampFatigue(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function average(values: number[]) {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 2) : null;
}

function rosterBucket(size: number) {
  if (size <= 8) return "7-8";
  if (size <= 10) return "9-10";
  if (size <= 12) return "11-12";
  if (size <= 14) return "13-14_preview";
  return "15_preview";
}

function getScenarioMaxRoster(scenarioId: ScenarioId) {
  if (scenarioId === "max_14_preview") return 14;
  if (scenarioId === "max_15_preview") return 15;
  return 12;
}

function scenarioLabel(scenarioId: ScenarioId) {
  if (scenarioId === "max_14_preview") return "Max-Roster 14 Preview";
  if (scenarioId === "max_15_preview") return "Max-Roster 15 Preview";
  return "aktuelles Max-Roster";
}

function createModeledRoster(input: {
  scenarioId: ScenarioId;
  teamId: string;
  currentRoster: Array<{ playerId: string; playerName: string; fatigue: number; injuryStatus: "healthy" | "injured" | "recovering"; injuredUntilMatchdayIndex: number | null }>;
}) {
  const maxRoster = getScenarioMaxRoster(input.scenarioId);
  const modeledSize = input.scenarioId === "current_max" ? input.currentRoster.length : Math.max(input.currentRoster.length, maxRoster);
  const realPlayers: RotationPlayer[] = input.currentRoster.map((player) => ({
    ...player,
    teamId: input.teamId,
    isVirtualRotationSlot: false,
  }));
  const virtualPlayers: RotationPlayer[] = Array.from(
    { length: Math.max(0, modeledSize - realPlayers.length) },
    (_, index) => ({
      playerId: `virtual-rotation-${input.scenarioId}-${input.teamId}-${index + 1}`,
      playerName: `Virtueller Rotationsslot ${index + 1}`,
      teamId: input.teamId,
      fatigue: 0,
      injuryStatus: "healthy",
      injuredUntilMatchdayIndex: null,
      isVirtualRotationSlot: true,
    }),
  );
  return [...realPlayers, ...virtualPlayers];
}

function applyStartOfMatchdayRecovery(players: RotationPlayer[], matchdayIndex: number, normalRecovery: number, injuryRecovery: number) {
  for (const player of players) {
    const isBlocked = player.injuryStatus === "injured" && (player.injuredUntilMatchdayIndex ?? -1) >= matchdayIndex;
    if (isBlocked) {
      player.fatigue = clampFatigue(player.fatigue - injuryRecovery);
    }
    if (player.injuryStatus === "injured" && (player.injuredUntilMatchdayIndex ?? -1) < matchdayIndex) {
      player.injuryStatus = "recovering";
      player.injuredUntilMatchdayIndex = null;
    }
  }
}

function selectRotationPlayers(players: RotationPlayer[], requiredSlots: number, matchdayIndex: number) {
  return [...players]
    .filter((player) => !(player.injuryStatus === "injured" && (player.injuredUntilMatchdayIndex ?? -1) >= matchdayIndex))
    .sort((left, right) => {
      if (left.fatigue !== right.fatigue) return left.fatigue - right.fatigue;
      if (left.isVirtualRotationSlot !== right.isVirtualRotationSlot) return left.isVirtualRotationSlot ? 1 : -1;
      return left.playerName.localeCompare(right.playerName, "de");
    })
    .slice(0, Math.max(0, requiredSlots));
}

function main() {
  assertOlyProjectRoot();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const persistence = createPersistenceService();
  const save = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  const gameState = save.gameState;
  const schedule = getSeasonDisciplineSchedule(gameState).slice(0, 10);
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const controlByTeamId = new Map(
    Object.values(gameState.seasonState.teamControlSettings ?? {}).map((settings) => [settings.teamId, settings] as const),
  );
  const activeLineups = gameState.seasonState.lineupDrafts ?? [];
  const activeLineupByTeamMatchday = new Map(
    activeLineups.map((draft) => [`${draft.teamId}:${draft.matchdayId}`, draft] as const),
  );

  const scenarios: ScenarioId[] = ["current_max", "max_14_preview", "max_15_preview"];
  const playerRows: PlayerAuditRow[] = [];
  const teamRows: ScenarioTeamMatchdayRow[] = [];
  const summaries: ScenarioSummary[] = [];

  for (const scenarioId of scenarios) {
    const maxRoster = getScenarioMaxRoster(scenarioId);
    const modeledPlayersByTeam = new Map<string, RotationPlayer[]>();

    for (const team of gameState.teams) {
      const currentRoster = gameState.rosters
        .filter((roster) => roster.teamId === team.teamId)
        .map((roster) => {
          const player = playerById.get(roster.playerId);
          const availability = getPlayerAvailabilityView(
            gameState,
            roster.playerId,
            team.teamId,
            gameState.matchdayState.matchdayId,
          );
          const currentMatchdayIndex = schedule.findIndex((entry) => entry.matchdayId === gameState.matchdayState.matchdayId) + 1;
          const injuredUntilMatchdayIndex =
            availability.injuryUntilMatchday == null
              ? null
              : schedule.findIndex((entry) => entry.matchdayId === availability.injuryUntilMatchday) + 1 || null;
          return {
            playerId: roster.playerId,
            playerName: player?.name ?? roster.playerId,
            fatigue: availability.fatigue,
            injuryStatus:
              availability.isUnavailable || (injuredUntilMatchdayIndex != null && injuredUntilMatchdayIndex >= currentMatchdayIndex)
                ? "injured"
                : availability.injuryStatus === "recovering"
                  ? "recovering"
                  : "healthy",
            injuredUntilMatchdayIndex,
          } satisfies Omit<RotationPlayer, "teamId" | "isVirtualRotationSlot">;
        });
      modeledPlayersByTeam.set(team.teamId, createModeledRoster({ scenarioId, teamId: team.teamId, currentRoster }));
    }

    for (const scheduleEntry of schedule) {
      const matchdayIndex = scheduleEntry.matchdayIndex;
      const requiredSlots = (scheduleEntry.discipline1?.playerCount ?? 0) + (scheduleEntry.discipline2?.playerCount ?? 0);
      for (const team of gameState.teams) {
        const players = modeledPlayersByTeam.get(team.teamId) ?? [];
        const currentRosterSize = gameState.rosters.filter((roster) => roster.teamId === team.teamId).length;
        const recovery = calculateTeamRecovery(gameState, team.teamId);
        applyStartOfMatchdayRecovery(players, matchdayIndex, recovery.normalRecovery, recovery.injuryRecovery);
        const selected = selectRotationPlayers(players, requiredSlots, matchdayIndex);
        const selectedIds = new Set(selected.map((player) => player.playerId));
        const blockedBefore = players.filter(
          (player) => player.injuryStatus === "injured" && (player.injuredUntilMatchdayIndex ?? -1) >= matchdayIndex,
        ).length;
        const availableBefore = Math.max(0, players.length - blockedBefore);
        const hasLineupPressure = availableBefore < requiredSlots;
        let injuriesThisTeamMatchday = 0;

        for (const player of selected) {
          const fatigueBefore = player.fatigue;
          const fatigueAfterLoad = clampFatigue(player.fatigue + MATCHDAY_FATIGUE_LOAD);
          const risk = getInjuryRiskBand(fatigueAfterLoad);
          const roll = rollInjuryRisk({
            saveId: save.saveId,
            seasonId: gameState.season.id,
            matchdayId: scheduleEntry.matchdayId,
            playerId: player.playerId,
            fatigueBefore: fatigueAfterLoad,
          });
          const injured = roll.result === "injured";
          if (injured) {
            injuriesThisTeamMatchday += 1;
          }
          player.fatigue = fatigueAfterLoad;
          player.injuryStatus = injured ? "injured" : player.injuryStatus === "recovering" ? "recovering" : "healthy";
          player.injuredUntilMatchdayIndex = injured ? matchdayIndex + 1 : player.injuredUntilMatchdayIndex;
          playerRows.push({
            scenarioId,
            matchdayIndex,
            matchdayId: scheduleEntry.matchdayId,
            teamId: team.teamId,
            teamName: team.name,
            playerId: player.playerId,
            playerName: player.playerName,
            fatigueBeforeMatchday: fatigueBefore,
            fatigueAfterMatchday: player.fatigue,
            injuryRiskBand: risk.label,
            injuryRiskPercent: risk.riskPercent,
            injuryRoll: roll.roll,
            injuryEvent: injured,
            normalRecovery: recovery.normalRecovery,
            injuryRecovery: recovery.injuryRecovery,
            lineupBlocker: hasLineupPressure ? "lineup_pressure_insufficient_available_players" : null,
            teamRosterSize: players.length,
            availablePlayers: availableBefore,
            blockedPlayers: blockedBefore,
            source: player.isVirtualRotationSlot ? "rotation_cap_preview_virtual_slot" : FATIGUE_INJURY_SOURCE,
          });
        }

        for (const player of players) {
          if (selectedIds.has(player.playerId)) continue;
          playerRows.push({
            scenarioId,
            matchdayIndex,
            matchdayId: scheduleEntry.matchdayId,
            teamId: team.teamId,
            teamName: team.name,
            playerId: player.playerId,
            playerName: player.playerName,
            fatigueBeforeMatchday: player.fatigue,
            fatigueAfterMatchday: player.fatigue,
            injuryRiskBand: getInjuryRiskBand(player.fatigue).label,
            injuryRiskPercent: getInjuryRiskBand(player.fatigue).riskPercent,
            injuryRoll: null,
            injuryEvent: false,
            normalRecovery: recovery.normalRecovery,
            injuryRecovery: recovery.injuryRecovery,
            lineupBlocker:
              player.injuryStatus === "injured" && (player.injuredUntilMatchdayIndex ?? -1) >= matchdayIndex
                ? "player_injured_unavailable"
                : null,
            teamRosterSize: players.length,
            availablePlayers: availableBefore,
            blockedPlayers: blockedBefore,
            source: player.isVirtualRotationSlot ? "rotation_cap_preview_virtual_slot" : "not_selected_recovered_or_resting",
          });
        }

        const fatigueValues = players.map((player) => player.fatigue);
        teamRows.push({
          scenarioId,
          maxRoster,
          matchdayIndex,
          matchdayId: scheduleEntry.matchdayId,
          d1: scheduleEntry.discipline1?.displayName ?? "—",
          d2: scheduleEntry.discipline2?.displayName ?? "—",
          requiredSlots,
          teamId: team.teamId,
          teamName: team.name,
          currentRosterSize,
          modeledRosterSize: players.length,
          rosterBucket: rosterBucket(currentRosterSize),
          availablePlayers: availableBefore,
          blockedPlayers: blockedBefore,
          lineupPressure: hasLineupPressure,
          injuriesThisMatchday: injuriesThisTeamMatchday,
          playersFatigue70Plus: fatigueValues.filter((value) => value >= 70).length,
          playersFatigue85Plus: fatigueValues.filter((value) => value >= 85).length,
          averageFatigueAfter: average(fatigueValues) ?? 0,
        });
      }
    }

    const scenarioRows = teamRows.filter((row) => row.scenarioId === scenarioId);
    const mdRows = (md: number) => scenarioRows.filter((row) => row.matchdayIndex === md);
    const finalRows = mdRows(10).length ? mdRows(10) : scenarioRows.filter((row) => row.matchdayIndex === schedule.length);
    const teamPeakInjuries = new Map<string, number>();
    for (const row of scenarioRows) {
      teamPeakInjuries.set(row.teamId, Math.max(teamPeakInjuries.get(row.teamId) ?? 0, row.blockedPlayers));
    }
    const aiTeamsWithEnoughRotationPlayers = gameState.teams.filter((team) => {
      const controlMode = controlByTeamId.get(team.teamId)?.controlMode ?? (team.humanControlled ? "manual" : "ai");
      if (controlMode !== "ai") return false;
      const rows = scenarioRows.filter((row) => row.teamId === team.teamId);
      return rows.every((row) => row.modeledRosterSize >= row.requiredSlots + 2 && !row.lineupPressure);
    }).length;
    const warnings = [
      ...(activeLineupByTeamMatchday.size === 0 ? ["no_saved_lineups_found_capacity_model_used"] : []),
      ...(scenarioRows.some((row) => row.lineupPressure) ? ["lineup_pressure_detected"] : []),
      ...(scenarioRows.some((row) => row.playersFatigue85Plus > 0) ? ["fatigue_85_plus_detected"] : []),
    ];
    summaries.push({
      scenarioId,
      maxRoster,
      teams: gameState.teams.length,
      avgFatigueAfterMd3: average(mdRows(3).map((row) => row.averageFatigueAfter)),
      avgFatigueAfterMd5: average(mdRows(5).map((row) => row.averageFatigueAfter)),
      avgFatigueAfterMd10: average(mdRows(10).map((row) => row.averageFatigueAfter)),
      playersFatigue70PlusAfterMd10: finalRows.reduce((sum, row) => sum + row.playersFatigue70Plus, 0),
      playersFatigue85PlusAfterMd10: finalRows.reduce((sum, row) => sum + row.playersFatigue85Plus, 0),
      injuriesTotal: scenarioRows.reduce((sum, row) => sum + row.injuriesThisMatchday, 0),
      injuriesPerMatchday: round(scenarioRows.reduce((sum, row) => sum + row.injuriesThisMatchday, 0) / Math.max(schedule.length, 1), 2),
      teamsWithTwoPlusInjuredPeak: Array.from(teamPeakInjuries.values()).filter((count) => count >= 2).length,
      teamsWithLineupPressure: new Set(scenarioRows.filter((row) => row.lineupPressure).map((row) => row.teamId)).size,
      aiTeamsWithEnoughRotationPlayers,
      warnings,
    });
  }

  const current = summaries.find((summary) => summary.scenarioId === "current_max");
  const max14 = summaries.find((summary) => summary.scenarioId === "max_14_preview");
  const max15 = summaries.find((summary) => summary.scenarioId === "max_15_preview");
  const recommendation =
    current && max14 && current.teamsWithLineupPressure > max14.teamsWithLineupPressure
      ? "Roster-Max 14 testen, bevor die 22%-Kurve generft wird."
      : current && current.injuriesPerMatchday > 10
        ? "AI-Rotation verbessern und Recovery leicht erhöhen; 22% erst nach weiterem Live-Lauf senken."
        : "Risiko 22% vorerst behalten; AI-Rotation beobachten.";
  const rosterCapRecommendation =
    max14 && max15 && max15.teamsWithLineupPressure < max14.teamsWithLineupPressure
      ? "Max 15 liefert Zusatzentlastung gegenüber 14."
      : max14 && current && max14.teamsWithLineupPressure < current.teamsWithLineupPressure
        ? "Max 14 wirkt als sinnvoller erster Test."
        : "Max 14/15 aktuell nicht zwingend aus Injury-Druck ableitbar.";

  const mdPath = path.join(OUTPUT_DIR, "injury-balance-audit.md");
  const jsonPath = path.join(OUTPUT_DIR, "injury-balance-audit.json");
  const riskCsvPath = path.join(OUTPUT_DIR, "injury-risk-by-matchday.csv");
  const capCsvPath = path.join(OUTPUT_DIR, "roster-rotation-cap-comparison.csv");
  const pressureCsvPath = path.join(OUTPUT_DIR, "teams-with-lineup-pressure.csv");

  writeCsv(
    riskCsvPath,
    [
      "scenarioId",
      "matchdayIndex",
      "matchdayId",
      "teamId",
      "teamName",
      "playerId",
      "playerName",
      "fatigueBeforeMatchday",
      "fatigueAfterMatchday",
      "injuryRiskBand",
      "injuryRiskPercent",
      "injuryRoll",
      "injuryEvent",
      "normalRecovery",
      "injuryRecovery",
      "lineupBlocker",
      "teamRosterSize",
      "availablePlayers",
      "blockedPlayers",
      "source",
    ],
    playerRows.map((row) => [
      row.scenarioId,
      row.matchdayIndex,
      row.matchdayId,
      row.teamId,
      row.teamName,
      row.playerId,
      row.playerName,
      row.fatigueBeforeMatchday,
      row.fatigueAfterMatchday,
      row.injuryRiskBand,
      row.injuryRiskPercent,
      row.injuryRoll,
      row.injuryEvent,
      row.normalRecovery,
      row.injuryRecovery,
      row.lineupBlocker,
      row.teamRosterSize,
      row.availablePlayers,
      row.blockedPlayers,
      row.source,
    ]),
  );
  writeCsv(
    capCsvPath,
    [
      "scenarioId",
      "maxRoster",
      "matchdayIndex",
      "matchdayId",
      "d1",
      "d2",
      "requiredSlots",
      "teamId",
      "teamName",
      "currentRosterSize",
      "modeledRosterSize",
      "rosterBucket",
      "availablePlayers",
      "blockedPlayers",
      "lineupPressure",
      "injuriesThisMatchday",
      "playersFatigue70Plus",
      "playersFatigue85Plus",
      "averageFatigueAfter",
    ],
    teamRows.map((row) => [
      row.scenarioId,
      row.maxRoster,
      row.matchdayIndex,
      row.matchdayId,
      row.d1,
      row.d2,
      row.requiredSlots,
      row.teamId,
      row.teamName,
      row.currentRosterSize,
      row.modeledRosterSize,
      row.rosterBucket,
      row.availablePlayers,
      row.blockedPlayers,
      row.lineupPressure,
      row.injuriesThisMatchday,
      row.playersFatigue70Plus,
      row.playersFatigue85Plus,
      row.averageFatigueAfter,
    ]),
  );
  writeCsv(
    pressureCsvPath,
    [
      "scenarioId",
      "teamId",
      "teamName",
      "currentRosterSize",
      "modeledRosterSize",
      "rosterBucket",
      "lineupPressureMatchdays",
      "peakBlockedPlayers",
      "peakFatigue70Plus",
      "peakFatigue85Plus",
      "totalInjuries",
      "aiEnoughRotation",
    ],
    scenarios.flatMap((scenarioId) =>
      gameState.teams.map((team) => {
        const rows = teamRows.filter((row) => row.scenarioId === scenarioId && row.teamId === team.teamId);
        const controlMode = controlByTeamId.get(team.teamId)?.controlMode ?? (team.humanControlled ? "manual" : "ai");
        return [
          scenarioId,
          team.teamId,
          team.name,
          rows[0]?.currentRosterSize ?? 0,
          rows[0]?.modeledRosterSize ?? 0,
          rows[0]?.rosterBucket ?? "—",
          rows.filter((row) => row.lineupPressure).length,
          Math.max(0, ...rows.map((row) => row.blockedPlayers)),
          Math.max(0, ...rows.map((row) => row.playersFatigue70Plus)),
          Math.max(0, ...rows.map((row) => row.playersFatigue85Plus)),
          rows.reduce((sum, row) => sum + row.injuriesThisMatchday, 0),
          controlMode === "ai" && rows.every((row) => row.modeledRosterSize >= row.requiredSlots + 2 && !row.lineupPressure),
        ];
      }),
    ),
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    saveId: save.saveId,
    saveName: save.name,
    seasonId: gameState.season.id,
    matchdayCount: schedule.length,
    riskCurve: injuryRiskBands,
    assumptions: [
      "read_only_no_save_write",
      "max_14_15_use_virtual_rotation_slots_not_real_players",
      "rotation_model_picks_lowest_fatigue_available_players",
      "injured_players_blocked_for_next_matchday",
      "current_service_only_applies_recovery_to_injured_unavailable_players",
      `matchday_fatigue_load_${MATCHDAY_FATIGUE_LOAD}`,
      `base_recovery_${BASE_MATCHDAY_RECOVERY}_plus_facilities_reported_for_comparison`,
    ],
    summaries,
    recommendation,
    rosterCapRecommendation,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

  const md = [
    "# Injury Balance Audit",
    "",
    `Generated: ${payload.generatedAt}`,
    `Save: ${save.name ?? save.saveId}`,
    `SaveId: ${save.saveId}`,
    `Season: ${gameState.season.id}`,
    "",
    "## Ergebnis",
    "",
    `- 22%-Kurve: ${recommendation}`,
    `- Roster-Max: ${rosterCapRecommendation}`,
    "- Keine Save-/Prisma-Writes, keine Regeländerung, keine Roster-Max-Änderung.",
    "",
    "## Risiko-Kurve",
    "",
    "| Fatigue | Label | Risiko |",
    "| --- | --- | ---: |",
    ...injuryRiskBands.map((band) => `| ${band.min}-${band.max} | ${band.uiLabel} | ${band.riskPercent}% |`),
    "",
    "## Szenariovergleich",
    "",
    "| Szenario | Avg Fatigue MD3 | Avg Fatigue MD5 | Avg Fatigue MD10 | 70+ MD10 | 85+ MD10 | Verletzungen gesamt | Verletzungen/MD | Teams 2+ verletzt | Lineup-Druck Teams | AI Rotation ok |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...summaries.map(
      (summary) =>
        `| ${scenarioLabel(summary.scenarioId)} | ${summary.avgFatigueAfterMd3 ?? "—"} | ${summary.avgFatigueAfterMd5 ?? "—"} | ${summary.avgFatigueAfterMd10 ?? "—"} | ${summary.playersFatigue70PlusAfterMd10} | ${summary.playersFatigue85PlusAfterMd10} | ${summary.injuriesTotal} | ${summary.injuriesPerMatchday} | ${summary.teamsWithTwoPlusInjuredPeak} | ${summary.teamsWithLineupPressure} | ${summary.aiTeamsWithEnoughRotationPlayers} |`,
    ),
    "",
    "## Interpretation",
    "",
    "- Wenn Max 14 die Lineup-Druck-Teams deutlich senkt, sollte zuerst Max 14 getestet werden statt die 85+-Kurve zu nerfen.",
    "- Wenn Max 15 kaum besser ist als Max 14, ist 14 der sauberere erste Balancing-Test.",
    "- Der Audit bildet den aktuellen Service ab: normale Recovery wird berichtet, aber nur verletzte/unavailable Spieler erhalten aktuell die halbierte Injury-Recovery.",
    "- Wenn Verletzungen hoch bleiben, obwohl Lineup-Druck verschwindet, ist eher Recovery/AI-Rotation als Roster-Max die Stellschraube.",
    "",
    "## Exporte",
    "",
    `- injury-balance-audit.json`,
    `- injury-risk-by-matchday.csv`,
    `- roster-rotation-cap-comparison.csv`,
    `- teams-with-lineup-pressure.csv`,
    "",
  ];
  fs.writeFileSync(mdPath, md.join("\n"));

  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${riskCsvPath}`);
  console.log(`Wrote ${capCsvPath}`);
  console.log(`Wrote ${pressureCsvPath}`);
}

main();
