import fs from "node:fs";
import path from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getDisciplineColor, getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";

const OUTPUT_DIR =
  process.env.OLY_OUTPUT_DIR ??
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]) {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
}

function writeFile(name: string, content: string) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, name);
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  return filePath;
}

function extractScheduleSeed(sourceNote: string | null | undefined) {
  const marker = "Season-spezifischer Schedule-Seed: ";
  if (!sourceNote?.includes(marker)) return "";
  return sourceNote.slice(sourceNote.indexOf(marker) + marker.length).trim();
}

function cardColorToDisciplineCategory(color: string | null | undefined) {
  if (color === "red") return "power";
  if (color === "green") return "speed";
  if (color === "blue") return "mental";
  if (color === "yellow") return "social";
  return null;
}

function main() {
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const save = persistence.getActiveSave();
  if (!save) {
    throw new Error("No active local save found for season setup audit.");
  }

  const gameState = save.gameState;
  const schedule = getSeasonDisciplineSchedule(gameState);
  const warnings: string[] = [];
  if (!gameState.season.matchdayIds.every((matchdayId, index) => schedule[index]?.matchdayId === matchdayId)) {
    warnings.push("season_matchday_ids_not_aligned_with_discipline_schedule");
  }

  const scheduleRows = schedule.map((entry) => {
    const entryWarnings = [
      entry.seasonId !== gameState.season.id ? "stale_schedule_season_ref" : null,
      entry.sourceStatus !== "season_seed" ? "schedule_not_season_seeded" : null,
    ].filter(Boolean);
    return {
      seasonId: entry.seasonId,
      matchday: entry.matchdayIndex,
      matchdayId: entry.matchdayId,
      d1: entry.discipline1?.disciplineId ?? "",
      d2: entry.discipline2?.disciplineId ?? "",
      d1Color: getDisciplineColor(entry.discipline1?.category) ?? "",
      d2Color: getDisciplineColor(entry.discipline2?.category) ?? "",
      slotCountD1: entry.discipline1?.playerCount ?? "",
      slotCountD2: entry.discipline2?.playerCount ?? "",
      scheduleSeed: extractScheduleSeed(entry.sourceNote),
      scheduleSource: entry.sourceStatus,
      isSameAsPreviousSeason: "",
      warnings: entryWarnings.join("|"),
    };
  });

  const previousSeasonIds = new Set((gameState.seasonState.seasonSnapshots ?? []).map((snapshot) => snapshot.seasonId));
  if (previousSeasonIds.size > 0) {
    warnings.push("previous_season_schedule_source_missing_in_legacy_snapshots");
  }

  const currentCards = gameState.seasonState.formCards ?? [];
  const previousCards = currentCards.filter((card) => card.seasonId !== gameState.season.id);
  const previousCardKeys = new Set(previousCards.map((card) => `${card.teamId}:${card.playerId}:${card.cardColor}:${card.cardValue}`));
  const formRows = currentCards
    .filter((card) => card.seasonId === gameState.season.id)
    .map((card) => {
      const matchingCategory = cardColorToDisciplineCategory(card.cardColor);
      const x2PotentialByDisziColor = schedule
        .flatMap((entry) => [entry.discipline1, entry.discipline2])
        .filter((slot) => slot?.category === matchingCategory)
        .map((slot) => slot?.disciplineId)
        .filter(Boolean)
        .join("|");
      return {
        seasonId: card.seasonId,
        teamId: card.teamId,
        playerId: card.playerId,
        formColor: card.cardColor,
        cardValue: card.cardValue,
        source: "local_season_formcard_generator",
        drawSeed: `${save.saveId}:${card.seasonId}:${card.teamId}:${card.playerId}`,
        duplicatedFromPreviousSeason: previousCardKeys.has(`${card.teamId}:${card.playerId}:${card.cardColor}:${card.cardValue}`),
        staleSeasonRef: card.seasonId !== gameState.season.id,
        x2PotentialByDisziColor,
      };
    });

  const staleCards = currentCards.filter((card) => card.seasonId !== gameState.season.id);
  if (staleCards.length > 0) {
    warnings.push("stale_formcards_present_but_inactive");
  }
  if (formRows.length === 0) {
    warnings.push("current_season_formcards_missing");
  }

  const scheduleJson = {
    saveId: save.saveId,
    seasonId: gameState.season.id,
    matchdayIds: gameState.season.matchdayIds,
    rows: scheduleRows,
    warnings,
  };
  const formJson = {
    saveId: save.saveId,
    seasonId: gameState.season.id,
    activeCards: formRows.length,
    inactiveStaleCards: staleCards.length,
    rows: formRows,
    warnings,
  };

  const scheduleColumns = [
    "seasonId",
    "matchday",
    "matchdayId",
    "d1",
    "d2",
    "d1Color",
    "d2Color",
    "slotCountD1",
    "slotCountD2",
    "scheduleSeed",
    "scheduleSource",
    "isSameAsPreviousSeason",
    "warnings",
  ];
  const formColumns = [
    "seasonId",
    "teamId",
    "playerId",
    "formColor",
    "cardValue",
    "source",
    "drawSeed",
    "duplicatedFromPreviousSeason",
    "staleSeasonRef",
    "x2PotentialByDisziColor",
  ];

  const outputs = {
    scheduleCsv: writeFile("season-schedule-audit.csv", toCsv(scheduleRows, scheduleColumns)),
    scheduleJson: writeFile("season-schedule-audit.json", JSON.stringify(scheduleJson, null, 2)),
    formCardsCsv: writeFile("season-formcards-regeneration-audit.csv", toCsv(formRows, formColumns)),
    formCardsJson: writeFile("season-formcards-regeneration-audit.json", JSON.stringify(formJson, null, 2)),
  };

  console.log(JSON.stringify({ outputs, scheduleRows: scheduleRows.length, formCards: formRows.length, warnings }, null, 2));
}

main();
