import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { buildExpectedSellValueByPlayerId } from "@/lib/market/transfermarkt-expected-sell-value";
import { resolveTransfermarktSellProceeds } from "@/lib/market/transfermarkt-sell-proceeds";

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "A-A",
    shortCode: partial?.shortCode ?? "A-A",
    name: partial?.name ?? "Armageddon Aftermath",
    budget: partial?.budget ?? 175,
    cash: partial?.cash ?? 175,
    identityId: partial?.identityId ?? "A-A",
    humanControlled: partial?.humanControlled ?? true,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function createPlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: partial?.rating ?? 70,
    marketValue: partial?.marketValue ?? 60,
    salaryDemand: partial?.salaryDemand ?? 10,
    displayMarketValue: partial?.displayMarketValue ?? partial?.marketValue ?? 60,
    displaySalary: partial?.displaySalary ?? partial?.salaryDemand ?? 10,
    className: partial?.className ?? "Hero",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "f",
    referenceClass: partial?.referenceClass ?? null,
    imageSource: partial?.imageSource ?? null,
    bracketLabel: partial?.bracketLabel ?? null,
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? [],
    disciplineRatings: partial?.disciplineRatings ?? { d1: 70, d2: 65 },
    disciplineTierCounts:
      partial?.disciplineTierCounts ?? {
        above20: 2,
        above40: 2,
        above60: 2,
        above80: 0,
      },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
  };
}

function createRosterEntry(id: string, playerId: string, partial?: Partial<RosterEntry>): RosterEntry {
  return {
    id,
    teamId: partial?.teamId ?? "A-A",
    playerId,
    contractLength: partial?.contractLength ?? 3,
    salary: partial?.salary ?? 10,
    upkeep: partial?.upkeep ?? partial?.salary ?? 10,
    // Explizit übergebenes `undefined` respektieren (Eigengewächs-Fall ohne Kaufpreis),
    // sonst würde der 60er-Default den "kein Kaufpreis"-Test unterlaufen.
    ...(partial && "purchasePrice" in partial ? { purchasePrice: partial.purchasePrice } : { purchasePrice: 60 }),
    currentValue: partial?.currentValue ?? 60,
    roleTag: partial?.roleTag ?? "starter",
    joinedSeasonId: partial?.joinedSeasonId ?? "season-1",
    ...(partial?.yearlySalarySchedule ? { yearlySalarySchedule: partial.yearlySalarySchedule } : {}),
    ...(partial?.contractShape ? { contractShape: partial.contractShape } : {}),
  };
}

function createGameState(input: { players: Player[]; rosters: RosterEntry[] }): GameState {
  return {
    gamePhase: "preseason_management",
    season: {
      id: "season-1",
      name: "Season 1",
      year: 2026,
      currentMatchday: 1,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      playerDisciplinePerformances: [],
      seasonSnapshots: [],
      matchdayResults: [],
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [createTeam()],
    teamIdentities: [],
    players: input.players,
    disciplines: [],
    rosters: input.rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-01-01T00:00:00.000Z",
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
  };
}

describe("buildExpectedSellValueByPlayerId", () => {
  it("computes gross sale price minus END-OF-SEASON buyout (Laufzeit −1) for every rostered player", () => {
    // Season start (keine gewerteten Performances) → Sale-Factor 1, Brutto = MW.
    const gameState = createGameState({
      players: [createPlayer("p1"), createPlayer("p2", { marketValue: 100, displayMarketValue: 100 })],
      rosters: [
        createRosterEntry("r1", "p1", { currentValue: 60, contractLength: 3, salary: 10 }),
        createRosterEntry("r2", "p2", { currentValue: 100, contractLength: 1, salary: 5 }),
      ],
    });

    const byPlayerId = buildExpectedSellValueByPlayerId(gameState);

    const p1 = byPlayerId.get("p1");
    expect(p1).toBeTruthy();
    expect(p1!.grossSalePrice).toBe(60);
    // Saisonende-Sicht: das laufende Vertragsjahr ist verbraucht → nur noch 2 Restjahre à 10.
    expect(p1!.buyoutCost).toBe(20);
    expect(p1!.expectedSellValue).toBe(40);

    const p2 = byPlayerId.get("p2");
    expect(p2).toBeTruthy();
    expect(p2!.grossSalePrice).toBe(100);
    // Restlaufzeit 1 = "expiring": am Saisonende vertragslos → KEIN Buyout mehr.
    expect(p2!.buyoutCost).toBe(0);
    expect(p2!.expectedSellValue).toBe(100);
  });

  it("charges no buyout for expiring contracts (Restlaufzeit 1) — the season-end tick clears them", () => {
    const gameState = createGameState({
      players: [createPlayer("p1")],
      rosters: [
        createRosterEntry("r1", "p1", {
          contractLength: 1,
          salary: 12,
          yearlySalarySchedule: [{ yearIndex: 1, seasonOffset: 0, label: "Season 1", salary: 12 }],
        }),
      ],
    });

    const entry = buildExpectedSellValueByPlayerId(gameState).get("p1");
    expect(entry).toBeTruthy();
    expect(entry!.buyoutCost).toBe(0);
    expect(entry!.expectedSellValue).toBe(entry!.grossSalePrice);
  });

  it("differs from the immediate sell flow by exactly the current contract year", () => {
    // Der echte Verkaufs-Flow (previewLocalTransfermarktSell → resolveTransfermarktSellProceeds
    // mit Default seasonsElapsed=0) rechnet weiterhin mit der VOLLEN Restlaufzeit; nur die
    // Übersichtsspalte zieht das laufende Vertragsjahr ab.
    const rosterEntry = createRosterEntry("r1", "p1", {
      contractLength: 3,
      salary: 10,
      yearlySalarySchedule: [
        { yearIndex: 1, seasonOffset: 0, label: "Season 1", salary: 8 },
        { yearIndex: 2, seasonOffset: 1, label: "Season 2", salary: 10 },
        { yearIndex: 3, seasonOffset: 2, label: "Season 3", salary: 12 },
      ],
    });
    const gameState = createGameState({ players: [createPlayer("p1")], rosters: [rosterEntry] });

    const columnEntry = buildExpectedSellValueByPlayerId(gameState).get("p1")!;
    const immediateSell = resolveTransfermarktSellProceeds({
      rosterEntry,
      grossSalePrice: columnEntry.grossSalePrice,
      gameState,
    });

    // Sofort-Verkauf: volle 3 Jahre (8+10+12=30); Spalte: nur Jahre 2+3 (10+12=22).
    expect(immediateSell.buyoutCost).toBe(30);
    expect(columnEntry.buyoutCost).toBe(22);
    expect(immediateSell.buyoutCost - columnEntry.buyoutCost).toBe(8);
  });

  it("nets can go negative for long contracts and low sale prices", () => {
    const gameState = createGameState({
      players: [createPlayer("p1", { marketValue: 10, displayMarketValue: 10 })],
      rosters: [createRosterEntry("r1", "p1", { currentValue: 10, contractLength: 4, salary: 8 })],
    });

    const entry = buildExpectedSellValueByPlayerId(gameState).get("p1");
    expect(entry).toBeTruthy();
    expect(entry!.grossSalePrice).toBe(10);
    // Saisonende-Sicht: 3 statt 4 Restjahre à 8.
    expect(entry!.buyoutCost).toBe(24);
    expect(entry!.expectedSellValue).toBe(-14);
  });

  it("reports profit/loss against the actually paid purchase price — and null without one", () => {
    const gameState = createGameState({
      players: [
        createPlayer("bought", { marketValue: 80, displayMarketValue: 80 }),
        createPlayer("homegrown"),
        createPlayer("loss", { marketValue: 20, displayMarketValue: 20 }),
      ],
      rosters: [
        createRosterEntry("r1", "bought", { currentValue: 80, contractLength: 2, salary: 10, purchasePrice: 50 }),
        // Eigengewächs/Startkader ohne dokumentierten Kaufpreis: G/V muss null bleiben
        // (KEIN Rückgriff auf den Marktwert als erfundene Basis).
        createRosterEntry("r2", "homegrown", { contractLength: 2, salary: 10, purchasePrice: undefined }),
        createRosterEntry("r3", "loss", { currentValue: 20, contractLength: 3, salary: 6, purchasePrice: 40 }),
      ],
    });

    const byPlayerId = buildExpectedSellValueByPlayerId(gameState);

    const bought = byPlayerId.get("bought")!;
    // Netto (80 − 10) minus gezahlte 50 → +20 Gewinn.
    expect(bought.purchasePrice).toBe(50);
    expect(bought.profitVsPurchase).toBe(bought.expectedSellValue - 50);
    expect(bought.profitVsPurchase).toBe(20);

    const homegrown = byPlayerId.get("homegrown")!;
    expect(homegrown.purchasePrice).toBeNull();
    expect(homegrown.profitVsPurchase).toBeNull();

    const loss = byPlayerId.get("loss")!;
    // Netto (20 − 12) minus gezahlte 40 → −32 Verlust.
    expect(loss.profitVsPurchase).toBe(loss.expectedSellValue - 40);
    expect(loss.profitVsPurchase).toBeLessThan(0);
  });

  it("lets the bracket-rank sale factor push top performers above and bottom performers below MW", () => {
    // 16 Spieler im selben Bracket (MW 56–63 → Bracket 8, Pool ≥ SALE_FACTOR_MIN_RANK_POOL) mit
    // gewerteten Performances eines applied Matchdays: Rang 1 muss ÜBER MW verkaufen, der letzte
    // Rang darunter — der Sale-Faktor darf NICHT für alle neutral (1,0) bleiben.
    const players: Player[] = [];
    const rosters: RosterEntry[] = [];
    const performances: NonNullable<GameState["seasonState"]["playerDisciplinePerformances"]> = [];
    const POOL = 16;
    for (let index = 0; index < POOL; index += 1) {
      const id = `bp${index + 1}`;
      const marketValue = 63 - index * 0.4;
      players.push(createPlayer(id, { marketValue, displayMarketValue: marketValue }));
      rosters.push(createRosterEntry(`br${index + 1}`, id, { currentValue: marketValue, contractLength: 2, salary: 5 }));
      performances.push({
        id: `perf-${id}`,
        matchdayResultId: "mdr-1",
        teamId: "A-A",
        playerId: id,
        activePlayerId: `br${index + 1}`,
        disciplineId: "d1",
        disciplineSide: "d1",
        slotIndex: index,
        baseValue: 50,
        finalPlayerScore: 50,
        scoreContribution: POOL - index, // bp1 ist Bracket-Bester, bp16 Letzter
        rankInTeam: 1,
        rankInDiscipline: index + 1,
        isTop10: index < 10,
        isMvpCandidate: index === 0,
        storyWeight: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    }

    const gameState = createGameState({ players, rosters });
    gameState.seasonState.matchdayResults = [
      {
        id: "mdr-1",
        saveId: "save-test",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 1,
        teamsReady: 1,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    gameState.seasonState.playerDisciplinePerformances = performances;

    const byPlayerId = buildExpectedSellValueByPlayerId(gameState);
    const top = byPlayerId.get("bp1")!;
    const bottom = byPlayerId.get("bp16")!;

    // Rang 1 im Bracket: Faktor > 1 → Brutto klar über MW.
    expect(top.grossSalePrice).toBeGreaterThan(63);
    // Letzter Rang: Faktor < 1 → Brutto unter MW.
    expect(bottom.grossSalePrice).toBeLessThan(63 - (POOL - 1) * 0.4);
    // Und die Spreizung ist echt (kein globaler Neutralfaktor).
    const factors = [top.grossSalePrice / 63, bottom.grossSalePrice / (63 - (POOL - 1) * 0.4)];
    expect(factors[0]).not.toBeCloseTo(factors[1], 2);
  });

  it("omits free agents — players without a roster entry cannot be sold", () => {
    const gameState = createGameState({
      players: [createPlayer("p1"), createPlayer("free-agent")],
      rosters: [createRosterEntry("r1", "p1")],
    });

    const byPlayerId = buildExpectedSellValueByPlayerId(gameState);
    expect(byPlayerId.has("p1")).toBe(true);
    expect(byPlayerId.has("free-agent")).toBe(false);
  });

  it("stays consistent: expectedSellValue always equals gross minus buyout", () => {
    const gameState = createGameState({
      players: [createPlayer("p1"), createPlayer("p2"), createPlayer("p3")],
      rosters: [
        createRosterEntry("r1", "p1", { contractLength: 1, salary: 3 }),
        createRosterEntry("r2", "p2", { contractLength: 2, salary: 7 }),
        createRosterEntry("r3", "p3", { contractLength: 5, salary: 12 }),
      ],
    });

    for (const entry of buildExpectedSellValueByPlayerId(gameState).values()) {
      expect(entry.expectedSellValue).toBeCloseTo(entry.grossSalePrice - entry.buyoutCost, 2);
    }
  });
});
