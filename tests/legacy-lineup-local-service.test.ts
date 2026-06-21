import { beforeEach, describe, expect, it } from "vitest";

import type { LegacyLineupEntryInput } from "@/lib/lineups/legacy-lineup-types";
import {
  calculateLocalLegacyLineupPreview,
  generateLocalLegacyFormCardsForSeason,
  getLocalLegacyLineupDraft,
  loadLocalLegacyLineupContext,
  saveLocalLegacyLineupDraft,
} from "@/lib/lineups/legacy-lineup-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";

function buildEntriesFromContext(
  input: ReturnType<typeof loadLocalLegacyLineupContext>,
  options?: { d1Captain?: boolean; d2Captain?: boolean },
) {
  if (!input.ok) {
    throw new Error(input.errors.join(" | "));
  }

  const { context } = input;
  const d1 = context.matchdayContract?.discipline1;
  const d2 = context.matchdayContract?.discipline2;
  if (!d1 || !d2 || !d1.requiredPlayers || !d2.requiredPlayers) {
    throw new Error("Missing matchday discipline contract.");
  }

  const entries: LegacyLineupEntryInput[] = [];
  let cursor = 0;
  for (let index = 0; index < d1.requiredPlayers; index += 1) {
    const activePlayer = context.activePlayers[cursor];
    if (!activePlayer) {
      throw new Error("Not enough active players for d1.");
    }
    entries.push({
      disciplineId: d1.disciplineId,
      disciplineSide: "d1",
      slotIndex: index,
      playerId: activePlayer.playerId,
      activePlayerId: activePlayer.id,
      isCaptain: index === 0 && (options?.d1Captain ?? true),
    });
    cursor += 1;
  }

  for (let index = 0; index < d2.requiredPlayers; index += 1) {
    const activePlayer = context.activePlayers[cursor];
    if (!activePlayer) {
      throw new Error("Not enough active players for d2.");
    }
    entries.push({
      disciplineId: d2.disciplineId,
      disciplineSide: "d2",
      slotIndex: index,
      playerId: activePlayer.playerId,
      activePlayerId: activePlayer.id,
      isCaptain: index === 0 && (options?.d2Captain ?? false),
    });
    cursor += 1;
  }

  return entries;
}

describe("legacy lineup local service", () => {
  function topUpRosterCoverage(saveId: string) {
    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      throw new Error(`Save ${saveId} could not be loaded for roster top-up.`);
    }

    const requiredUniquePlayers = getSeasonDisciplineSchedule(save.gameState).reduce((maxPlayers, entry) => {
      const totalPlayers = (entry.discipline1?.playerCount ?? 0) + (entry.discipline2?.playerCount ?? 0);
      return Math.max(maxPlayers, totalPlayers);
    }, 0);

    const usedPlayerIds = new Set(save.gameState.rosters.map((entry) => entry.playerId));
    const freePlayers = save.gameState.players.filter((player) => !usedPlayerIds.has(player.id));
    let freeIndex = 0;
    let rosterCounter = save.gameState.rosters.length;
    let changed = false;

    for (const team of save.gameState.teams) {
      const roster = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
      const shortfall = Math.max(0, requiredUniquePlayers - roster.length);

      for (let index = 0; index < shortfall; index += 1) {
        const player = freePlayers[freeIndex];
        if (!player) {
          throw new Error("Not enough free players to top up lineup roster coverage.");
        }
        freeIndex += 1;
        save.gameState.rosters.push({
          id: `legacy-lineup-topup-${rosterCounter}`,
          teamId: team.teamId,
          playerId: player.id,
          contractLength: 3,
          salary: Math.round(player.salaryDemand),
          upkeep: Math.round(player.salaryDemand),
          purchasePrice: Math.round(player.marketValue),
          currentValue: Math.round(player.marketValue),
          roleTag: "bench",
          joinedSeasonId: save.gameState.season.id,
        });
        rosterCounter += 1;
        changed = true;
      }
    }

    if (changed) {
      persistence.saveSingleplayerState(saveId, save.gameState);
    }
  }

  function pickEligibleTeamId(save: ReturnType<ReturnType<typeof createPersistenceService>["createFreshSeasonOneSave"]>) {
    return (
      save.gameState.teams.find((team) => save.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length >= 7)?.teamId ??
      save.gameState.teams[0]!.teamId
    );
  }

  beforeEach(() => {
    resetDatabaseForTests();
  });

  it("loads local context from the sqlite save with matchday contract and mapped team ranks", () => {
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({ name: "Lineup Local Test" });
    topUpRosterCoverage(save.saveId);
    const teamId = pickEligibleTeamId(save);

    const result = loadLocalLegacyLineupContext({
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      matchdayId: save.gameState.matchdayState.matchdayId,
      teamId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const scheduleEntry = getSeasonDisciplineSchedule(save.gameState).find(
      (entry) => entry.matchdayId === save.gameState.matchdayState.matchdayId,
    );
    const currentDisciplineIds = [
      scheduleEntry?.discipline1?.disciplineId,
      scheduleEntry?.discipline2?.disciplineId,
    ].filter((value): value is string => Boolean(value));

    expect(result.context.matchdayContract?.discipline1?.displayName).toBe(scheduleEntry?.discipline1?.displayName);
    expect(result.context.matchdayContract?.discipline1?.requiredPlayers).toBeGreaterThan(0);
    expect(result.context.matchdayContract?.discipline2?.displayName).toBe(scheduleEntry?.discipline2?.displayName);
    expect(result.context.matchdayContract?.discipline2?.requiredPlayers).toBeGreaterThan(0);
    expect(result.context.teamStatus?.captainSlots).toBe(3);
    for (const disciplineId of currentDisciplineIds) {
      expect(result.context.teamDisciplineRanks?.[disciplineId]?.sourceStatus).toBe("mapped_with_transform");
      expect(result.context.teamDisciplineRanks?.[disciplineId]?.rank).not.toBeNull();
    }
    expect(Object.keys(result.context.teamDisciplineRanks ?? {}).length).toBeGreaterThan(2);
    const nonMatchdayRank = Object.entries(result.context.teamDisciplineRanks ?? {}).find(
      ([disciplineId, entry]) => !currentDisciplineIds.includes(disciplineId) && entry.rank != null,
    );
    expect(nonMatchdayRank).toBeTruthy();
    expect(result.context.formCardSource?.selectionStatus).toBe("ready");
    expect(result.context.formCardSource?.effectStatus).toBe("ready");
    expect(result.context.mutatorSource?.selectionStatus).toBe("ready");
    expect(result.context.mutatorSource?.effectStatus).toBe("ready");
  });

  it("resolves late-season matchdays from the stored season discipline schedule instead of hardcoded Spieltag 1/2 pairings", () => {
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({ name: "Lineup Matchday Schedule Test" });
    const teamId = pickEligibleTeamId(save);
    const targetScheduleEntry = getSeasonDisciplineSchedule(save.gameState).at(-1);
    if (!targetScheduleEntry) {
      throw new Error("Expected a stored season discipline schedule.");
    }

    const result = loadLocalLegacyLineupContext({
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      matchdayId: targetScheduleEntry.matchdayId,
      teamId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.context.matchdayContract?.discipline1?.disciplineId).toBe(targetScheduleEntry.discipline1?.disciplineId);
    expect(result.context.matchdayContract?.discipline2?.disciplineId).toBe(targetScheduleEntry.discipline2?.disciplineId);
    expect(result.context.matchdayContract?.sourceStatus).toBe(targetScheduleEntry.sourceStatus);
  });

  it("saves and reloads a local sqlite lineup draft with modifiers and previews it with captain bonus", () => {
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({ name: "Lineup Local Save Test" });
    topUpRosterCoverage(save.saveId);
    const params = {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      matchdayId: save.gameState.matchdayState.matchdayId,
      teamId: pickEligibleTeamId(save),
    };

    const context = loadLocalLegacyLineupContext(params);
    const entries = buildEntriesFromContext(context, { d1Captain: true, d2Captain: false });
    const saveResult = saveLocalLegacyLineupDraft(params, entries, {
      d1: {
        primaryFormCardId: context.ok ? context.context.formCards?.[0]?.id ?? null : null,
        secondaryFormCardId: context.ok ? context.context.formCards?.find((card) => card.value > 0)?.id ?? null : null,
        mutatorTrait1: "Cool",
        mutatorTrait2: "Diligent",
      },
      d2: {
        primaryFormCardId: null,
        secondaryFormCardId: null,
        mutatorTrait1: "Lazy",
        mutatorTrait2: null,
      },
    });

    expect(saveResult.ok).toBe(true);
    if (!saveResult.ok) {
      return;
    }

    const loaded = getLocalLegacyLineupDraft(params);
    expect(loaded?.entries).toEqual(saveResult.draft.entries);
    expect(loaded?.modifiers.d1.mutatorTrait1).toBe("Cool");
    expect(loaded?.modifiers.d1.mutatorTrait2).toBe("Diligent");

    const preview = calculateLocalLegacyLineupPreview(params);
    expect(preview.ok).toBe(true);
    if (!preview.ok) {
      return;
    }

    expect(preview.validation.isValid).toBe(true);
    expect(preview.scorePreview.totalScore).toBeGreaterThan(0);
    expect(preview.disciplineSideScores.some((side) => (side.captainBonusTotal ?? 0) > 0)).toBe(true);
    expect(preview.disciplineSideScores.every((side) => side.fatigueStatus === "mapped")).toBe(true);
    expect(preview.disciplineSideScores.every((side) => side.formCardsAvailable != null)).toBe(true);
    expect(preview.disciplineSideScores.every((side) => side.mutatorModifier != null)).toBe(true);
    expect(preview.scorePreview.validationWarnings).not.toContain("Mutator score source is missing for mini-dm/d1.");
  }, 40000);

  it("applies local fatigue from earlier saved matchdays without writing fatigue state", () => {
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({ name: "Lineup Fatigue Preview Test" });
    topUpRosterCoverage(save.saveId);
    const teamId = pickEligibleTeamId(save);
    const seasonId = save.gameState.season.id;
    const [matchday1, matchday2] = save.gameState.season.matchdayIds;
    if (!matchday1 || !matchday2) {
      throw new Error("Expected at least two matchdays.");
    }

    const firstParams = { saveId: save.saveId, seasonId, matchdayId: matchday1, teamId };
    const firstContext = loadLocalLegacyLineupContext(firstParams);
    const firstEntries = buildEntriesFromContext(firstContext, { d1Captain: true, d2Captain: false });
    const firstSave = saveLocalLegacyLineupDraft(firstParams, firstEntries);
    expect(firstSave.ok).toBe(true);

    const afterFirstSave = persistence.getSaveById(save.saveId);
    if (!afterFirstSave) {
      throw new Error("Expected save after first lineup save.");
    }
    persistence.saveSingleplayerState(save.saveId, {
      ...afterFirstSave.gameState,
      season: {
        ...afterFirstSave.gameState.season,
        currentMatchday: 2,
      },
      matchdayState: {
        ...afterFirstSave.gameState.matchdayState,
        matchdayId: matchday2,
      },
    });

    const secondParams = { saveId: save.saveId, seasonId, matchdayId: matchday2, teamId };
    const secondContext = loadLocalLegacyLineupContext(secondParams);
    const secondEntries = buildEntriesFromContext(secondContext, { d1Captain: true, d2Captain: false });
    const secondSave = saveLocalLegacyLineupDraft(secondParams, secondEntries);
    expect(secondSave.ok).toBe(true);

    const preview = calculateLocalLegacyLineupPreview(secondParams);
    expect(preview.ok).toBe(true);
    if (!preview.ok) {
      return;
    }

    expect(preview.scorePreview.fatigueModifier).toBeLessThan(0);
    expect(preview.disciplineSideScores.some((side) => side.entries.some((entry) => (entry.fatigueMultiplier ?? 1) < 1))).toBe(true);
  });

  it("builds both matchday discipline previews even when no slots are selected yet", () => {
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({ name: "Lineup Empty Preview Test" });
    const params = {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      matchdayId: save.gameState.matchdayState.matchdayId,
      teamId: pickEligibleTeamId(save),
    };

    const preview = calculateLocalLegacyLineupPreview(params, []);

    expect(preview.ok).toBe(true);
    if (!preview.ok) {
      return;
    }

    expect(preview.disciplineSideScores).toHaveLength(2);
    expect(preview.disciplineSideScores.map((side) => side.disciplineSide)).toEqual(["d1", "d2"]);
    expect(preview.disciplineSideScores.every((side) => side.baseScore === 0)).toBe(true);
    expect(preview.disciplineSideScores.every((side) => side.selectedPlayers === 0)).toBe(true);
  });

  it("blocks local sqlite drafts that exceed the season captain limit", () => {
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({ name: "Lineup Captain Limit Test" });
    topUpRosterCoverage(save.saveId);
    const teamId = pickEligibleTeamId(save);
    const seasonId = save.gameState.season.id;
    const matchdayIds = save.gameState.season.matchdayIds.slice(0, 2);

    for (const matchdayId of matchdayIds) {
      const params = { saveId: save.saveId, seasonId, matchdayId, teamId };
      const context = loadLocalLegacyLineupContext(params);
      const entries = buildEntriesFromContext(context, { d1Captain: true, d2Captain: true });
      const saveResult = saveLocalLegacyLineupDraft(params, entries);
      if (matchdayId === matchdayIds[0]) {
        expect(saveResult.ok).toBe(true);
        const afterFirstSave = persistence.getSaveById(save.saveId);
        if (!afterFirstSave) {
          throw new Error("Expected save after first captain test save.");
        }
        persistence.saveSingleplayerState(save.saveId, {
          ...afterFirstSave.gameState,
          season: {
            ...afterFirstSave.gameState.season,
            currentMatchday: 2,
          },
          matchdayState: {
            ...afterFirstSave.gameState.matchdayState,
            matchdayId: matchdayIds[1]!,
          },
        });
      } else {
        expect(saveResult.ok).toBe(false);
        if (!saveResult.ok) {
          expect(saveResult.errors.some((error) => error.includes("Season captain limit 3 would be exceeded"))).toBe(true);
        }
      }
    }
  }, 40000);

  it("blocks overwriting lineups for a non-active matchday", () => {
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({ name: "Lineup Lock Test" });
    const teamId = pickEligibleTeamId(save);

    const result = saveLocalLegacyLineupDraft(
      {
        saveId: save.saveId,
        seasonId: save.gameState.season.id,
        matchdayId: "matchday-2",
        teamId,
      },
      [],
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("lineup_matchday_is_not_active");
    }
  });

  it("generates season form cards locally for all teams from the current roster class colors", () => {
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({ name: "Lineup Form Card Generate Test" });
    const params = {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      matchdayId: save.gameState.matchdayState.matchdayId,
      teamId: pickEligibleTeamId(save),
    };

    const beforeSave = persistence.getSaveById(save.saveId);
    expect(beforeSave?.gameState.seasonState.formCards?.length ?? 0).toBe(0);

    const result = generateLocalLegacyFormCardsForSeason(params, persistence);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const afterSave = persistence.getSaveById(save.saveId);
    const seasonCards = (afterSave?.gameState.seasonState.formCards ?? []).filter(
      (card) => card.seasonId === params.seasonId,
    );
    const seasonRoster = afterSave?.gameState.rosters ?? [];
    const playerById = new Map((afterSave?.gameState.players ?? []).map((player) => [player.id, player]));
    const mappedPlayers = seasonRoster.filter((entry) => {
      const className = playerById.get(entry.playerId)?.className ?? null;
      return [
        "Berserker",
        "Warlord",
        "Tank",
        "Sprinter",
        "Rogue",
        "Charger",
        "Mage",
        "Overseer",
        "Templar",
        "Bard",
        "Hero",
        "Badass",
        "Tactician",
      ].includes(className ?? "");
    });
    const teamIdsWithMappedPlayers = new Set(mappedPlayers.map((entry) => entry.teamId));

    expect(result.coveredPlayerCount).toBe(mappedPlayers.length);
    expect(result.coveredTeamCount).toBe(teamIdsWithMappedPlayers.size);
    expect(result.generatedCardCount).toBe(mappedPlayers.length * 2);
    expect(seasonCards.length).toBe(mappedPlayers.length * 2);
    expect(seasonCards.every((card) => ["red", "green", "blue", "yellow"].includes(card.cardColor))).toBe(true);
    expect(seasonCards.every((card) => Number.isFinite(card.cardValue))).toBe(true);
  });
});
