import { describe, expect, it } from "vitest";

import { buildAiTeamManagementPreview } from "@/lib/ai/ai-team-management-preview-service";
import type { GameState, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

function buildTeam(overrides: Partial<Team> = {}): Team {
  return {
    teamId: "T-1",
    shortCode: "T1",
    name: "Test Team",
    budget: 50,
    cash: 50,
    identityId: "id-1",
    humanControlled: false,
    rosterLimit: 20,
    rosterMinTarget: 4,
    rosterOptTarget: 6,
    ...overrides,
  };
}

function buildIdentity(overrides: Partial<TeamIdentity> = {}): TeamIdentity {
  return {
    teamId: "T-1",
    playerType: "balanced",
    pow: 70,
    spe: 60,
    men: 55,
    soc: 50,
    ambition: 60,
    finances: 60,
    boardConfidence: 60,
    harmony: 60,
    manners: 60,
    popularity: 60,
    cooperation: 60,
    playerMin: 4,
    playerOpt: 6,
    ...overrides,
  };
}

function buildPlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    rating: 60,
    marketValue: 20,
    salaryDemand: 5,
    displayMarketValue: 20,
    displaySalary: 5,
    className: "Hero",
    race: "Human",
    alignment: "neutral",
    gender: "m",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 60, spe: 60, men: 60, soc: 60 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 20,
    form: 50,
    potential: 50,
    ...overrides,
  };
}

function buildGameState(input?: {
  team?: Partial<Team>;
  identity?: Partial<TeamIdentity>;
  players?: Player[];
  injuries?: string[];
}) {
  const team = buildTeam(input?.team);
  const identity = buildIdentity(input?.identity);
  const players = input?.players ?? [
    buildPlayer("p1"),
    buildPlayer("p2"),
    buildPlayer("p3"),
    buildPlayer("p4"),
  ];
  return {
    gamePhase: "season_end_management",
    season: { id: "season-1", name: "Season 1", currentMatchday: 1 },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      disciplineSchedule: [],
      standings: {
        "T-1": { points: 0, rank: 12, sponsorSeason: 6 },
      },
      teamControlSettings: {
        "T-1": {
          teamId: "T-1",
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupAutoApplyEnabled: true,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
        },
      },
      teamFacilities: {
        "T-1": {
          facilities: {
            training_center: { level: 1, enabled: true },
            recovery_center: { level: 0, enabled: false },
            scouting_office: { level: 0, enabled: false },
            analytics_room: { level: 0, enabled: false },
            fan_shop: { level: 0, enabled: false },
            arena_upgrade: { level: 0, enabled: false },
            academy: { level: 0, enabled: false },
            specialist_wing: { level: 0, enabled: false },
          },
        },
      },
      playerAvailabilityState: (input?.injuries ?? []).map((playerId) => ({
        playerId,
        teamId: "T-1",
        seasonId: "season-1",
        status: "injured",
        fatigue: 90,
        injuryNote: "injured",
      })),
      seasonSnapshots: [],
    },
    matchdayState: {
      matchdayId: "m1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [team],
    teamIdentities: [identity],
    players,
    disciplines: [],
    rosters: players.map((player, index) => ({
      id: `r${index + 1}`,
      teamId: "T-1",
      playerId: player.id,
      contractLength: 2,
      salary: 5,
      upkeep: 5,
      roleTag: index < 2 ? "starter" : "prospect",
      joinedSeasonId: "season-1",
    })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerMoraleState: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  } as unknown as GameState;
}

describe("ai team management preview service", () => {
  it("prioritizes recovery for high fatigue and injuries", () => {
    const gameState = buildGameState({
      players: [
        buildPlayer("p1", { fatigue: 92 }),
        buildPlayer("p2", { fatigue: 88 }),
        buildPlayer("p3", { fatigue: 74 }),
        buildPlayer("p4", { fatigue: 70 }),
        buildPlayer("p5", { fatigue: 68 }),
        buildPlayer("p6", { fatigue: 65 }),
      ],
      injuries: ["p1", "p2"],
      team: { cash: 280 },
    });

    const preview = buildAiTeamManagementPreview(gameState, "T-1");

    expect(preview?.trainingPlan.selectedTrainingFocus).toBe("RECOVERY");
    expect(preview?.trainingPlan.selectedTrainingIntensity).toBe("light");
    expect(preview?.buildingPlan.find((row) => row.buildingType === "recovery_center")?.score ?? 0).toBeGreaterThan(40);
    expect(preview?.buildingPlan.find((row) => row.buildingType === "recovery_center")?.action).toBe("build_new");
  });

  it("switches to light training when a single injury or elevated injury risk is present", () => {
    const injuredOnly = buildGameState({
      injuries: ["p1"],
      players: [
        buildPlayer("p1", { fatigue: 35 }),
        buildPlayer("p2", { fatigue: 30 }),
        buildPlayer("p3", { fatigue: 28 }),
        buildPlayer("p4", { fatigue: 25 }),
      ],
    });

    expect(buildAiTeamManagementPreview(injuredOnly, "T-1")?.trainingPlan.selectedTrainingIntensity).toBe("light");
    expect(buildAiTeamManagementPreview(injuredOnly, "T-1")?.trainingPlan.selectedTrainingFocus).toBe("RECOVERY");

    const highRisk = buildGameState({
      players: [
        buildPlayer("p1", { fatigue: 78 }),
        buildPlayer("p2", { fatigue: 76 }),
        buildPlayer("p3", { fatigue: 74 }),
        buildPlayer("p4", { fatigue: 20 }),
      ],
    });

    expect(buildAiTeamManagementPreview(highRisk, "T-1")?.trainingPlan.selectedTrainingIntensity).toBe("light");
  });

  it("blocks hard training after heavy previous season injury load", () => {
    const players = [
      buildPlayer("p1", {
        fatigue: 0,
        injuryHistory: Array.from({ length: 6 }, (_, index) => ({
          eventId: `inj-${index}`,
          seasonId: "season-1",
          matchdayId: "md-1",
          teamId: "T-1",
          fatigueBefore: 72,
          riskPercent: 18,
          unavailableUntil: null,
          matchdaysMissed: 1,
          injuryRecoveryPct: 50,
          timestamp: new Date().toISOString(),
        })),
      }),
      buildPlayer("p2", {
        fatigue: 0,
        injuryHistory: Array.from({ length: 5 }, (_, index) => ({
          eventId: `inj-p2-${index}`,
          seasonId: "season-1",
          matchdayId: "md-1",
          teamId: "T-1",
          fatigueBefore: 68,
          riskPercent: 16,
          unavailableUntil: null,
          matchdaysMissed: 1,
          injuryRecoveryPct: 50,
          timestamp: new Date().toISOString(),
        })),
      }),
      buildPlayer("p3", { fatigue: 0 }),
      buildPlayer("p4", { fatigue: 0 }),
    ];
    const gameState = {
      ...buildGameState({ identity: { ambition: 72 }, players }),
      season: { id: "season-2", name: "Season 2", currentMatchday: 1 },
      seasonState: {
        ...buildGameState({ players }).seasonState,
        seasonId: "season-2",
        seasonSnapshots: [{ seasonId: "season-1", finalStandings: [] }],
        playerAvailabilityState: [],
      },
    } as ReturnType<typeof buildGameState>;

    const preview = buildAiTeamManagementPreview(gameState, "T-1");
    expect(preview?.trainingPlan.selectedTrainingIntensity).not.toBe("hard");
    expect(preview?.trainingPlan.playerTrainingClassPlans.length).toBeGreaterThan(0);
    expect(preview?.buildingPlan.find((row) => row.buildingType === "recovery_center")?.score ?? 0).toBeGreaterThan(35);
  });

  it("prioritizes training and hard intensity for young rebuild teams", () => {
    const gameState = buildGameState({
      identity: { ambition: 72, finances: 55 },
      players: [
        buildPlayer("p1", { potential: 82, fatigue: 20 }),
        buildPlayer("p2", { potential: 84, fatigue: 18 }),
        buildPlayer("p3", { potential: 78, fatigue: 22 }),
        buildPlayer("p4", { potential: 80, fatigue: 25 }),
        buildPlayer("p5", { potential: 76, fatigue: 24 }),
        buildPlayer("p6", { potential: 74, fatigue: 26 }),
        buildPlayer("p7", { potential: 72, fatigue: 28 }),
      ],
      team: { cash: 70, rosterOptTarget: 6 },
    });

    const preview = buildAiTeamManagementPreview(gameState, "T-1");

    expect(preview?.profile.strategicIntent).toBe("youth_development");
    expect(preview?.trainingPlan.selectedTrainingIntensity).toBe("hard");
    expect(preview?.buildingPlan.find((row) => row.buildingType === "training_center")?.score ?? 0).toBeGreaterThan(30);
  });

  it("protects maintenance and blocks luxury spending for cash-poor teams", () => {
    const gameState = buildGameState({
      team: { cash: 8 },
      identity: { finances: 70 },
    });

    const preview = buildAiTeamManagementPreview(gameState, "T-1");

    expect(preview?.budgetPlan.bucketsBefore.maintenanceBudget ?? 0).toBeGreaterThan(0);
    expect(preview?.budgetPlan.warnings).toContain("maintenance_priority_over_upgrades");
    const economyBuildings = preview?.buildingPlan.filter((row) => ["fan_shop", "arena_upgrade"].includes(row.buildingType)) ?? [];
    expect(economyBuildings.every((row) => row.action !== "build_new" && row.action !== "upgrade_existing")).toBe(true);
  });

  it("allocates all post-reserve free cash to transfer and building buckets", () => {
    const gameState = buildGameState({
      team: { cash: 200 },
      players: [
        buildPlayer("p1"),
        buildPlayer("p2"),
        buildPlayer("p3"),
        buildPlayer("p4"),
        buildPlayer("p5"),
        buildPlayer("p6"),
      ],
    });

    const preview = buildAiTeamManagementPreview(gameState, "T-1");
    const buckets = preview?.budgetPlan.bucketsBefore;
    const freeCash = preview?.budgetPlan.freeCashAfterReserves ?? 0;

    expect((buckets?.transferBudget ?? 0) + (buckets?.buildingBudget ?? 0)).toBeCloseTo(freeCash, 0);
    expect(freeCash).toBeGreaterThan(0);
  });

  function developerStrategyProfile(teamId: string) {
    return {
      teamId,
      strategyVersion: "v1-local",
      strategySummary: "Teacher/Mentor development core that invests in training and prospects.",
      buyStyle: "Develops prospects around teachers and mentors.",
      preferredArchetypes: ["teacher", "mentor", "leader", "captain"],
      secondaryArchetypes: [] as string[],
      preferredClasses: ["Teacher"],
      prefersDepth: "high" as const,
      bias: {
        cashPriority: 6,
        valuePriority: 6,
        starPriority: 5,
        riskTolerance: 4,
        wageSensitivity: 5,
        sellForProfitAggression: 4,
        shortContractPreference: 5,
        longContractPreference: 6,
        loyaltyBias: 8,
        harmonyStrictness: 8,
        rosterDepthPreference: 5,
        eliteSmallRosterPreference: 5,
      },
    };
  }

  function buildDeveloperGameState(cash: number) {
    // Six senior (non-youth) players — the developer signal must come from IDENTITY, not a youth-heavy
    // roster — and a training_center that is not yet built.
    const players = Array.from({ length: 6 }, (_, index) => buildPlayer(`p${index + 1}`, { potential: 45 }));
    const gameState = buildGameState({
      team: { cash, rosterOptTarget: 6, rosterMinTarget: 4 },
      identity: { pow: 55, spe: 55, men: 55, soc: 55, ambition: 6, playerOpt: 6, playerMin: 4 },
      players,
    }) as ReturnType<typeof buildGameState>;
    gameState.seasonState.teamStrategyProfiles = {
      "T-1": developerStrategyProfile("T-1"),
    } as unknown as GameState["seasonState"]["teamStrategyProfiles"];
    gameState.seasonState.teamFacilities = {
      "T-1": {
        facilities: {
          training_center: { level: 0, enabled: false },
          recovery_center: { level: 0, enabled: false },
          scouting_office: { level: 0, enabled: false },
          analytics_room: { level: 0, enabled: false },
          fan_shop: { level: 0, enabled: false },
          arena_upgrade: { level: 0, enabled: false },
          academy: { level: 0, enabled: false },
          specialist_wing: { level: 0, enabled: false },
        },
      },
    } as unknown as GameState["seasonState"]["teamFacilities"];
    return gameState;
  }

  it("a nurturing/developer-identity team with surplus cash builds a training center early (no youth overhang needed)", () => {
    const gameState = buildDeveloperGameState(140);
    const preview = buildAiTeamManagementPreview(gameState, "T-1");
    const trainingCenter = preview?.buildingPlan.find((row) => row.buildingType === "training_center");
    expect(trainingCenter?.action).toBe("build_new");
    expect(trainingCenter?.reasonsPositive).toContain("Entwickler-/Mentor-Identität priorisiert Trainings-Infrastruktur");
  });

  it("the same developer-identity team does NOT build a training center when cash-tight", () => {
    const gameState = buildDeveloperGameState(9);
    const preview = buildAiTeamManagementPreview(gameState, "T-1");
    const trainingCenter = preview?.buildingPlan.find((row) => row.buildingType === "training_center");
    expect(trainingCenter?.action).not.toBe("build_new");
    expect(trainingCenter?.action).not.toBe("upgrade_existing");
  });

  it("a commercial, cash-rich team scores income buildings higher than a cash-tight one (surplus-driven sink)", () => {
    const rich = buildDeveloperGameState(160);
    const tight = buildDeveloperGameState(9);
    const richFanShop = buildAiTeamManagementPreview(rich, "T-1")?.buildingPlan.find((row) => row.buildingType === "fan_shop");
    const tightFanShop = buildAiTeamManagementPreview(tight, "T-1")?.buildingPlan.find((row) => row.buildingType === "fan_shop");
    expect(richFanShop?.score ?? 0).toBeGreaterThan(tightFanShop?.score ?? 0);
    // The cash-tight team must not commit to an income build it cannot sustain.
    expect(tightFanShop?.action).not.toBe("build_new");
    expect(tightFanShop?.action).not.toBe("upgrade_existing");
  });

  it("merges liquidity reserve during rebuild and caps building by cash rank", () => {
    const poorTeam = buildTeam({ teamId: "T-POOR", shortCode: "PO", cash: 40 });
    const midTeam = buildTeam({ teamId: "T-MID", shortCode: "MD", cash: 80 });
    const richTeam = buildTeam({ teamId: "T-RICH", shortCode: "RI", cash: 140 });
    const players = [buildPlayer("p1"), buildPlayer("p2"), buildPlayer("p3")];
    const gameState = {
      ...buildGameState({ team: poorTeam, players }),
      teams: [poorTeam, midTeam, richTeam],
      teamIdentities: [
        buildIdentity({ teamId: "T-POOR", playerOpt: 6 }),
        buildIdentity({ teamId: "T-MID", playerOpt: 6 }),
        buildIdentity({ teamId: "T-RICH", playerOpt: 6 }),
      ],
      rosters: players.map((player, index) => ({
        id: `r-${index + 1}`,
        teamId: "T-POOR",
        playerId: player.id,
        contractLength: 2,
        salary: 5,
        upkeep: 5,
        roleTag: "starter",
        joinedSeasonId: "season-1",
      })),
    } as ReturnType<typeof buildGameState>;

    const poorPreview = buildAiTeamManagementPreview(gameState, "T-POOR");
    const richPreview = buildAiTeamManagementPreview(gameState, "T-RICH");

    expect(poorPreview?.budgetPlan.bucketsBefore.cashReserve).toBe(0);
    expect((poorPreview?.budgetPlan.bucketsBefore.buildingBudget ?? 0)).toBeLessThanOrEqual(5);
    expect((richPreview?.budgetPlan.bucketsBefore.buildingBudget ?? 0)).toBeGreaterThan(
      poorPreview?.budgetPlan.bucketsBefore.buildingBudget ?? 0,
    );
    expect((poorPreview?.budgetPlan.bucketsBefore.transferBudget ?? 0)).toBeGreaterThan(
      poorPreview?.budgetPlan.bucketsBefore.salaryReserve ?? 0,
    );
  });

  /**
   * GEMELDET VON CHRIS: „analytic muss was anderes machen sonst bringt das gebäude nix und kann raus."
   *
   * Die Wirkung hat A3 (#381) nachgeliefert — der Analytics Room zeigt den Live-Fortschritt auf der
   * Sponsor-Achse und den Board-Zielen. Die KI-Bewertung war davon unberührt: `analytics_room` stand
   * mit `scouting_office` im SELBEN Zweig und wurde wortgleich über Kaderlücken und Vertragswellen
   * bewertet. Über den Kader weiß das Gebäude aber nichts. Eine KI, die es bei Kaderlücken baut, baut
   * es aus einem Grund, den es nicht bedient.
   */
  describe("Analytics Room wird nicht mehr wie das Scouting Office bewertet", () => {
    /** Kaderlücke (4 Spieler bei playerOpt 6), keine Board-Ziele — Scouting-Argument, kein Analytics-Argument. */
    const gameState = buildGameState({ team: { cash: 200 } });
    const preview = buildAiTeamManagementPreview(gameState, "T-1");
    const scouting = preview?.buildingPlan.find((row) => row.buildingType === "scouting_office");
    const analytics = preview?.buildingPlan.find((row) => row.buildingType === "analytics_room");

    it("bei einer Kaderlücke ohne Board-Ziele steht das Scouting Office höher", () => {
      // Vorher waren die beiden Zahlen identisch — genau das ist der Fehler.
      expect(scouting?.score ?? 0).toBeGreaterThan(analytics?.score ?? 0);
    });

    it("und die Begründungen sind nicht mehr dieselben", () => {
      expect(analytics?.reasonsPositive ?? []).not.toContain(
        "Kaderlücken und Vertragswellen erhöhen den Informationswert",
      );
      expect(scouting?.reasonsPositive ?? []).toContain(
        "Kaderlücken und Vertragswellen erhöhen den Informationswert",
      );
    });

    it("er wird über Zieldruck und Achsfokus begründet — das ist seine Wirkung", () => {
      // Die Zeile ist da: das Testszenario hat Board-Ziele (`objectiveAiBias` ist nicht null), also
      // greift der positive Zweig. Der Fall ohne Ziele senkt den Score stattdessen — beides steht in
      // derselben Verzweigung, und genau diese Begründung gab es vorher für den Raum überhaupt nicht.
      expect(analytics?.reasonsPositive ?? []).toContain(
        "Zieldruck und Achsfokus machen den Live-Fortschritt wertvoll",
      );
    });

    it("das Scouting Office behält seine eigene Bewertung unverändert", () => {
      // Gegenprobe: die Trennung darf nur den Analytics Room verändern, nicht beide Gebäude entwerten.
      // Kaderlücke 2 × 10 = 20, keine auslaufenden Verträge, keine Board-Ziele.
      expect(scouting?.score ?? 0).toBeGreaterThanOrEqual(20);
    });
  });

  /**
   * GEMELDET VON CHRIS: „und schau dass die AI das auch versteht und nutzt und weiß wofür das gut
   * ist, nicht stupide investieren gebäude sind teuer aber punktuell wenn das geld da ist."
   *
   * Zwei getrennte Fragen, beide hier festgehalten:
   *
   *  1. VERSTEHT die KI, wofür der Specialist Wing gut ist? Er stand mit der Academy im selben Zweig
   *     und wurde über den Youth-Anteil bewertet. Seit #382 ist seine Variante die Fokusachse des
   *     Teams — sein Wert hängt daran, ob der Kader überhaupt eine Achse hat, die sich verstärken
   *     lässt. Ein gleichmäßig verteilter Kader gewinnt fast nichts, ein Kader ohne zuordenbare
   *     Klassen bekommt sogar eine willkürliche Achse dauerhaft festgeschrieben.
   *  2. INVESTIERT sie punktuell statt stupide? Die Bau-Schwelle war starr; ob eine Stufe vom freien
   *     Cash gedeckt ist, spielte keine Rolle.
   */
  describe("Die KI versteht, wofür der Specialist Wing gut ist", () => {
    /** Default-Kader: vier „Hero" → alle auf SOC. Konzentration 1,0. */
    const focusedRoster = buildGameState({ team: { cash: 200 } });
    /** Vier Klassen, vier Achsen — Konzentration 0,25. */
    const scatteredRoster = buildGameState({
      team: { cash: 200 },
      players: [
        buildPlayer("p1", { className: "Berserker" }),
        buildPlayer("p2", { className: "Sprinter" }),
        buildPlayer("p3", { className: "Mage" }),
        buildPlayer("p4", { className: "Hero" }),
      ],
    });

    const wingOf = (state: ReturnType<typeof buildGameState>) =>
      buildAiTeamManagementPreview(state, "T-1")?.buildingPlan.find((row) => row.buildingType === "specialist_wing");

    it("ein Kader mit klarem Achsprofil bewertet den Flügel höher als ein verteilter", () => {
      expect(wingOf(focusedRoster)?.score ?? 0).toBeGreaterThan(wingOf(scatteredRoster)?.score ?? 0);
    });

    it("und begründet beide Fälle unterschiedlich", () => {
      expect(wingOf(focusedRoster)?.reasonsPositive ?? []).toContain(
        "der Kader hat ein klares Achsprofil — genau das verstärkt der Flügel",
      );
      expect(wingOf(scatteredRoster)?.reasonsNegative ?? []).toContain(
        "der Kader verteilt sich über mehrere Achsen — eine Fokusachse trägt wenig",
      );
    });

    it("die Bewertung hängt nicht mehr am Youth-Anteil wie bei der Academy", () => {
      // Gegenprobe zur alten Zusammenlegung: beide Kader haben denselben Youth-Anteil (keinen).
      // Waeren sie noch im selben Zweig, muessten die Zahlen identisch sein.
      const academyFocused = buildAiTeamManagementPreview(focusedRoster, "T-1")?.buildingPlan.find(
        (row) => row.buildingType === "academy",
      );
      const academyScattered = buildAiTeamManagementPreview(scatteredRoster, "T-1")?.buildingPlan.find(
        (row) => row.buildingType === "academy",
      );
      expect(academyFocused?.score).toBe(academyScattered?.score);
      expect(wingOf(focusedRoster)?.score).not.toBe(wingOf(scatteredRoster)?.score);
    });
  });

  /**
   * ZU CHRIS' „nicht stupide investieren, gebäude sind teuer aber punktuell wenn das geld da ist".
   *
   * NACHGEMESSEN, NICHT NACHGEBAUT: bei identischem Bedarf und steigendem Cash liegt die Bau-Grenze
   * heute schon dort, wo sie hingehört — nichts unter 60, ab 60 Recovery, ab 80 zusätzlich Fan Shop,
   * ab 100 zusätzlich Arena, darüber unverändert. `canSpend` prüft gegen den Bau-Topf, und der ist
   * aus dem Cash abgeleitet. Eine zusätzliche Schwelle nach Deckungsgrad war zwischenzeitlich
   * eingebaut und hat an dieser Grenze bei keinem einzigen Cash-Wert etwas geändert; sie ist deshalb
   * wieder raus.
   *
   * Die Tests halten die gemessene Grenze fest, damit sie nicht unbemerkt verrutscht — sie behaupten
   * kein neues Verhalten.
   */
  describe("Die KI investiert punktuell, nicht stupide", () => {
    /**
     * Derselbe akute Bedarf in beiden Fällen — ein müder, teils verletzter Kader, für den das
     * Recovery Center die richtige Antwort ist. Verändert wird NUR der Kontostand. Ohne diese
     * Trennung misst man den Bedarf statt der Deckung: ein Team ohne Baustellen baut auch mit vollem
     * Konto nichts.
     */
    const fatiguedRoster = [
      buildPlayer("p1", { fatigue: 92 }),
      buildPlayer("p2", { fatigue: 88 }),
      buildPlayer("p3", { fatigue: 74 }),
      buildPlayer("p4", { fatigue: 70 }),
      buildPlayer("p5", { fatigue: 68 }),
      buildPlayer("p6", { fatigue: 65 }),
    ];
    const withCash = (cash: number) =>
      buildGameState({ players: fatiguedRoster, injuries: ["p1", "p2"], team: { cash } });
    const buildsOf = (cash: number) =>
      (buildAiTeamManagementPreview(withCash(cash), "T-1")?.buildingPlan ?? [])
        .filter((row) => row.action === "build_new" || row.action === "upgrade_existing")
        .map((row) => row.buildingType);

    it("beim selben Bedarf mit knappem Konto baut sie gar nicht", () => {
      expect(buildsOf(20)).toEqual([]);
      expect(buildsOf(40)).toEqual([]);
    });

    it("und greift zu, sobald das Geld da ist — in der Reihenfolge der Dringlichkeit", () => {
      // Zuerst das Recovery Center, das den akuten Bedarf deckt; die Income-Gebäude erst darüber.
      expect(buildsOf(60)).toEqual(["recovery_center"]);
      expect(buildsOf(80)).toEqual(["recovery_center", "fan_shop"]);
    });

    it("ein voller Kontostand ist trotzdem kein Freibrief", () => {
      // Gegenprobe: die Score-Schwelle gilt weiter, sonst würde aus „punktuell" ein Rundumschlag.
      const plan = buildAiTeamManagementPreview(withCash(400), "T-1")?.buildingPlan ?? [];
      const built = plan.filter((row) => row.action === "build_new" || row.action === "upgrade_existing");
      expect(built.length).toBeGreaterThan(0);
      expect(built.length).toBeLessThan(plan.length);
    });

    it("der Specialist Wing baut sich nicht selbst, nur weil der Kader gleichförmig ist", () => {
      // Beim Bauen fast falsch gemacht: eine erste Fassung der Wing-Bewertung vergab bis zu 90 Punkte
      // für ein klares Achsprofil — die KI hat den Flügel damit ab 60 Cash sofort mitgebaut. Ein
      // klares Profil ist ein Argument, kein Automatismus.
      for (const cash of [60, 100, 200, 400]) {
        expect(buildsOf(cash), `bei ${cash} Cash`).not.toContain("specialist_wing");
      }
    });
  });

});
