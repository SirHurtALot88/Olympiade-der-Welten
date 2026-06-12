import { describe, expect, it, vi } from "vitest";

import { listTransfermarktFreeAgents } from "@/lib/market/transfermarkt-read-service";

vi.mock("@/lib/market/transfermarkt-sheet-stats", () => ({
  getTransfermarktTierFromPoints: vi.fn((value: number | null) => {
    if (value == null || !Number.isFinite(value)) return null;
    if (value >= 88) return "S+";
    if (value >= 82) return "S";
    if (value >= 76) return "A";
    if (value >= 70) return "B";
    if (value >= 64) return "C";
    if (value >= 58) return "D";
    if (value >= 52) return "E";
    return "F";
  }),
  loadTransfermarktSheetStats: vi.fn(async () =>
    new Map([
      [
        "arkon",
        {
          playerName: "Arkon",
          displayMarketValue: 72.57,
          displaySalary: 16.54,
          cost: 85,
          upkeepBase: 8,
          referenceClass: "Warlord",
          imageSource: null,
          bracketLabel: "8",
          pow: 88,
          spe: 83,
          men: 70,
          soc: 55,
          powerRating: "S+",
          healthRating: "S+",
          staminaRating: "F",
          intelligenceRating: "F",
          determinationRating: "F",
          awarenessRating: "F",
          speedRating: "F",
          dexterityRating: "F",
          charismaRating: "F",
          willRating: "F",
          spiritRating: "F",
          tormentRating: "F",
        },
      ],
    ]),
  ),
}));

function createDatabase() {
  return {
    save: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "save-initial" ? { id: "save-initial" } : null,
      ),
      findFirst: vi.fn(async () => ({ id: "save-initial" })),
    },
    season: {
      findFirst: vi.fn(async ({ where }: { where?: { id?: string; saveId?: string } }) => {
        if (where?.id && where.id !== "season-1") {
          return null;
        }
        return { id: "season-1", saveId: "save-initial" };
      }),
    },
    player: {
      findMany: vi.fn(async () => [
        {
          id: "player-1",
          name: "Arkon",
          portraitPath: "/p1.png",
          portraitUrl: null,
          className: "Warrior",
          race: "Orc",
          alignment: "Red Blue",
          gender: "Male",
          subclasses: ["Berserker", "Mercenary"],
          traitsPositive: ["Mercenary", "Bold"],
          traitsNegative: ["ColdBlooded"],
          preferredDisciplineIds: [],
          attributes: {
            marketValue: 100000,
            salaryDemand: 8000,
            pow: 88,
            spe: 44,
            men: 33,
            soc: 22,
            above20: 18,
            above40: 14,
            above60: 9,
            above80: 3,
          },
          disciplineScores: [
            { score: 91, discipline: { id: "mini-dm", name: "Mini DM" } },
            { score: 80, discipline: { id: "fechten", name: "Fechten" } },
            { score: 65, discipline: { id: "tennis", name: "Tennis" } },
            { score: 55, discipline: { id: "showcase", name: "Showcase" } },
          ],
        },
        {
          id: "player-2",
          name: "Belric",
          portraitPath: null,
          portraitUrl: "https://img.example/belric.png",
          className: "Mage",
          race: "Elf",
          alignment: "Red Gold",
          gender: "Female",
          subclasses: ["Arcanist"],
          traitsPositive: ["Scholar"],
          traitsNegative: ["Fragile"],
          preferredDisciplineIds: ["speed-schach"],
          attributes: {
            marketValue: 90000,
            salaryDemand: 7000,
            pow: 20,
            spe: 60,
            men: 95,
            soc: 40,
            above20: 20,
            above40: 16,
            above60: 11,
            above80: 4,
          },
          disciplineScores: [{ score: 94, discipline: { id: "speed-schach", name: "Schach" } }],
        },
        {
          id: "player-3",
          name: "Cyra",
          portraitPath: null,
          portraitUrl: null,
          className: "Rogue",
          race: "Human",
          alignment: "",
          gender: "",
          subclasses: [],
          traitsPositive: [],
          traitsNegative: [],
          preferredDisciplineIds: [],
          attributes: null,
          disciplineScores: [],
        },
      ]),
    },
    activePlayer: {
      findMany: vi.fn(async ({ where }: { where: { saveId: string; seasonId: string } }) => {
        if (where.saveId === "save-initial" && where.seasonId === "season-1") {
          return [{
            playerId: "player-2",
            teamId: "A-A",
            salary: 7000,
            player: {
              race: "Elf",
              alignment: "Red Gold",
              subclasses: ["Arcanist"],
              traitsPositive: ["Scholar"],
              traitsNegative: ["Fragile"],
            },
          }];
        }
        return [];
      }),
    },
    teamSeasonState: {
      findFirst: vi.fn(async ({ where }: { where?: { teamId?: string } }) =>
        where?.teamId === "A-A"
          ? { teamId: "A-A", cash: 120000, playerMin: 7, playerOpt: 10, rosterLimit: 12 }
          : null,
      ),
    },
  };
}

describe("transfermarkt read service", () => {
  it("returns players without active player assignment in the selected scope", async () => {
    process.env.DATABASE_URL = "postgres://example";
    const result = await listTransfermarktFreeAgents({}, createDatabase());

    expect(result.scope).toEqual({ saveId: "save-initial", seasonId: "season-1", teamId: null });
    expect(result.teamContext).toBeNull();
    expect(result.items.map((item) => item.playerId)).toEqual(["player-1", "player-3"]);
    expect(result.items[0]?.availabilityReason).toBe("free_agent");
    expect(result.items[0]?.portraitPath).toBe("/p1.png");
    expect(result.items[1]?.portraitUrl).toBeNull();
    expect(result.items[0]?.imageUrl).toBe("/p1.png");
    expect(result.items[0]?.marketValue).toBe(72.57);
    expect(result.items[0]?.salary).toBe(16.54);
    expect(result.items[0]?.fit).toBeNull();
    expect(result.items[0]?.fitDisplay).toBe("Team waehlen");
    expect(result.items[0]?.fitSource).toBe("select_team_for_fit");
    expect(result.items[0]?.above20).toBe(18);
    expect(result.items[0]?.powTier).toBe("S+");
    expect(result.items[0]?.speTier).toBe("S");
    expect(result.items[0]?.topDisciplineScores[0]).toMatchObject({
      disciplineName: "Mini DM",
      scoreTier: "S+",
      ppsLastSeason: null,
    });
    expect("score" in (result.items[0]?.topDisciplineScores[0] ?? {})).toBe(false);
    expect(result.items[0]?.mercenary).toBe(true);
    expect(result.items[0]?.subclass1).toBe("Berserker");
    expect(result.items[0]?.subclass2).toBe("Mercenary");
    expect(result.items[0]?.subclass3).toBeNull();
    expect(result.items[0]?.traitPos1).toBe("Mercenary");
    expect(result.items[0]?.traitPos2).toBe("Bold");
    expect(result.items[0]?.traitPos3).toBeNull();
    expect(result.items[0]?.traitNeg1).toBe("ColdBlooded");
    expect(result.items[0]?.traitNeg2).toBeNull();
    expect(result.items[0]?.traitNeg3).toBeNull();
    expect(result.items[0]?.preferredDisciplineIds).toEqual([]);
    expect(result.items[0]?.powerRating).toBe("S+");
    expect(result.items[0]?.healthRating).toBe("S+");
  });

  it("keeps browser-safe API portrait routes as image sources", async () => {
    process.env.DATABASE_URL = "postgres://example";
    const database = createDatabase();
    const result = await listTransfermarktFreeAgents({ search: "Arkon" }, database);

    expect(result.items[0]?.imageUrl).toBe("/p1.png");
  });

  it("respects search, limit and market value filters", async () => {
    process.env.DATABASE_URL = "postgres://example";
    const result = await listTransfermarktFreeAgents(
      {
        search: "ark",
        limit: 1,
        minMarketValue: 70,
      },
      createDatabase(),
    );

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.name).toBe("Arkon");
  });

  it("keeps mercenary players visible in team context even when the local fit turns negative", async () => {
    process.env.DATABASE_URL = "postgres://example";
    const result = await listTransfermarktFreeAgents({ teamId: "A-A", search: "Arkon" }, createDatabase());

    expect(result.teamContext?.teamId).toBe("A-A");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.mercenary).toBe(true);
    expect((result.items[0]?.fit ?? 0) < 0).toBe(true);
    expect((result.items[0]?.fitAlignment ?? 0) < 0).toBe(true);
  });

  it("does not invent missing salary values", async () => {
    process.env.DATABASE_URL = "postgres://example";
    const result = await listTransfermarktFreeAgents({ search: "Cyra" }, createDatabase());

    expect(result.items[0]?.salary).toBeNull();
    expect(result.items[0]?.salaryStatus).toBe("missing");
    expect(result.items[0]?.missingFields).toEqual(["marketValue", "salaryDemand", "missing_or_unresolved_portrait"]);
    expect(result.warnings).toContain("1 free agents are missing salaryDemand data.");
  });

  it("keeps flat subclass and trait fields null-safe when arrays are empty", async () => {
    process.env.DATABASE_URL = "postgres://example";
    const result = await listTransfermarktFreeAgents({ search: "Cyra" }, createDatabase());

    expect(result.items[0]?.subclass1).toBeNull();
    expect(result.items[0]?.subclass2).toBeNull();
    expect(result.items[0]?.subclass3).toBeNull();
    expect(result.items[0]?.traitPos1).toBeNull();
    expect(result.items[0]?.traitNeg1).toBeNull();
  });

  it("maps unresolved filesystem portraits to null imageUrl", async () => {
    process.env.DATABASE_URL = "postgres://example";
    const result = await listTransfermarktFreeAgents({ search: "Cyra" }, createDatabase());

    expect(result.items[0]?.imageUrl).toBeNull();
    expect(result.warnings).toContain("1 free agents are missing_or_unresolved_portrait.");
  });

  it("respects save and season scope while resolving active players", async () => {
    process.env.DATABASE_URL = "postgres://example";
    const database = createDatabase();
    await listTransfermarktFreeAgents({ saveId: "save-initial", seasonId: "season-1" }, database);

    expect(database.activePlayer.findMany).toHaveBeenCalledWith({
      where: {
        saveId: "save-initial",
        seasonId: "season-1",
      },
      select: {
        playerId: true,
        teamId: true,
        salary: true,
        player: {
          select: {
            race: true,
            alignment: true,
            subclasses: true,
            traitsPositive: true,
            traitsNegative: true,
          },
        },
      },
    });
  });

  it("stays read-only without write calls", async () => {
    const moduleText = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/market/transfermarkt-read-service.ts",
        "utf8",
      ),
    );

    expect(moduleText).not.toContain("createMany");
    expect(moduleText).not.toContain("update(");
    expect(moduleText).not.toContain("upsert(");
    expect(moduleText).not.toContain("deleteMany");
  });

  it("keeps teamId only as context and exposes a warning", async () => {
    process.env.DATABASE_URL = "postgres://example";
    const result = await listTransfermarktFreeAgents({ teamId: "A-A" }, createDatabase());

    expect(result.scope.teamId).toBe("A-A");
    expect(result.teamContext?.teamId).toBe("A-A");
    expect(result.teamContext?.teamSalary).toBe(7000);
    expect(result.teamContext?.readinessStatus).toBe("unknown");
    expect(result.teamContext?.rosterPressureStatus).toBe("under_min");
    expect(result.items[0]?.teamContextAvailable).toBe(true);
    expect(result.items[0]?.teamCash).toBe(120000);
    expect(result.items[0]?.teamSalary).toBe(7000);
    expect(result.items[0]?.readinessStatus).toBe("unknown");
    expect((result.items[0]?.fit ?? 0) < 0).toBe(true);
    expect(result.items[0]?.fitDisplay).toBe("-6.4");
    expect(result.items[0]?.fitSource).toBe("local_approximation_not_golden_master");
    expect(result.items[0]?.fitRace).toBe(0);
    expect(result.items[0]?.fitSubclasses).toBe(-2);
    expect(result.items[0]?.fitTraits).toBe(-3);
    expect(result.items[0]?.fitAlignment).toBe(-1);
    expect(result.warnings).toContain(
      "teamId adds real team context, but does not filter the free-agent pool.",
    );
    expect(result.warnings).toContain(
      "Fit is currently a local Retool-style approximation based on roster-derived race/subclass/trait/alignment counts.",
    );
  });
});
