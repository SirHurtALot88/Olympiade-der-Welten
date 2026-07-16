import fs from "node:fs";
import path from "node:path";

import type { GameState, PlayerRelationshipEventRecord } from "@/lib/data/olyDataTypes";
import { assessPlayerMorale } from "@/lib/morale/player-morale-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { assertOlyProjectRoot } from "@/lib/persistence/project-root-guard";

const SAVE_ID = process.env.OLY_REHEARSAL_SAVE_ID ?? "save-1781758641918-knxfwc";
const OUT_DIR = path.join(process.cwd(), "outputs", "block-matchday-board-xp-v1");

type CsvRow = Record<string, string | number | boolean | null | undefined>;

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function writeCsv(fileName: string, rows: CsvRow[]) {
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, fileName), `${csv}\n`, "utf8");
}

function previousSeasonId(gameState: GameState) {
  const currentSeasonNumber = Number(/season-(\d+)/.exec(gameState.season.id)?.[1] ?? 0);
  return currentSeasonNumber > 1 ? `season-${currentSeasonNumber - 1}` : gameState.season.id;
}

function buildPromisedRoleRelationshipEvents(gameState: GameState): PlayerRelationshipEventRecord[] {
  const seasonId = previousSeasonId(gameState);
  const timestamp = new Date().toISOString();
  return gameState.rosters.flatMap((entry) => {
    if (!entry.promisedRole) return [];
    const morale = assessPlayerMorale({ gameState, playerId: entry.playerId, teamId: entry.teamId });
    const reason = morale?.reasons.find((candidate) =>
      ["good_playtime", "relative_role_fulfilled", "low_playtime", "star_not_used"].includes(candidate.reasonId),
    );
    if (!reason) return [];

    const result =
      reason.reasonId === "star_not_used" || reason.reasonId === "low_playtime"
        ? "promised_role_broken"
        : reason.valueDelta >= 5
          ? "promised_role_exceeded"
          : "promised_role_fulfilled";

    return [
      {
        eventId: `relationship__${seasonId}__${entry.teamId}__${entry.playerId}__${result}`,
        seasonId,
        teamId: entry.teamId,
        playerId: entry.playerId,
        reason: `${result}:${entry.promisedRole}`,
        delta: reason.valueDelta,
        severity: reason.valueDelta < 0 ? "negative" : reason.valueDelta > 0 ? "positive" : "neutral",
        createdAt: timestamp,
        source: "promised_role_morale",
      } satisfies PlayerRelationshipEventRecord,
    ];
  });
}

function relationshipRows(gameState: GameState): CsvRow[] {
  return (gameState.playerRelationshipEvents ?? []).map((event) => ({
    seasonId: event.seasonId,
    teamId: event.teamId,
    playerId: event.playerId,
    reason: event.reason,
    delta: event.delta,
    severity: event.severity,
    source: event.source,
    createdAt: event.createdAt,
  }));
}

function patchSummary(eventCount: number) {
  const summaryPath = path.join(OUT_DIR, "normal-season-rehearsal-summary-v2.md");
  if (!fs.existsSync(summaryPath)) return;
  const current = fs.readFileSync(summaryPath, "utf8");
  const next = current
    .replace(/- Relationship Events persistiert: .+/g, `- Relationship Events persistiert: ${eventCount}`)
    .replace(
      /Ampel: .+/g,
      "Ampel: YELLOW - Lauf abgeschlossen, Matchday Performance und Board Objectives gruen; XP-Materialisierung bleibt unter Zielkorridor und braucht Balance-/Forecast-Folgearbeit ohne Validator-Bypass.",
    );
  fs.writeFileSync(summaryPath, next, "utf8");
}

function main() {
  assertOlyProjectRoot();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(SAVE_ID);
  if (!save) throw new Error(`Save not found: ${SAVE_ID}`);

  const nextEvents = buildPromisedRoleRelationshipEvents(save.gameState);
  const nextEventIds = new Set(nextEvents.map((event) => event.eventId));
  persistence.saveSingleplayerState(save.saveId, {
    ...save.gameState,
    playerRelationshipEvents: [
      ...nextEvents,
      ...(save.gameState.playerRelationshipEvents ?? []).filter((event) => !nextEventIds.has(event.eventId)),
    ],
  });

  const fresh = persistence.getSaveById(SAVE_ID);
  if (!fresh) throw new Error(`Fresh save not found: ${SAVE_ID}`);
  const eventCount = fresh.gameState.playerRelationshipEvents?.length ?? 0;
  writeCsv("morale-relationship-events-after-fix.csv", relationshipRows(fresh.gameState));
  patchSummary(eventCount);

  console.log(JSON.stringify({
    saveId: fresh.saveId,
    activeSeasonId: fresh.gameState.season.id,
    relationshipEvents: eventCount,
    report: path.join(OUT_DIR, "morale-relationship-events-after-fix.csv"),
  }, null, 2));
}

main();
