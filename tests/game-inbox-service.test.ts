import { describe, expect, it } from "vitest";

import type { GameInboxItem, GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { buildGameInboxItems, filterGameInboxItems, filterInboxItemsByMode, getPrimaryInboxTask, groupInboxItemsForDisplay, isGameInboxChronicleItem, isGameInboxDecisionItem } from "@/lib/foundation/game-inbox-service";

function makeTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "M-M",
    shortCode: partial?.shortCode ?? "M-M",
    name: partial?.name ?? "Mayhem Mavericks",
    budget: partial?.budget ?? 325,
    cash: partial?.cash ?? 50,
    identityId: partial?.identityId ?? partial?.teamId ?? "M-M",
    humanControlled: partial?.humanControlled ?? true,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function makePlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: 50,
    marketValue: 10,
    salaryDemand: 2,
    pps: null,
    ovr: null,
    className: "Runner",
    race: "Human",
    alignment: "neutral",
    gender: "n/a",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    trainingMode: partial?.trainingMode ?? null,
    currentXP: partial?.currentXP ?? 0,
    ...partial,
  };
}

function makeGameState(partial?: Partial<GameState>): GameState {
  const teams = partial?.teams ?? [makeTeam()];
  const players = partial?.players ?? [makePlayer("p-1")];
  return {
    gamePhase: partial?.gamePhase ?? "season_active",
    season: {
      id: "season-3",
      name: "Season 3",
      year: 2028,
      currentMatchday: 1,
      matchdayIds: ["season-3-matchday-1"],
      ...(partial?.season ?? {}),
    },
    seasonState: {
      seasonId: "season-3",
      schedule: [],
      standings: {},
      teamControlSettings: {
        "M-M": {
          teamId: "M-M",
          controlMode: "manual",
          ownerId: "user_local",
          ownerSlot: "user",
          displayLabel: "Chris",
          aiLineupPreviewEnabled: false,
          aiLineupApplyEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
        },
      },
      ...(partial?.seasonState ?? {}),
    },
    matchdayState: {
      matchdayId: "season-3-matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
      ...(partial?.matchdayState ?? {}),
    },
    teams,
    scenarioMeta: partial?.scenarioMeta,
    teamIdentities: [],
    players,
    disciplines: [],
    rosters:
      partial?.rosters ?? [
        {
          id: "r-1",
          teamId: "M-M",
          playerId: "p-1",
          contractLength: 1,
          salary: 2,
          upkeep: 2,
          purchasePrice: 10,
          currentValue: 10,
          roleTag: "starter",
          joinedSeasonId: "season-3",
        },
      ],
    contracts: [],
    transferListings: [],
    transferHistory: partial?.transferHistory ?? [],
    playerProgressionEvents: partial?.playerProgressionEvents ?? [],
    gameInboxItems: partial?.gameInboxItems,
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: players.length,
      matchedRosterCount: partial?.rosters?.length ?? 1,
      teamCount: teams.length,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      officialTeamPendingCode: [],
      warnings: [],
    },
  };
}

function titles(items: GameInboxItem[]) {
  return items.map((item) => item.title);
}

describe("game inbox service", () => {
  it("creates tasks for missing lineup, expiring contracts and missing training (XP-System abgeschafft: kein XP-Task mehr)", () => {
    const gameState = makeGameState({
      players: [makePlayer("p-1", { currentXP: 25, trainingMode: null })],
    });

    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });

    expect(titles(items)).toContain("Lineup fehlt");
    // XP-System abgeschafft: Trotz currentXP=25 wird kein „XP verfügbar"-Task mehr erzeugt.
    expect(titles(items)).not.toContain("XP verfügbar");
    expect(titles(items)).toContain("Verträge laufen aus");
    expect(titles(items)).toContain("Training nicht gesetzt");
  });

  it("does not create lineup tasks for ai-controlled teams", () => {
    const gameState = makeGameState({
      teams: [makeTeam({ teamId: "M-M", humanControlled: false })],
      seasonState: {
        seasonId: "season-3",
        schedule: [],
        standings: {},
        teamControlSettings: {
          "M-M": {
            teamId: "M-M",
            controlMode: "ai",
            ownerId: "ai",
            ownerSlot: "ai",
            displayLabel: "AI",
            aiLineupPreviewEnabled: true,
            aiLineupApplyEnabled: true,
            aiLineupAutoApplyEnabled: true,
            aiTransferPreviewEnabled: true,
            aiTransferAutoApplyEnabled: true,
            aiSellPreviewEnabled: true,
            aiSellAutoApplyEnabled: true,
          },
        },
      },
    });

    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    expect(items.some((item) => item.itemId.startsWith("lineup_missing:"))).toBe(false);
  });

  it("creates a transfer candidate task from real roster value, contract and cash pressure", () => {
    const gameState = makeGameState({
      teams: [makeTeam({ cash: -5 })],
      players: [makePlayer("p-1", { name: "Sage", marketValue: 32, displayMarketValue: 32 })],
      rosters: [
        {
          id: "r-1",
          teamId: "M-M",
          playerId: "p-1",
          contractLength: 1,
          salary: 2,
          upkeep: 2,
          purchasePrice: 20,
          currentValue: 32,
          roleTag: "starter",
          joinedSeasonId: "season-3",
        },
      ],
    });

    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    const task = items.find((item) => item.itemId.startsWith("transfer_candidate:"));

    expect(task?.title).toBe("Spieler verkaufen");
    expect(task?.severity).toBe("critical");
    expect(task?.targetView).toBe("teams");
  });

  it("creates facility warning when upkeep is unaffordable and upgrade task when cash allows", () => {
    const gameState = makeGameState({
      teams: [makeTeam({ cash: 2 })],
      seasonState: {
        seasonId: "season-3",
        schedule: [],
        standings: {},
        teamFacilities: {
          "M-M": {
            facilities: {
              training_center: { level: 5, enabled: true },
            },
          },
        },
      },
    });

    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    expect(titles(items)).toContain("Facility-Unterhalt gefährdet");
  });

  it("creates transfer news from real transfer history", () => {
    const gameState = makeGameState({
      transferHistory: [
        {
          id: "transfer-1",
          playerId: "p-1",
          seasonId: "season-3",
          matchdayId: "season-3-matchday-1",
          seasonLabel: "Season 3",
          transferType: "buy",
          fromTeamId: null,
          toTeamId: "M-M",
          fee: 10,
          salary: 2,
          marketValue: 10,
          remainingContractLength: 2,
          happenedAt: "2026-06-13T10:00:00.000Z",
        },
      ],
    });

    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    expect(titles(items)).toContain("Transfer gekauft");
  });

  it("creates story cards only from real result, snapshot or progression sources", () => {
    const baseState = makeGameState();
    const emptyItems = buildGameInboxItems({ gameState: baseState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    expect(emptyItems.some((item) => item.source.startsWith("story:"))).toBe(false);

    const gameState = makeGameState({
      playerProgressionEvents: [
        {
          eventId: "xp-1",
          seasonId: "season-3",
          teamId: "M-M",
          playerId: "p-1",
          upgrades: [],
          xpSpent: 20,
          progressionSnapshotBefore: {
            attributes: {},
            disciplineRatings: { d1: 10, d2: 20, d3: 30 },
            ovr: null,
            mvs: null,
            marketValue: null,
            salary: null,
            bracket: null,
          },
          progressionSnapshotAfter: {
            attributes: {},
            disciplineRatings: { d1: 11, d2: 21, d3: 31 },
            ovr: null,
            mvs: null,
            marketValue: null,
            salary: null,
            bracket: null,
            marketValuePreview: null,
            salaryPreview: null,
            bracketPreview: null,
          },
          timestamp: "2026-06-13T10:00:00.000Z",
          source: "manual_season_end_xp_spend",
        },
      ],
    });

    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    expect(items.some((item) => item.title === "Story Card: XP zeigt Wirkung")).toBe(true);
  });

  it("keeps dismissed stored status for deterministic generated items", () => {
    // Hinweis (#43): "lineup_missing" ist inzwischen ein Auto-Resolve-Item
    // (status wird live aus dem Spielstand abgeleitet, siehe Test weiter
    // unten) und ignoriert daher bewusst gespeicherten Status. Dieser Test
    // prueft weiterhin den generischen Mechanismus — dass ein gespeicherter
    // Status eine Regeneration ueberlebt — anhand eines Items, das echtes
    // Nutzer-Urteil braucht (welchen Vertrag man verlaengert) und deshalb
    // NICHT auto-resolved.
    const itemId = "contracts_expiring:save-1:season-3:M-M";
    const gameState = makeGameState({
      gameInboxItems: [
        {
          itemId,
          saveId: "save-1",
          seasonId: "season-3",
          category: "contract",
          severity: "warning",
          title: "Verträge laufen aus",
          description: "dismissed earlier",
          targetView: "teams",
          targetParams: {},
          status: "dismissed",
          createdAt: "2026-06-13T10:00:00.000Z",
          source: "test",
        },
      ],
    });

    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    expect(items.find((item) => item.itemId === itemId)?.status).toBe("dismissed");
    expect(filterGameInboxItems(items, { includeDismissed: false }).some((item) => item.itemId === itemId)).toBe(false);
  });

  it("auto-resolves condition-based checklist items instead of requiring a manual click (#43)", () => {
    const itemId = "lineup_missing:save-1:season-3:season-3-matchday-1:M-M";

    // Bedingung erfuellt (Lineup ist vollstaendig gesetzt): das Item MUSS
    // als "done" erscheinen, ganz ohne Klick auf "Erledigt".
    const readyState = makeGameState({
      seasonState: {
        seasonId: "season-3",
        schedule: [],
        standings: {},
        lineupDrafts: [
          {
            seasonId: "season-3",
            matchdayId: "season-3-matchday-1",
            teamId: "M-M",
            entries: Array.from({ length: 9 }, (_, index) => ({
              slotKey: `slot-${index}`,
              playerId: `p-${index + 1}`,
              activePlayerId: `ap-${index + 1}`,
            })),
            submittedAt: null,
          },
        ],
      },
      players: Array.from({ length: 9 }, (_, index) => makePlayer(`p-${index + 1}`)),
      rosters: Array.from({ length: 9 }, (_, index) => ({
        teamId: "M-M",
        playerId: `p-${index + 1}`,
        contractLength: 2,
        salary: 2,
      })),
    });
    const readyItems = buildGameInboxItems({ gameState: readyState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    const doneItem = readyItems.find((item) => item.itemId === itemId);
    expect(doneItem?.status).toBe("done");
    expect(doneItem?.title).toBe("Lineup gesetzt");

    // Umgekehrt (Regressionstest fuer den eigentlichen #43-Bug): ein
    // frueher manuell gesetzter "done"-Status darf eine WEITERHIN offene
    // Bedingung nicht verstecken — sonst koennte man den Reminder
    // wegklicken, ohne die Aufgabe tatsaechlich zu erledigen.
    const missingState = makeGameState({
      gameInboxItems: [
        {
          itemId,
          saveId: "save-1",
          seasonId: "season-3",
          category: "task",
          severity: "info",
          title: "Lineup gesetzt",
          description: "manually marked done earlier, but lineup is empty again",
          targetView: "lineup",
          targetParams: {},
          status: "done",
          createdAt: "2026-06-13T10:00:00.000Z",
          source: "test",
        },
      ],
    });
    const missingItems = buildGameInboxItems({ gameState: missingState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    const openItem = missingItems.find((item) => item.itemId === itemId);
    expect(openItem?.status).toBe("open");
    expect(openItem?.title).toBe("Lineup fehlt");
  });

	  it("filters by participant/owner teams", () => {
    const gameState = makeGameState({
      teams: [makeTeam({ teamId: "M-M", shortCode: "M-M" }), makeTeam({ teamId: "P-C", shortCode: "P-C", humanControlled: true })],
      players: [makePlayer("p-1"), makePlayer("p-2")],
      rosters: [
        { id: "r-1", teamId: "M-M", playerId: "p-1", contractLength: 2, salary: 2, upkeep: 2, roleTag: "starter", joinedSeasonId: "season-3" },
        { id: "r-2", teamId: "P-C", playerId: "p-2", contractLength: 2, salary: 2, upkeep: 2, roleTag: "starter", joinedSeasonId: "season-3" },
      ],
      scenarioMeta: {
        scenarioType: "manager_multiplayer_test",
        label: "Room",
        createdAt: "2026-06-13T10:00:00.000Z",
        teamOwnership: [
          { teamId: "M-M", controllerType: "human", userId: "user_chris", participantId: "participant-chris", ownerDisplayName: "Chris" },
          { teamId: "P-C", controllerType: "human", userId: "user_franky", participantId: "participant-franky", ownerDisplayName: "Franky" },
        ],
      },
    });

    const chrisItems = buildGameInboxItems({ gameState, saveId: "save-1", activeOwnerId: "user_local" });
    const frankyItems = buildGameInboxItems({ gameState, saveId: "save-1", activeOwnerId: "franky_remote_placeholder" });

    expect(chrisItems.some((item) => item.teamId === "M-M")).toBe(true);
    expect(chrisItems.some((item) => item.teamId === "P-C")).toBe(false);
	    expect(frankyItems.some((item) => item.teamId === "P-C")).toBe(true);
	    expect(frankyItems.some((item) => item.teamId === "M-M")).toBe(false);
	  });

	  it("allows host mode to inspect all team tasks", () => {
	    const gameState = makeGameState({
	      teams: [makeTeam({ teamId: "M-M", shortCode: "M-M" }), makeTeam({ teamId: "P-C", shortCode: "P-C", humanControlled: true })],
	      players: [makePlayer("p-1"), makePlayer("p-2")],
	      rosters: [
	        { id: "r-1", teamId: "M-M", playerId: "p-1", contractLength: 2, salary: 2, upkeep: 2, roleTag: "starter", joinedSeasonId: "season-3" },
	        { id: "r-2", teamId: "P-C", playerId: "p-2", contractLength: 2, salary: 2, upkeep: 2, roleTag: "starter", joinedSeasonId: "season-3" },
	      ],
	    });

	    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeOwnerId: "user_local", hostMode: true });

	    expect(items.some((item) => item.teamId === "M-M")).toBe(true);
	    expect(items.some((item) => item.teamId === "P-C")).toBe(true);
	  });

  it("creates sponsor choice task for manual teams without sponsor contract", () => {
    const gameState = makeGameState();
    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    const sponsorTask = items.find((item) => item.itemId.startsWith("sponsor_choice_missing:"));
    expect(sponsorTask?.title).toBe("Sponsor wählen");
    expect(sponsorTask?.targetParams).toEqual({ team: "M-M", panel: "sponsor-choice" });
  });

  it("auto-resolves the sponsor choice task (status done, not silently absent) once a contract exists (#43)", () => {
    // Vorher: das Item verschwand spurlos, sobald ein Sponsor gewaehlt war
    // (kein "erledigt"-Signal fuer den Nutzer). Jetzt bleibt es als
    // erledigtes Item bestehen (sichtbar ueber "Erledigte anzeigen"), taucht
    // aber nicht mehr offen/kritisch in der Aktionen-Ansicht auf.
    const gameState = makeGameState({
      seasonState: {
        seasonId: "season-3",
        schedule: [],
        standings: {},
        sponsorContractsByTeamId: {
          "M-M": {
            seasonId: "season-3",
            teamId: "M-M",
            offerId: "offer-1",
            archetype: "security",
            name: "Sicherheitspartner AG",
            chosenAt: "2026-06-25T00:00:00.000Z",
            components: [],
            payouts: { baseFirstPaid: true },
          },
        },
      },
    });
    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    const sponsorTask = items.find((item) => item.itemId.startsWith("sponsor_choice_missing:"));
    expect(sponsorTask?.status).toBe("done");
    expect(sponsorTask?.title).toBe("Sponsor gewählt");
    expect(items.some((item) => item.itemId.startsWith("sponsor_choice_missing:") && item.status === "open")).toBe(false);
  });

  it("warns when negative form cards remain unused before season end", () => {
    const gameState = makeGameState({
      seasonState: {
        seasonId: "season-3",
        schedule: [],
        standings: {},
        formCards: [
          {
            id: "card-negative",
            saveId: "save-1",
            seasonId: "season-3",
            teamId: "M-M",
            playerId: "p-1",
            playerName: "p-1",
            cardColor: "red",
            cardValue: -4,
            createdAt: "2026-06-12T00:00:00.000Z",
          },
        ],
      },
    });
    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    const negativeTask = items.find((item) => item.itemId.startsWith("formcards_negative_open:"));
    expect(negativeTask?.title).toBe("Negative Formkarten offen");
    expect(negativeTask?.description).toContain("Strafpunkte");
  });

  it("separates decision and chronicle inbox items", () => {
    const gameState = makeGameState({
      transferHistory: [
        {
          id: "transfer-1",
          playerId: "p-1",
          fromTeamId: "P-C",
          toTeamId: "M-M",
          seasonId: "season-3",
          matchdayId: "season-3-matchday-1",
          transferType: "buy",
          fee: 10,
          salary: 2,
          happenedAt: "2026-06-25T00:00:00.000Z",
        },
      ],
    });
    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    const decisions = filterInboxItemsByMode(items, "decisions");
    const chronicle = filterInboxItemsByMode(items, "chronicle");

    expect(decisions.some((item) => item.itemId.startsWith("sponsor_choice_missing:"))).toBe(true);
    expect(chronicle.some((item) => item.source === "transfer_history")).toBe(true);
    expect(decisions.some((item) => item.source === "transfer_history")).toBe(false);
    expect(isGameInboxDecisionItem(decisions[0]!)).toBe(true);
    expect(isGameInboxChronicleItem(chronicle.find((item) => item.source === "transfer_history")!)).toBe(true);
  });

  it("keeps progression and facility news out of decisions and groups them for display", () => {
    const gameState = makeGameState({
      playerProgressionEvents: [
        {
          eventId: "prog-1",
          teamId: "M-M",
          playerId: "p-1",
          seasonId: "season-3",
          upgrades: [{ attribute: "pow", delta: 1 }],
          xpSpent: 0,
          timestamp: "2026-06-25T00:00:00.000Z",
        },
        {
          eventId: "prog-2",
          teamId: "M-M",
          playerId: "p-2",
          seasonId: "season-3",
          upgrades: [{ attribute: "spe", delta: 1 }, { attribute: "men", delta: 1 }],
          xpSpent: 0,
          timestamp: "2026-06-25T01:00:00.000Z",
        },
      ],
      seasonState: {
        ...(makeGameState().seasonState ?? {}),
        facilityEvents: [
          {
            eventId: "fac-1",
            teamId: "M-M",
            seasonId: "season-3",
            facilityId: "scouting",
            previousLevel: 1,
            nextLevel: 2,
            timestamp: "2026-06-25T02:00:00.000Z",
          },
          {
            eventId: "fac-2",
            teamId: "M-M",
            seasonId: "season-3",
            facilityId: "training",
            previousLevel: 2,
            nextLevel: 3,
            timestamp: "2026-06-25T03:00:00.000Z",
          },
        ],
      },
    });
    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    const decisions = filterInboxItemsByMode(items, "decisions");
    const chronicle = filterInboxItemsByMode(items, "chronicle");

    expect(decisions.some((item) => item.source === "player_progression_events")).toBe(false);
    expect(decisions.some((item) => item.source === "facility_events")).toBe(false);
    expect(chronicle.some((item) => item.source === "player_progression_events")).toBe(true);

    const grouped = groupInboxItemsForDisplay(chronicle);
    expect(grouped.some((item) => item.itemId.startsWith("grouped:player_progression_events:"))).toBe(true);
    expect(grouped.some((item) => item.title === "2 XP-Upgrades durchgeführt")).toBe(true);
    expect(grouped.some((item) => item.title === "2 Facility-Events")).toBe(true);
  });

  it("creates health inbox tasks for injured and fatigued players", () => {
    const gameState = makeGameState({
      season: {
        id: "season-3",
        name: "Season 3",
        year: 2028,
        currentMatchday: 2,
        matchdayIds: ["season-3-matchday-1", "season-3-matchday-2"],
      },
      matchdayState: {
        matchdayId: "season-3-matchday-2",
        status: "preparation",
        pendingTeamIds: [],
        resolvedFixtureIds: ["season-3-matchday-1"],
      },
      players: [
        makePlayer("p-1", { fatigue: 88, traitsPositive: ["Ambitious", "Motivated"] }),
        makePlayer("p-2", { fatigue: 20 }),
      ],
      rosters: [
        { id: "r-1", teamId: "M-M", playerId: "p-1", contractLength: 2, salary: 2, upkeep: 2, roleTag: "starter", joinedSeasonId: "season-3" },
        { id: "r-2", teamId: "M-M", playerId: "p-2", contractLength: 2, salary: 2, upkeep: 2, roleTag: "bench", joinedSeasonId: "season-3" },
      ],
      seasonState: {
        seasonId: "season-3",
        schedule: [],
        standings: {},
        teamControlSettings: {
          "M-M": {
            teamId: "M-M",
            controlMode: "manual",
            ownerId: "user_local",
            ownerSlot: "user",
            displayLabel: "Chris",
            aiLineupPreviewEnabled: false,
            aiLineupApplyEnabled: false,
            aiLineupAutoApplyEnabled: false,
            aiTransferPreviewEnabled: false,
            aiTransferAutoApplyEnabled: false,
            aiSellPreviewEnabled: false,
            aiSellAutoApplyEnabled: false,
          },
        },
        playerAvailabilityState: [
          {
            playerId: "p-2",
            teamId: "M-M",
            fatigue: 20,
            injuryStatus: "injured",
            injuryUntilMatchday: "season-3-matchday-2",
            injuredAtSeasonId: "season-3",
            injuredAtMatchdayId: "season-3-matchday-1",
            injuryReason: "fatigue_over_30_after_matchday_use",
          },
        ],
        playerDisciplinePerformances: [
          { playerId: "p-1", teamId: "M-M", seasonId: "season-3", appearances: 8 },
        ],
      },
    });

    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    const injuredTask = items.find((item) => item.itemId.startsWith("player_injured:"));
    const fatigueTask = items.find((item) => item.itemId.startsWith("player_fatigue_risk:"));

    expect(injuredTask?.severity).toBe("critical");
    expect(injuredTask?.targetView).toBe("lineup");
    expect(fatigueTask?.title).toMatch(/Verletzungsrisiko|Ermüdung/);
    expect(isGameInboxDecisionItem(injuredTask!)).toBe(true);
    expect(isGameInboxDecisionItem(fatigueTask!)).toBe(true);
  });

  it("creates lineup_not_submitted task when lineup is complete but not submitted", () => {
    const gameState = makeGameState({
      seasonState: {
        seasonId: "season-3",
        schedule: [],
        standings: {},
        lineupDrafts: [
          {
            seasonId: "season-3",
            matchdayId: "season-3-matchday-1",
            teamId: "M-M",
            entries: Array.from({ length: 9 }, (_, index) => ({
              slotKey: `slot-${index}`,
              playerId: `p-${index + 1}`,
              activePlayerId: `ap-${index + 1}`,
            })),
            submittedAt: null,
          },
        ],
      },
      players: Array.from({ length: 9 }, (_, index) => makePlayer(`p-${index + 1}`)),
      rosters: Array.from({ length: 9 }, (_, index) => ({
        teamId: "M-M",
        playerId: `p-${index + 1}`,
        contractLength: 2,
        salary: 2,
      })),
    });
    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    const task = items.find((item) => item.itemId.startsWith("lineup_not_submitted:"));
    expect(task?.title).toBe("Lineup bestätigen");
    expect(task?.severity).toBe("critical");
  });

  it("prioritizes critical health tasks in getPrimaryInboxTask", () => {
    const items = [
      {
        itemId: "info-task",
        saveId: "save-1",
        seasonId: "season-3",
        category: "task" as const,
        severity: "info" as const,
        title: "Info Task",
        description: "Later",
        targetView: "home",
        targetParams: {},
        source: "lineup_drafts",
        status: "open" as const,
        createdAt: "2026-06-12T00:00:00.000Z",
      },
      {
        itemId: "injury-task",
        saveId: "save-1",
        seasonId: "season-3",
        category: "warning" as const,
        severity: "critical" as const,
        title: "Verletzter Spieler",
        description: "Now",
        targetView: "lineup",
        targetParams: {},
        source: "player_health_injury",
        status: "open" as const,
        createdAt: "2026-06-12T00:00:00.000Z",
      },
    ];
    expect(getPrimaryInboxTask(items)?.itemId).toBe("injury-task");
  });
});
