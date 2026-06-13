import fs from "node:fs";
import path from "node:path";

import {
  calculateTeamRecovery,
  getInjuryRiskBand,
  getInjuryRiskPercent,
  getLineupInjuryBlockers,
  getPlayerAvailabilityView,
  injuryRiskBands,
} from "@/lib/fatigue/fatigue-injury-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { assertOlyProjectRoot } from "@/lib/persistence/project-root-guard";

const OUTPUT_DIR =
  process.env.OLY_OUTPUT_DIR ??
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";

function escapeCsv(value: string | number | boolean | null | undefined) {
  const text = value == null ? "—" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function writeCsv(filePath: string, header: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  fs.writeFileSync(filePath, [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n") + "\n");
}

function main() {
  assertOlyProjectRoot();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const persistence = createPersistenceService();
  const save = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  const gameState = save.gameState;
  const currentMatchdayId = gameState.matchdayState?.matchdayId ?? gameState.season.matchdayIds?.[0] ?? "unknown";
  const teamNameById = new Map(gameState.teams.map((team) => [team.teamId, team.name] as const));
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const activeRosterRows = gameState.rosters
    .map((roster) => ({
      roster,
      player: playerById.get(roster.playerId) ?? null,
    }))
    .filter((row): row is { roster: (typeof gameState.rosters)[number]; player: NonNullable<ReturnType<typeof playerById.get>> } =>
      Boolean(row.player),
    );
  const injuryEvents = gameState.seasonState.injuryEvents ?? [];
  const availabilityRows = activeRosterRows.map(({ roster, player }) => {
    const availability = getPlayerAvailabilityView(gameState, player.id, roster.teamId, currentMatchdayId);
    return {
      player,
      teamId: roster.teamId,
      availability,
      riskPercent: getInjuryRiskPercent(availability.fatigue),
      riskBand: getInjuryRiskBand(availability.fatigue),
    };
  });
  const blockers = (gameState.seasonState.lineupDrafts ?? []).flatMap((draft) => getLineupInjuryBlockers(gameState, draft));
  const recoveryRows = gameState.teams.map((team) => {
    const recovery = calculateTeamRecovery(gameState, team.teamId);
    return {
      teamId: team.teamId,
      teamName: team.name,
      normalRecovery: recovery.normalRecovery,
      injuryRecovery: recovery.injuryRecovery,
    };
  });

  const markdownLines = [
    "# Fatigue & Injury Audit",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Save: ${save.name ?? save.saveId}`,
    `SaveId: ${save.saveId}`,
    `Season: ${gameState.season.id}`,
    `Current Matchday: ${currentMatchdayId}`,
    "",
    "## Summary",
    "",
    `- Active roster players tracked: ${availabilityRows.length}`,
    `- Injury events stored: ${injuryEvents.length}`,
    `- Currently injured/unavailable: ${availabilityRows.filter((row) => row.availability.isUnavailable).length}`,
    `- Players above fatigue risk threshold: ${availabilityRows.filter((row) => row.riskPercent > 0).length}`,
    `- Lineup blockers: ${blockers.length}`,
    "",
    "## Highest Current Fatigue",
    "",
    "| Player | Team | Fatigue | Risk | Status | Unavailable Until |",
    "| --- | --- | ---: | ---: | --- | --- |",
    ...availabilityRows
      .sort((left, right) => right.availability.fatigue - left.availability.fatigue)
      .slice(0, 25)
      .map((row) =>
        [
          row.player.name,
          teamNameById.get(row.teamId) ?? row.teamId,
          row.availability.fatigue,
          `${row.riskPercent}%`,
          row.availability.injuryStatus,
          row.availability.injuryUntilMatchday ?? "—",
        ]
          .map((value) => String(value).replaceAll("|", "\\|"))
          .join(" | ")
          .replace(/^/, "| ")
          .replace(/$/, " |"),
      ),
    "",
  ];

  const mdPath = path.join(OUTPUT_DIR, "fatigue-injury-audit.md");
  const eventCsvPath = path.join(OUTPUT_DIR, "fatigue-injury-events.csv");
  const riskBandsCsvPath = path.join(OUTPUT_DIR, "fatigue-injury-risk-bands.csv");
  const recoveryCsvPath = path.join(OUTPUT_DIR, "injury-recovery-audit.csv");
  const blockerCsvPath = path.join(OUTPUT_DIR, "injury-lineup-blockers.csv");

  fs.writeFileSync(mdPath, markdownLines.join("\n"));
  writeCsv(
    riskBandsCsvPath,
    ["min", "max", "riskBand", "riskPercent", "uiLabel", "source"],
    injuryRiskBands.map((band) => [band.min, band.max, band.label, band.riskPercent, band.uiLabel, "injuryRiskBands"]),
  );
  writeCsv(
    eventCsvPath,
    [
      "eventId",
      "seasonId",
      "matchdayId",
      "teamId",
      "team",
      "playerId",
      "player",
      "fatigueBefore",
      "riskPercent",
      "roll",
      "result",
      "unavailableUntil",
      "normalRecovery",
      "injuryRecovery",
      "source",
      "timestamp",
    ],
    injuryEvents.map((event) => [
      event.eventId,
      event.seasonId,
      event.matchdayId,
      event.teamId,
      teamNameById.get(event.teamId) ?? event.teamId,
      event.playerId,
      playerById.get(event.playerId)?.name ?? event.playerId,
      event.fatigueBefore,
      event.riskPercent,
      event.roll,
      event.result,
      event.unavailableUntil ?? null,
      event.normalRecovery ?? null,
      event.injuryRecovery ?? null,
      event.source,
      event.timestamp,
    ]),
  );
  writeCsv(
    recoveryCsvPath,
    [
      "playerId",
      "playerName",
      "teamId",
      "team",
      "fatigue",
      "riskBand",
      "riskPercent",
      "injuryStatus",
      "blockedFromLineup",
      "normalRecovery",
      "injuryRecovery",
      "source",
    ],
    availabilityRows.map((row) => {
      const recovery = recoveryRows.find((entry) => entry.teamId === row.teamId);
      return [
        row.player.id,
        row.player.name,
        row.teamId,
        teamNameById.get(row.teamId) ?? row.teamId,
        row.availability.fatigue,
        row.riskBand.label,
        row.riskPercent,
        row.availability.injuryStatus,
        row.availability.isUnavailable,
        recovery?.normalRecovery ?? null,
        recovery?.injuryRecovery ?? null,
        "normal_recovery_after_facilities_x_0_5",
      ];
    }),
  );
  writeCsv(
    blockerCsvPath,
    [
      "seasonId",
      "matchdayId",
      "teamId",
      "team",
      "playerId",
      "playerName",
      "fatigue",
      "riskBand",
      "riskPercent",
      "injuryStatus",
      "blockedFromLineup",
      "blocker",
      "injuryUntilMatchday",
      "normalRecovery",
      "injuryRecovery",
      "source",
    ],
    blockers.map((blocker) => {
      const player = playerById.get(blocker.playerId);
      const availability = getPlayerAvailabilityView(gameState, blocker.playerId, blocker.teamId, blocker.matchdayId);
      const riskBand = getInjuryRiskBand(availability.fatigue);
      const recovery = recoveryRows.find((entry) => entry.teamId === blocker.teamId);
      return [
        gameState.season.id,
        blocker.matchdayId,
        blocker.teamId,
        teamNameById.get(blocker.teamId) ?? blocker.teamId,
        blocker.playerId,
        player?.name ?? blocker.playerId,
        availability.fatigue,
        riskBand.label,
        riskBand.riskPercent,
        availability.injuryStatus,
        true,
        blocker.blocker,
        blocker.injuryUntilMatchday,
        recovery?.normalRecovery ?? null,
        recovery?.injuryRecovery ?? null,
        "lineup_injury_blocker",
      ];
    }),
  );

  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${riskBandsCsvPath}`);
  console.log(`Wrote ${eventCsvPath}`);
  console.log(`Wrote ${recoveryCsvPath}`);
  console.log(`Wrote ${blockerCsvPath}`);
}

main();
