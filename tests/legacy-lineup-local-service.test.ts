import { beforeEach, describe, expect, it } from "vitest";

import type { LegacyLineupEntryInput } from "@/lib/lineups/legacy-lineup-types";
import {
  calculateLocalLegacyLineupPreview,
  calculateLocalLegacyLineupPreviewFromContext,
  generateLocalLegacyFormCardsForSeason,
  getLocalLegacyLineupDraft,
  loadLocalLegacyLineupContext,
  saveLocalLegacyFormCardPlan,
  saveLocalLegacyLineupDraft,
} from "@/lib/lineups/legacy-lineup-local-service";
import {
  buildGeneratedFormCardRecordsForSeason,
  ensureLocalFormCardsForSeason,
} from "@/lib/lineups/legacy-lineup-modifiers";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { selectTeamCaptain } from "@/lib/morale/player-demands-service";
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

describe("legacy lineup local service", { timeout: 120_000 }, () => {
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
  });

  it("applies stored player fatigue into local resolve preview", () => {
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
    const rosterPlayerIds = new Set(
      afterFirstSave.gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId),
    );
    persistence.saveSingleplayerState(save.saveId, {
      ...afterFirstSave.gameState,
      players: afterFirstSave.gameState.players.map((player) =>
        rosterPlayerIds.has(player.id) ? { ...player, fatigue: 40 } : player,
      ),
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
  });

  it("traegt beim Speichern keine Formkarte ein, die der Spieler nicht gewaehlt hat", () => {
    // Gemeldeter Fehler: In der Wertung standen Formkarten (+19,0 Form), die nie gespielt
    // wurden. Quelle war der Autofill in diesem Schreibpfad — wer keine Karte waehlte,
    // bekam automatisch die staerkste Positivkarte je Disziplin-Seite eingetragen.
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({ name: "Lineup Form Card Autofill Test" });
    topUpRosterCoverage(save.saveId);
    const params = {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      matchdayId: save.gameState.matchdayState.matchdayId,
      teamId: pickEligibleTeamId(save),
    };

    const context = loadLocalLegacyLineupContext(params);
    const entries = buildEntriesFromContext(context, { d1Captain: false, d2Captain: false });
    // Der Kartenvorrat ist da — nur gewaehlt hat der Spieler nichts.
    expect(context.ok && (context.context.formCards ?? []).some((card) => card.value > 0)).toBe(true);

    const saveResult = saveLocalLegacyLineupDraft(params, entries);
    expect(saveResult.ok).toBe(true);

    const loaded = getLocalLegacyLineupDraft(params);
    expect(loaded?.modifiers.d1.primaryFormCardId).toBeNull();
    expect(loaded?.modifiers.d1.secondaryFormCardId).toBeNull();
    expect(loaded?.modifiers.d2.primaryFormCardId).toBeNull();
    expect(loaded?.modifiers.d2.secondaryFormCardId).toBeNull();

    // Gegenprobe: gewaehlte Karten landen unveraendert im Draft.
    const chosenCardId = context.ok ? context.context.formCards?.find((card) => card.value > 0)?.id ?? null : null;
    expect(chosenCardId).not.toBeNull();
    const withChoice = saveLocalLegacyLineupDraft(params, entries, {
      d1: { primaryFormCardId: chosenCardId, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
    });
    expect(withChoice.ok).toBe(true);
    expect(getLocalLegacyLineupDraft(params)?.modifiers.d1.primaryFormCardId).toBe(chosenCardId);
  });

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

  // Regression guard for BUG B: the resolve engine reads morale + captain from
  // context.gameState, but no context loader populated it — so morale and the
  // captain team-power modifier were silently skipped at resolve even though the
  // preview (which receives the game state via gameStateOverride) applied them.
  it("populates context.gameState so morale applies at resolve and matches the preview", () => {
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({ name: "Resolve Morale Captain Test" });
    topUpRosterCoverage(save.saveId);
    const teamId = pickEligibleTeamId(save);
    const params = {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      matchdayId: save.gameState.matchdayState.matchdayId,
      teamId,
    };

    const context0 = loadLocalLegacyLineupContext(params);
    const entries = buildEntriesFromContext(context0, { d1Captain: true, d2Captain: false });
    const saveResult = saveLocalLegacyLineupDraft(params, entries);
    expect(saveResult.ok).toBe(true);

    // Force a clearly non-neutral (high) morale for one lineup player so the
    // morale multiplier is measurably > 1.0 at resolve.
    const boostedPlayerId = entries[0]!.playerId;
    const current = persistence.getSaveById(save.saveId)!;
    current.gameState.playerMoraleState = [
      ...(current.gameState.playerMoraleState ?? []),
      {
        playerId: boostedPlayerId,
        teamId,
        morale: 100,
        visibleMood: "excellent",
        lastUpdatedSeasonId: save.gameState.season.id,
        inactiveSeasons: 0,
        reasons: [],
        contractIntent: "willing_to_extend",
      },
    ];
    persistence.saveSingleplayerState(save.saveId, current.gameState);

    const contextResult = loadLocalLegacyLineupContext(params);
    if (!contextResult.ok) {
      throw new Error(contextResult.errors.join(" | "));
    }
    const context = contextResult.context;

    // The fix: the resolve engine now receives the game state.
    expect(context.gameState).toBeDefined();
    // The captain input the resolve engine gates on is now reachable.
    const captain = selectTeamCaptain(context.gameState!, teamId);
    expect(captain).not.toBeNull();
    expect(captain!.effects.teamPowerModifierPct).toBeGreaterThanOrEqual(1);

    const resolveWith = buildLegacyMatchdayResolvePreview([context]);
    // Reproduces the pre-fix behaviour: no game state -> morale/captain skipped.
    const resolveWithout = buildLegacyMatchdayResolvePreview([{ ...context, gameState: undefined }]);

    const withScore = resolveWith.disciplinePreviews
      .flatMap((discipline) => discipline.topPlayers)
      .find((player) => player.teamId === teamId && player.playerId === boostedPlayerId);
    const withoutScore = resolveWithout.disciplinePreviews
      .flatMap((discipline) => discipline.topPlayers)
      .find((player) => player.teamId === teamId && player.playerId === boostedPlayerId);
    expect(withScore).toBeDefined();
    expect(withoutScore).toBeDefined();
    // Morale (>1.0) raises the resolved score only when gameState is present.
    expect(withScore!.finalPlayerScore).toBeGreaterThan(withoutScore!.finalPlayerScore);

    // preview == resolve: the shown preview already applied morale via the
    // gameStateOverride; the resolved per-player score now matches it.
    const shown = calculateLocalLegacyLineupPreviewFromContext(
      context,
      undefined,
      undefined,
      context.fatigueByPlayerId ?? null,
      context.gameState,
    );
    expect(shown.ok).toBe(true);
    const shownPlayer = shown.ok
      ? shown.disciplineSideScores
          .flatMap((side) => side.entries)
          .find((entry) => entry.playerId === boostedPlayerId)
      : null;
    expect(shownPlayer).toBeTruthy();
    expect(shownPlayer!.finalContribution).toBeCloseTo(withScore!.finalPlayerScore, 5);
  });

  // Regression: die Formkarten-Auswahl im UI und die Prüfung beim Speichern müssen denselben
  // Kartenbestand sehen. Der Kontext-Ladepfad heilt fehlende Formkarten selbst (ensureLocalFormCardsForSeason,
  // additiv pro Spieler); der Plan-Speicherpfad tat das als einziger NICHT und prüfte gegen den rohen
  // gespeicherten Bestand. Für einen Spieler, der erst nach der ersten Kartengenerierung in den Kader kam,
  // bot das UI seine Karte an und das Speichern lehnte sie mit `form_card_plan_card_missing` ab.
  it("accepts a form card of a player who joined the roster after the season cards were generated", () => {
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({ name: "Form Card Late Joiner" });
    topUpRosterCoverage(save.saveId);
    const teamId = pickEligibleTeamId(save);
    const params = {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      matchdayId: save.gameState.matchdayState.matchdayId,
      teamId,
    };

    // 1) Formkarten der Season erzeugen und PERSISTIEREN — das ist der Bestand, gegen den geprüft wird.
    expect(generateLocalLegacyFormCardsForSeason(params).ok).toBe(true);

    // 2) Ein Spieler kommt DANACH in den Kader (Draft-Reihenfolge, Transfer) — für ihn existiert noch
    //    keine gespeicherte Formkarte.
    const afterGeneration = persistence.getSaveById(save.saveId)!;
    const usedPlayerIds = new Set(afterGeneration.gameState.rosters.map((entry) => entry.playerId));
    // Nur Klassen mit hinterlegter Kartenfarbe (CLASS_COLOR_MAP) erzeugen überhaupt eine Formkarte. Wir
    // wählen deshalb gezielt einen freien Spieler aus einer Klasse, die nachweislich schon Karten geliefert
    // hat — sonst hinge der Test daran, welchen Spieler die Kadergenerierung zufällig übrig lässt.
    const playerClassById = new Map(afterGeneration.gameState.players.map((player) => [player.id, player.className]));
    const cardedClassNames = new Set(
      (afterGeneration.gameState.seasonState.formCards ?? [])
        .map((card) => playerClassById.get(card.playerId))
        .filter((value): value is string => Boolean(value)),
    );
    /**
     * DER NACHZUEGLER MUSS EINE KARTE MIT NENNWERT != 0 BEKOMMEN — sonst prueft dieser Fall die
     * falsche Sache.
     *
     * `FORM_CARD_VALUES` ist `[0, 2, 4, 8]`, und `getTeamFormCardOptions` filtert Karten mit Wert 0
     * ABSICHTLICH heraus (eine Karte, die nichts bewegt, ist kein Angebot). Der Wurf haengt am
     * `saveId`, und der traegt einen Zeitstempel — er faellt also in jedem Lauf anders aus.
     *
     * GEMESSEN, nicht vermutet: ueber 400 saveIds bekam derselbe Nachzuegler in 95 Faellen eine
     * positive Karte mit Wert 0 — **23,8 %**. Genau so oft war dieser Fall rot, und zwar seit er
     * geschrieben wurde. Er sah nach einem Last-Problem aus (er fiel im vollen Lauf und in der CI,
     * einzeln nie), war aber schlicht ein Viertel-Wuerfel.
     *
     * Deshalb wird der Nachzuegler jetzt so gewaehlt, dass seine positive Karte ueberhaupt
     * angeboten werden KANN — gerechnet mit derselben Produktionsfunktion, die auch die Heilung
     * benutzt, statt mit einer nachgebauten Formel. Dass eine 0-Karte NICHT angeboten wird, ist
     * eine eigene Zusicherung und steht als eigener Fall darunter.
     */
    const frei = afterGeneration.gameState.players.filter(
      (player) => !usedPlayerIds.has(player.id) && cardedClassNames.has(player.className),
    );
    const lateJoiner = frei.find((kandidat) => {
      const mitKandidat = {
        ...afterGeneration.gameState,
        rosters: [
          ...afterGeneration.gameState.rosters,
          { id: `probe-${kandidat.id}`, teamId, playerId: kandidat.id, joinedSeasonId: params.seasonId },
        ],
      } as typeof afterGeneration.gameState;
      const karten = buildGeneratedFormCardRecordsForSeason(mitKandidat, save.saveId, params.seasonId);
      const positiv = karten.find((karte) => karte.playerId === kandidat.id && karte.id.endsWith(":positive"));
      return positiv != null && positiv.cardValue !== 0;
    });
    expect(lateJoiner, "kein freier Spieler mit einer positiven Karte != 0 gefunden").toBeTruthy();
    afterGeneration.gameState.rosters.push({
      id: "form-card-late-joiner",
      teamId,
      playerId: lateJoiner!.id,
      contractLength: 3,
      salary: Math.round(lateJoiner!.salaryDemand),
      upkeep: Math.round(lateJoiner!.salaryDemand),
      purchasePrice: Math.round(lateJoiner!.marketValue),
      currentValue: Math.round(lateJoiner!.marketValue),
      roleTag: "bench",
      joinedSeasonId: afterGeneration.gameState.season.id,
    });
    persistence.saveSingleplayerState(save.saveId, afterGeneration.gameState);

    const lateJoinerCardId = `formcard:${params.seasonId}:${teamId}:${lateJoiner!.id}:positive`;
    // Vorbedingung des Bugs: die Karte ist NICHT im gespeicherten Bestand.
    expect(
      (persistence.getSaveById(save.saveId)!.gameState.seasonState.formCards ?? []).some(
        (card) => card.id === lateJoinerCardId,
      ),
    ).toBe(false);

    // 3) Der Ladepfad heilt sie und bietet sie im UI an — genau das sieht der Spieler im Dropdown.
    const context = loadLocalLegacyLineupContext(params);
    expect(context.ok).toBe(true);
    if (!context.ok) return;
    expect((context.context.formCards ?? []).some((card) => card.id === lateJoinerCardId)).toBe(true);

    // 4) Kern der Regression: Was das UI anbietet, muss das Speichern auch annehmen.
    const scheduleEntry = getSeasonDisciplineSchedule(save.gameState).find(
      (entry) => entry.matchdayId === params.matchdayId,
    );
    const saved = saveLocalLegacyFormCardPlan({
      ...params,
      disciplineSide: "d1",
      disciplineId: scheduleEntry?.discipline1?.disciplineId ?? null,
      primaryFormCardId: lateJoinerCardId,
      secondaryFormCardId: null,
    });
    expect(saved.errors).toEqual([]);
    expect(saved.ok).toBe(true);
    expect(saved.plans.some((plan) => plan.primaryFormCardId === lateJoinerCardId)).toBe(true);

    // Die geheilte Karte ist mitpersistiert — der nächste Speichervorgang prüft nicht erneut dagegen an.
    expect(
      (persistence.getSaveById(save.saveId)!.gameState.seasonState.formCards ?? []).some(
        (card) => card.id === lateJoinerCardId,
      ),
    ).toBe(true);
  });

  /**
   * DIE GEGENSEITE, und sie ist der Grund, warum der Fall darueber seinen Nachzuegler waehlen
   * muss statt ihn zu nehmen: eine Karte mit Nennwert 0 wird ABSICHTLICH nicht angeboten.
   *
   * `FORM_CARD_VALUES` ist `[0, 2, 4, 8]`; eine 0-Karte bewegt nichts und waere im Auswahlfeld
   * eine Zeile ohne Wirkung. `getTeamFormCardOptions` filtert sie deshalb (`cardValue !== 0`).
   *
   * Ohne diese Zusicherung waere die Regel unsichtbar — und genau das hat den Fall darueber zu
   * einem Viertel-Wuerfel gemacht: er nahm den ersten freien Spieler, und in 23,8 % der Laeufe
   * bekam der eine 0. Er sah dann aus wie ein Heilungs-Fehler, war aber die Regel bei der Arbeit.
   */
  it("bietet eine geheilte Karte mit Nennwert 0 bewusst NICHT an", () => {
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({ name: "Form Card Wert Null" });
    topUpRosterCoverage(save.saveId);
    const teamId = pickEligibleTeamId(save);
    const params = {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      matchdayId: save.gameState.matchdayState.matchdayId,
      teamId,
    };
    expect(generateLocalLegacyFormCardsForSeason(params).ok).toBe(true);

    const nachher = persistence.getSaveById(save.saveId)!;
    const belegt = new Set(nachher.gameState.rosters.map((entry) => entry.playerId));
    const klasseById = new Map(nachher.gameState.players.map((player) => [player.id, player.className]));
    const kartenKlassen = new Set(
      (nachher.gameState.seasonState.formCards ?? [])
        .map((card) => klasseById.get(card.playerId))
        .filter((value): value is string => Boolean(value)),
    );

    // Diesmal gezielt einen Spieler suchen, dessen positive Karte eine 0 traegt.
    const mitNull = nachher.gameState.players
      .filter((player) => !belegt.has(player.id) && kartenKlassen.has(player.className))
      .find((kandidat) => {
        const mitKandidat = {
          ...nachher.gameState,
          rosters: [
            ...nachher.gameState.rosters,
            { id: `probe-${kandidat.id}`, teamId, playerId: kandidat.id, joinedSeasonId: params.seasonId },
          ],
        } as typeof nachher.gameState;
        const karten = buildGeneratedFormCardRecordsForSeason(mitKandidat, save.saveId, params.seasonId);
        const positiv = karten.find((karte) => karte.playerId === kandidat.id && karte.id.endsWith(":positive"));
        return positiv != null && positiv.cardValue === 0;
      });
    expect(mitNull, "kein freier Spieler mit einer 0-Karte gefunden").toBeTruthy();

    nachher.gameState.rosters.push({
      id: "form-card-null-joiner",
      teamId,
      playerId: mitNull!.id,
      contractLength: 3,
      salary: Math.round(mitNull!.salaryDemand),
      upkeep: Math.round(mitNull!.salaryDemand),
      purchasePrice: Math.round(mitNull!.marketValue),
      currentValue: Math.round(mitNull!.marketValue),
      roleTag: "bench",
      joinedSeasonId: nachher.gameState.season.id,
    } as never);
    persistence.saveSingleplayerState(save.saveId, nachher.gameState);

    const kartenId = `formcard:${params.seasonId}:${teamId}:${mitNull!.id}:positive`;
    const context = loadLocalLegacyLineupContext(params);
    expect(context.ok).toBe(true);
    if (!context.ok) return;

    /**
     * Die Heilung LEGT die Karte an — sie taucht nur nicht im Angebot auf. Beides gehoert
     * geprueft, sonst liesse sich die Regel auch dadurch erfuellen, dass die Heilung gar nicht
     * laeuft.
     *
     * Geprueft wird am Ergebnis von `ensureLocalFormCardsForSeason`, nicht am gespeicherten
     * Bestand: der Lesepfad heilt IM SPEICHER und schreibt nicht zurueck. Das ist richtig so —
     * ein Ladevorgang soll nichts schreiben —, nur eben nichts, was man im Store nachsehen kann.
     * (Im Fall darueber landet die geheilte Karte in der Persistenz, weil dort GESPEICHERT wird.)
     */
    const geheilt = ensureLocalFormCardsForSeason(nachher.gameState, save.saveId, params.seasonId);
    const angelegt = (geheilt.seasonState.formCards ?? []).find((card) => card.id === kartenId);
    expect(angelegt, "die Heilung hat die Karte gar nicht erst angelegt").toBeTruthy();
    expect(angelegt!.cardValue).toBe(0);
    expect((context.context.formCards ?? []).some((card) => card.id === kartenId)).toBe(false);
  });

  // Audit S4 regression: lineup reads/writes must never silently fall back to "the active save"
  // (which, per co-op owner, could be a different player's save) when the requested saveId is
  // missing or unknown. A real, different save is made active first so a pre-fix silent fallback
  // would have a real (wrong) target to land on.
  describe("audit S4: unresolved saveId must never fall back to the active save", () => {
    it("loadLocalLegacyLineupContext rejects an unknown saveId instead of silently reading the active save", () => {
      const persistence = createPersistenceService();
      const activeSave = persistence.createFreshSeasonOneSave({ name: "Someone Else's Active Save" });

      expect(() =>
        loadLocalLegacyLineupContext({
          saveId: "save-does-not-exist",
          seasonId: activeSave.gameState.season.id,
          matchdayId: activeSave.gameState.matchdayState.matchdayId,
          teamId: activeSave.gameState.teams[0]!.teamId,
        }),
      ).toThrow(/could not be resolved/i);
    });

    it("saveLocalLegacyLineupDraft rejects a missing saveId and persists nothing", () => {
      const persistence = createPersistenceService();
      const activeSave = persistence.createFreshSeasonOneSave({ name: "Someone Else's Active Save" });
      const beforeSaveVersion = persistence.getSaveById(activeSave.saveId)?.gameState.saveVersion;

      expect(() =>
        saveLocalLegacyLineupDraft(
          {
            saveId: "",
            seasonId: activeSave.gameState.season.id,
            matchdayId: activeSave.gameState.matchdayState.matchdayId,
            teamId: activeSave.gameState.teams[0]!.teamId,
          },
          [],
        ),
      ).toThrow(/saveId is required/i);

      // The active save (the pre-fix silent-fallback target) must be completely untouched.
      expect(persistence.getSaveById(activeSave.saveId)?.gameState.saveVersion).toBe(beforeSaveVersion);
    });
  });
});
