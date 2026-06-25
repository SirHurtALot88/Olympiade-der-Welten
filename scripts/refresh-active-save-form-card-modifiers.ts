import fs from "node:fs";
import path from "node:path";

import { buildAiLegacyLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import type { GameState, LineupDraft } from "@/lib/data/olyDataTypes";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { createLineupDraftId } from "@/lib/lineups/lineup-discipline-contract";
import {
  ensureLocalFormCardsForSeason,
  normalizeLineupDraftModifiers,
} from "@/lib/lineups/legacy-lineup-modifiers";
import { ensureLocalTeamPowersForSeason } from "@/lib/lineups/team-powers";
import { loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupEntryInput } from "@/lib/lineups/legacy-lineup-types";
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

function argList(name: string) {
  const value = argValue(name);
  if (!value) return [];
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function resolveTargetMatchdayIds(gameState: GameState, explicitIds: string[] | null) {
  if (explicitIds && explicitIds.length > 0) {
    return explicitIds;
  }

  const currentMatchdayId = gameState.matchdayState.matchdayId;
  const currentIndex = gameState.season.matchdayIds.indexOf(currentMatchdayId);
  const nextMatchdayId = currentIndex >= 0 ? gameState.season.matchdayIds[currentIndex + 1] ?? null : null;

  return nextMatchdayId ? [currentMatchdayId, nextMatchdayId] : [currentMatchdayId];
}

function countFormCardSlots(draft: LineupDraft) {
  const sides = [draft.modifiers?.d1, draft.modifiers?.d2];
  return sides.reduce((sum, side) => {
    let count = 0;
    if (side?.primaryFormCardId) count += 1;
    if (side?.secondaryFormCardId) count += 1;
    return sum + count;
  }, 0);
}

function countBothSlotSides(draft: LineupDraft) {
  return [draft.modifiers?.d1, draft.modifiers?.d2].filter(
    (side) => Boolean(side?.primaryFormCardId && side?.secondaryFormCardId),
  ).length;
}

async function main() {
  const dryRun = !hasArg("--execute");
  const includeManual = hasArg("--include-manual");
  const excludeTeamIds = new Set(argList("--exclude-team-ids"));
  const onlyTeamIds = new Set(argList("--only-team-ids"));
  const saveIdArg = argValue("--save-id");
  const matchdayArg = argValue("--matchday-id");
  const explicitMatchdayIds = matchdayArg ? matchdayArg.split(",").map((value) => value.trim()).filter(Boolean) : null;

  const persistence = createPersistenceService();
  const save =
    (saveIdArg ? persistence.getSaveById(saveIdArg) : null) ??
    persistence.getActiveSave() ??
    persistence.bootstrapSingleplayerSave().save;

  if (!save) {
    throw new Error("No local save available.");
  }

  let gameState = save.gameState;
  const seasonId = gameState.season.id;
  gameState = ensureLocalFormCardsForSeason(gameState, save.saveId, seasonId);
  gameState = ensureLocalTeamPowersForSeason(gameState, save.saveId, seasonId);

  const matchdayIds = resolveTargetMatchdayIds(gameState, explicitMatchdayIds);
  const controlMap = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState?.teamControlSettings);
  const now = new Date().toISOString();
  const existingDrafts = gameState.seasonState.lineupDrafts ?? [];
  const nextDrafts = [...existingDrafts];

  const summary = {
    saveId: save.saveId,
    saveName: save.name,
    seasonId,
    activeMatchdayId: gameState.matchdayState.matchdayId,
    matchdayIds,
    dryRun,
    includeManual,
    excludeTeamIds: [...excludeTeamIds],
    onlyTeamIds: [...onlyTeamIds],
    refreshedDrafts: 0,
    skippedManual: 0,
    skippedLocked: 0,
    skippedMissingDraft: 0,
    skippedBlockedContext: 0,
    formCardSlotsBefore: 0,
    formCardSlotsAfter: 0,
    sidesWithPrimaryAndSecondaryBefore: 0,
    sidesWithPrimaryAndSecondaryAfter: 0,
    teamChanges: [] as Array<{
      teamId: string;
      matchdayId: string;
      before: { d1: string | null; d2: string | null };
      after: { d1: string | null; d2: string | null };
    }>,
  };

  for (const matchdayId of matchdayIds) {
    for (const team of gameState.teams) {
      if (excludeTeamIds.has(team.teamId)) {
        continue;
      }
      if (onlyTeamIds.size > 0 && !onlyTeamIds.has(team.teamId)) {
        continue;
      }

      const controlMode = controlMap[team.teamId]?.controlMode ?? "manual";
      if (controlMode === "manual" && !includeManual) {
        summary.skippedManual += 1;
        continue;
      }

      const lineupId = createLineupDraftId({
        saveId: save.saveId,
        seasonId,
        matchdayId,
        teamId: team.teamId,
      });
      const draftIndex = nextDrafts.findIndex((entry) => entry.lineupId === lineupId);
      const draft = draftIndex >= 0 ? nextDrafts[draftIndex] : null;
      if (!draft || draft.entries.length === 0) {
        summary.skippedMissingDraft += 1;
        continue;
      }
      if (["locked", "resolved"].includes(draft.status)) {
        summary.skippedLocked += 1;
        continue;
      }

      summary.formCardSlotsBefore += countFormCardSlots(draft);
      summary.sidesWithPrimaryAndSecondaryBefore += countBothSlotSides(draft);

      const contextResult = loadLocalLegacyLineupContextFromGameState(gameState, {
        saveId: save.saveId,
        seasonId,
        matchdayId,
        teamId: team.teamId,
      });
      if (!contextResult.ok) {
        summary.skippedBlockedContext += 1;
        continue;
      }

      const entries = draft.entries as LegacyLineupEntryInput[];
      const modifiers = buildAiLegacyLineupModifiers(contextResult.context, entries);
      const normalizedModifiers = normalizeLineupDraftModifiers(modifiers);
      const nextDraft: LineupDraft = {
        ...draft,
        modifiers: normalizedModifiers,
        updatedAt: now,
      };

      summary.formCardSlotsAfter += countFormCardSlots(nextDraft);
      summary.sidesWithPrimaryAndSecondaryAfter += countBothSlotSides(nextDraft);
      summary.refreshedDrafts += 1;

      const formatSide = (side: LineupDraft["modifiers"]["d1"]) => {
        const primary = side?.primaryFormCardId ?? null;
        const secondary = side?.secondaryFormCardId ?? null;
        if (!primary && !secondary) return null;
        if (primary && secondary) return `${primary}+${secondary}`;
        return primary ?? secondary;
      };

      summary.teamChanges.push({
        teamId: team.teamId,
        matchdayId,
        before: {
          d1: formatSide(draft.modifiers?.d1),
          d2: formatSide(draft.modifiers?.d2),
        },
        after: {
          d1: formatSide(nextDraft.modifiers?.d1),
          d2: formatSide(nextDraft.modifiers?.d2),
        },
      });

      if (draftIndex >= 0) {
        nextDrafts[draftIndex] = nextDraft;
      }
    }
  }

  if (!dryRun && summary.refreshedDrafts > 0) {
    persistence.saveSingleplayerState(save.saveId, {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        lineupDrafts: nextDrafts,
      },
    });
  }

  const outputDir = path.join(process.cwd(), "outputs");
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `refresh-form-card-modifiers-${stamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), "utf8");

  console.log(
    [
      dryRun ? "[dry-run]" : "[executed]",
      `save=${summary.saveId}`,
      `matchdays=${summary.matchdayIds.join(",")}`,
      `refreshed=${summary.refreshedDrafts}`,
      `formSlots ${summary.formCardSlotsBefore} -> ${summary.formCardSlotsAfter}`,
      `pos+neg sides ${summary.sidesWithPrimaryAndSecondaryBefore} -> ${summary.sidesWithPrimaryAndSecondaryAfter}`,
      `report=${outputPath}`,
    ].join(" "),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
