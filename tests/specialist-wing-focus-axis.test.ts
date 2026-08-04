import { describe, expect, it } from "vitest";

import type { GameState, Player, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import {
  FACILITY_CATALOG_BY_ID,
  SPECIALIST_WING_VARIANTS,
  getFacilityLevelDefinition,
  type SpecialistWingVariant,
} from "@/lib/facilities/facility-catalog";
import {
  calculateFacilitySeasonUpkeep,
  calculateFacilityUpkeep,
  getSpecialistWingFocusAxis,
  getSpecialistWingFocusBonusPct,
} from "@/lib/facilities/facility-effects";
import {
  chooseSpecialistWingVariantForTeam,
  countTeamRosterFocusAxes,
} from "@/lib/facilities/specialist-wing-variant-choice";
import {
  DEVELOPMENT_ROUTE_BONUS_BASE_PCT,
  DEVELOPMENT_ROUTE_BONUS_MAX_PCT,
  getDevelopmentRouteBonusMultiplier,
  type TrainingFocusAxis,
} from "@/lib/training/development-route-bonus";
import {
  buildOrganicSeasonProgression,
  classNameToDevelopmentRoute,
  resolveTeamTrainingFocusAxis,
  resolveTeamTrainingFocusBonusPct,
} from "@/lib/training/organic-season-progression";

/**
 * Diese Suite prüft die REGEL von Vorschlag S1 (docs/GEBAEUDE_REWORK_KONZEPT.md), nicht einzelne
 * Zeilen: die Variante des Specialist Wing IST die Trainings-Fokusachse des Teams, sie ERSETZT die
 * Trainingseinstellung, der Aufschlag bleibt klein und gedeckelt, der alte Unterhaltsrabatt ist weg,
 * und die KI wählt die Variante nach Kader statt hart „mind_lab".
 */

const ALL_VARIANTS = Object.keys(SPECIALIST_WING_VARIANTS) as SpecialistWingVariant[];
const ALL_LEVELS = [1, 2, 3, 4, 5];

function facilities(entries: TeamFacilityCollection["facilities"]): TeamFacilityCollection {
  return { facilities: entries };
}

function wing(level: number, variant: SpecialistWingVariant, conditionPct = 100): TeamFacilityCollection {
  return facilities({ specialist_wing: { level, enabled: level > 0, conditionPct, activeVariant: variant } });
}

function player(id: string, className: string): Player {
  return {
    id,
    name: id,
    rating: 60,
    marketValue: 20,
    salaryDemand: 5,
    className,
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
  } as unknown as Player;
}

/**
 * Minimaler GameState mit einem Team, einem Kader und optionalen Gebäuden/Trainingseinstellungen —
 * gerade genug für `resolveTeamTrainingFocusAxis` und die KI-Variantenwahl.
 */
function gameState(input: {
  classNames: string[];
  teamFacilities?: TeamFacilityCollection["facilities"];
  trainingFocus?: "POW" | "SPE" | "MEN" | "SOC" | "BALANCED" | "RECOVERY";
}): GameState {
  const players = input.classNames.map((className, index) => player(`p-${index + 1}`, className));
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      teamFacilities: input.teamFacilities ? { "T-1": { facilities: input.teamFacilities } } : undefined,
      aiManagerTrainingSettings: input.trainingFocus
        ? { "T-1": { teamId: "T-1", seasonId: "season-1", trainingFocus: input.trainingFocus, trainingIntensity: "mittel" } }
        : undefined,
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [],
    teamIdentities: [],
    players,
    disciplines: [],
    rosters: players.map((entry, index) => ({
      id: `r-${index + 1}`,
      teamId: "T-1",
      playerId: entry.id,
      contractLength: 2,
      salary: 5,
      upkeep: 5,
      roleTag: "starter",
      joinedSeasonId: "season-1",
    })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-08-04T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      unmappedPlayers: [],
      warnings: [],
    },
  } as unknown as GameState;
}

describe("specialist wing — Variante ist die Trainings-Fokusachse (S1)", () => {
  it("bildet jede Variante auf genau eine Achse ab, und alle vier Achsen sind belegt", () => {
    const byVariant: Record<SpecialistWingVariant, TrainingFocusAxis> = {
      power_gym: "pow",
      agility_track: "spe",
      mind_lab: "men",
      social_studio: "soc",
    };

    for (const variant of ALL_VARIANTS) {
      expect(SPECIALIST_WING_VARIANTS[variant].focusAxis).toBe(byVariant[variant]);
      expect(getSpecialistWingFocusAxis(wing(1, variant))).toBe(byVariant[variant]);
    }
    // Bijektion: vier Varianten, vier verschiedene Achsen — keine Achse ohne Gebäude-Variante.
    expect(new Set(ALL_VARIANTS.map((variant) => SPECIALIST_WING_VARIANTS[variant].focusAxis)).size).toBe(4);
  });

  it("liefert ohne Flügel keine Achse (Level 0, deaktiviert oder verfallen)", () => {
    expect(getSpecialistWingFocusAxis(null)).toBeNull();
    expect(getSpecialistWingFocusAxis(facilities({}))).toBeNull();
    expect(getSpecialistWingFocusAxis(wing(0, "power_gym"))).toBeNull();
    expect(
      getSpecialistWingFocusAxis(
        facilities({ specialist_wing: { level: 3, enabled: false, activeVariant: "power_gym" } }),
      ),
    ).toBeNull();
    expect(getSpecialistWingFocusAxis(wing(3, "power_gym", 0))).toBeNull();
  });

  it("ERSETZT die Fokusachse des Teams — die Trainingseinstellung verliert gegen den Flügel", () => {
    // Team hat MEN eingestellt, baut aber ein Power Gym: die Achse ist POW, nicht MEN.
    const withWing = gameState({
      classNames: ["Mage"],
      trainingFocus: "MEN",
      teamFacilities: { specialist_wing: { level: 1, enabled: true, conditionPct: 100, activeVariant: "power_gym" } },
    });
    expect(resolveTeamTrainingFocusAxis(withWing, "p-1")).toBe("pow");

    // Und das gilt für jede Variante, egal was eingestellt ist.
    for (const variant of ALL_VARIANTS) {
      const state = gameState({
        classNames: ["Mage"],
        trainingFocus: "SOC",
        teamFacilities: { specialist_wing: { level: 5, enabled: true, conditionPct: 100, activeVariant: variant } },
      });
      expect(resolveTeamTrainingFocusAxis(state, "p-1")).toBe(SPECIALIST_WING_VARIANTS[variant].focusAxis);
    }
  });

  it("ohne Flügel gilt weiterhin die Trainingseinstellung — und ohne Einstellung gar keine Achse", () => {
    expect(resolveTeamTrainingFocusAxis(gameState({ classNames: ["Mage"], trainingFocus: "MEN" }), "p-1")).toBe("men");
    expect(resolveTeamTrainingFocusAxis(gameState({ classNames: ["Mage"], trainingFocus: "SPE" }), "p-1")).toBe("spe");
    expect(resolveTeamTrainingFocusAxis(gameState({ classNames: ["Mage"] }), "p-1")).toBeNull();
    // BALANCED/RECOVERY sind keine Achsen.
    expect(resolveTeamTrainingFocusAxis(gameState({ classNames: ["Mage"], trainingFocus: "BALANCED" }), "p-1")).toBeNull();
    // Ein Flügel auf Level 0 ändert daran nichts.
    const zeroLevelWing = gameState({
      classNames: ["Mage"],
      trainingFocus: "MEN",
      teamFacilities: { specialist_wing: { level: 0, enabled: false, activeVariant: "power_gym" } },
    });
    expect(resolveTeamTrainingFocusAxis(zeroLevelWing, "p-1")).toBe("men");
  });

  it("die gesetzte Achse trifft genau die Spieler, deren Entwicklungsroute passt", () => {
    // Power Gym → POW: ein Berserker (POW) bekommt den Bonus, ein Mage (MEN) nicht.
    const axis = getSpecialistWingFocusAxis(wing(1, "power_gym"));
    expect(getDevelopmentRouteBonusMultiplier(classNameToDevelopmentRoute("Berserker"), axis)).toBeGreaterThan(1);
    expect(getDevelopmentRouteBonusMultiplier(classNameToDevelopmentRoute("Mage"), axis)).toBe(1);
    // BALANCED-Routen bekommen nie einen Routenbonus.
    expect(getDevelopmentRouteBonusMultiplier("BALANCED", axis)).toBe(1);
    expect(getDevelopmentRouteBonusMultiplier("RECOVERY", axis)).toBe(1);
  });
});

describe("specialist wing — Höhe des Routenbonus", () => {
  it("beginnt auf dem Altwert und wächst mit jeder Stufe streng monoton", () => {
    const pctByLevel = ALL_LEVELS.map((level) => getSpecialistWingFocusBonusPct(wing(level, "power_gym")));

    // L1 verkauft die Achse, nicht mehr Prozente: der Bonus ist dort exakt die historische Basis.
    expect(pctByLevel[0]).toBe(DEVELOPMENT_ROUTE_BONUS_BASE_PCT);
    for (let index = 1; index < pctByLevel.length; index += 1) {
      expect(pctByLevel[index]).toBeGreaterThan(pctByLevel[index - 1]);
    }
  });

  it("bleibt auf jeder Stufe unter der Obergrenze — und die Obergrenze unter dem doppelten Basisbonus", () => {
    for (const level of ALL_LEVELS) {
      expect(getSpecialistWingFocusBonusPct(wing(level, "power_gym"))).toBeLessThanOrEqual(
        DEVELOPMENT_ROUTE_BONUS_MAX_PCT,
      );
    }
    // Kern der Vorgabe: der Aufschlag darf sich gegenüber den vorhandenen +8 % nicht verdoppeln.
    expect(DEVELOPMENT_ROUTE_BONUS_MAX_PCT).toBeLessThan(2 * DEVELOPMENT_ROUTE_BONUS_BASE_PCT);
    // Der Multiplikator auf Vollausbau bleibt damit klar unter 1.16.
    expect(getDevelopmentRouteBonusMultiplier("POW", "pow", getSpecialistWingFocusBonusPct(wing(5, "power_gym")))).toBeLessThan(
      1 + (2 * DEVELOPMENT_ROUTE_BONUS_BASE_PCT) / 100,
    );
  });

  it("klemmt auch einen zu großen Katalogwert an der Obergrenze fest", () => {
    // Die Grenze ist eine echte Klammer, keine Dokumentation: selbst wenn jemand den Katalog
    // hochdreht, kann der reale Bonus nicht darüber hinauslaufen.
    expect(getDevelopmentRouteBonusMultiplier("POW", "pow", 999)).toBe(1 + DEVELOPMENT_ROUTE_BONUS_MAX_PCT / 100);
    for (const level of ALL_LEVELS) {
      expect(getFacilityLevelDefinition("specialist_wing", level)?.modifierPct ?? 0).toBeLessThanOrEqual(
        DEVELOPMENT_ROUTE_BONUS_MAX_PCT,
      );
    }
  });

  it("fällt ohne Flügel auf die Basis zurück und sinkt bei Verschleiß nie darunter", () => {
    expect(getSpecialistWingFocusBonusPct(null)).toBe(DEVELOPMENT_ROUTE_BONUS_BASE_PCT);
    expect(getSpecialistWingFocusBonusPct(wing(0, "power_gym"))).toBe(DEVELOPMENT_ROUTE_BONUS_BASE_PCT);
    // Halb verfallener L5-Flügel: irgendwo zwischen Basis und Vollwert, nie darunter.
    const worn = getSpecialistWingFocusBonusPct(wing(5, "power_gym", 50));
    expect(worn).toBeGreaterThanOrEqual(DEVELOPMENT_ROUTE_BONUS_BASE_PCT);
    expect(worn).toBeLessThan(getSpecialistWingFocusBonusPct(wing(5, "power_gym")));
  });

  it("Achse und Bonushöhe kommen für denselben Spieler aus derselben Quelle", () => {
    const state = gameState({
      classNames: ["Berserker"],
      trainingFocus: "MEN",
      teamFacilities: { specialist_wing: { level: 4, enabled: true, conditionPct: 100, activeVariant: "power_gym" } },
    });
    expect(resolveTeamTrainingFocusAxis(state, "p-1")).toBe("pow");
    expect(resolveTeamTrainingFocusBonusPct(state, "p-1")).toBe(
      getFacilityLevelDefinition("specialist_wing", 4)?.modifierPct,
    );
    // Ohne Flügel: Basis.
    expect(resolveTeamTrainingFocusBonusPct(gameState({ classNames: ["Berserker"], trainingFocus: "POW" }), "p-1")).toBe(
      DEVELOPMENT_ROUTE_BONUS_BASE_PCT,
    );
  });
});

describe("specialist wing — der Unterhaltsrabatt ist weg", () => {
  it("senkt den Unterhalt keines Gebäudes mehr, auf keiner Stufe", () => {
    for (const level of [0, ...ALL_LEVELS]) {
      const withWing = facilities({
        training_center: { level: 5, enabled: true, conditionPct: 100 },
        fan_shop: { level: 3, enabled: true, conditionPct: 100 },
        specialist_wing: { level, enabled: level > 0, conditionPct: 100, activeVariant: "agility_track" },
      });
      const trainingCenterUpkeep = getFacilityLevelDefinition("training_center", 5)?.seasonUpkeep ?? 0;
      expect(calculateFacilitySeasonUpkeep("training_center", withWing)).toBe(trainingCenterUpkeep);
    }
  });

  it("der Portfolio-Unterhalt ist exakt die Summe der Katalogwerte", () => {
    const teamFacilities = facilities({
      training_center: { level: 5, enabled: true, conditionPct: 100 },
      fan_shop: { level: 3, enabled: true, conditionPct: 100 },
      specialist_wing: { level: 5, enabled: true, conditionPct: 100, activeVariant: "agility_track" },
    });
    const expected =
      (getFacilityLevelDefinition("training_center", 5)?.seasonUpkeep ?? 0) +
      (getFacilityLevelDefinition("fan_shop", 3)?.seasonUpkeep ?? 0) +
      (getFacilityLevelDefinition("specialist_wing", 5)?.seasonUpkeep ?? 0);

    expect(calculateFacilityUpkeep(teamFacilities)).toBeCloseTo(expected, 2);
  });

  it("bewirbt keinen Rabatt mehr, sondern die Fokusachse", () => {
    const entry = FACILITY_CATALOG_BY_ID.specialist_wing;
    const advertised = [entry.description, entry.effectDescription, ...entry.levels.map((level) => level.effectDescription)]
      .join(" ")
      .toLowerCase();

    expect(advertised).not.toMatch(/rabatt|discount/);
    expect(advertised).toMatch(/fokusachse/);
    expect(entry.effectType).toBe("specialist_focus_axis");
  });
});

describe("specialist wing — Wirkung in der echten Progression", () => {
  /** Berserker = POW-Route (classNameToDevelopmentRoute), damit ein Power Gym greifen kann. */
  function berserker(): Player {
    return {
      ...player("p-1", "Berserker"),
      trainingMode: "mittel",
      trainingClass: "Berserker",
      attributeSheetStats: {
        power: 60,
        health: 60,
        stamina: 60,
        intelligence: 40,
        awareness: 40,
        determination: 45,
        speed: 50,
        dexterity: 45,
        charisma: 40,
        will: 40,
        spirit: 40,
        torment: 45,
      },
    } as unknown as Player;
  }

  function progressionState(input: {
    subject: Player;
    trainingFocus?: "POW" | "MEN";
    wingLevel?: number;
  }): GameState {
    const state = gameState({
      classNames: [],
      trainingFocus: input.trainingFocus,
      teamFacilities: input.wingLevel
        ? { specialist_wing: { level: input.wingLevel, enabled: true, conditionPct: 100, activeVariant: "power_gym" } }
        : undefined,
    }) as GameState & { players: Player[] };
    state.players = [input.subject];
    state.rosters = [
      { id: "r-1", teamId: "T-1", playerId: input.subject.id, salary: 5, upkeep: 5, contractLength: 2, roleTag: "starter", joinedSeasonId: "season-1" },
    ] as GameState["rosters"];
    state.teams = [{ teamId: "T-1", name: "Team", shortCode: "T1", budget: 100, cash: 100 }] as unknown as GameState["teams"];
    return state;
  }

  it("hebt das reale Trainingsbudget eines passenden Spielers — und zwar mit der Gebäudestufe", () => {
    const subject = berserker();
    const budgetAt = (wingLevel: number) =>
      buildOrganicSeasonProgression({
        gameState: progressionState({ subject, trainingFocus: "POW", wingLevel: wingLevel || undefined }),
        player: subject,
        facilities: wingLevel ? wing(wingLevel, "power_gym") : undefined,
      }).trainingSetpoints;

    const withoutWing = budgetAt(0);
    const budgets = ALL_LEVELS.map((level) => budgetAt(level));

    // L1 ändert die Höhe bewusst nicht (nur die Achse wird garantiert gesetzt) …
    expect(budgets[0]).toBeCloseTo(withoutWing, 2);
    // … ab L2 wächst das Budget mit jeder Stufe.
    for (let index = 1; index < budgets.length; index += 1) {
      expect(budgets[index]).toBeGreaterThan(budgets[index - 1]);
    }
    // Vollausbau gegenüber „Achse gesetzt, kein Flügel": genau das Verhältnis der beiden Boni.
    expect(budgets[4]).toBeCloseTo(
      (withoutWing * (1 + DEVELOPMENT_ROUTE_BONUS_MAX_PCT / 100)) / (1 + DEVELOPMENT_ROUTE_BONUS_BASE_PCT / 100),
      1,
    );
  });

  it("ersetzt in der echten Progression eine widersprechende Trainingseinstellung", () => {
    const subject = berserker();
    // Team stellt MEN ein — ohne Flügel bekommt der POW-Berserker gar keinen Routenbonus.
    const menOnly = buildOrganicSeasonProgression({
      gameState: progressionState({ subject, trainingFocus: "MEN" }),
      player: subject,
    }).trainingSetpoints;
    // Mit Power Gym gilt POW, obwohl weiterhin MEN eingestellt ist.
    const menPlusPowerGym = buildOrganicSeasonProgression({
      gameState: progressionState({ subject, trainingFocus: "MEN", wingLevel: 5 }),
      player: subject,
      facilities: wing(5, "power_gym"),
    }).trainingSetpoints;

    expect(menPlusPowerGym).toBeGreaterThan(menOnly);
    expect(menPlusPowerGym).toBeCloseTo(menOnly * (1 + DEVELOPMENT_ROUTE_BONUS_MAX_PCT / 100), 1);
  });

  it("gibt einem Spieler mit unpassender Route auch mit Flügel nichts", () => {
    const mage = { ...berserker(), id: "p-1", className: "Mage", trainingClass: "Mage" } as unknown as Player;
    const withoutWing = buildOrganicSeasonProgression({
      gameState: progressionState({ subject: mage }),
      player: mage,
    }).trainingSetpoints;
    const withPowerGym = buildOrganicSeasonProgression({
      gameState: progressionState({ subject: mage, wingLevel: 5 }),
      player: mage,
      facilities: wing(5, "power_gym"),
    }).trainingSetpoints;

    expect(withPowerGym).toBeCloseTo(withoutWing, 2);
  });
});

describe("specialist wing — die KI wählt die Variante nach Kader", () => {
  it("zählt die Entwicklungsrouten des Kaders", () => {
    const state = gameState({ classNames: ["Berserker", "Warlord", "Mage", "Bard", "Sprinter"] });
    expect(countTeamRosterFocusAxes(state, "T-1")).toEqual({ pow: 2, spe: 1, men: 1, soc: 1 });
  });

  it("wählt für jeden Kader-Schwerpunkt die passende Variante — nicht mehr immer mind_lab", () => {
    const cases: Array<{ classNames: string[]; expected: SpecialistWingVariant }> = [
      { classNames: ["Berserker", "Warlord", "Tank", "Mage"], expected: "power_gym" },
      { classNames: ["Sprinter", "Rogue", "Charger", "Mage"], expected: "agility_track" },
      { classNames: ["Mage", "Overseer", "Tactician", "Berserker"], expected: "mind_lab" },
      { classNames: ["Bard", "Hero", "Templar", "Berserker"], expected: "social_studio" },
    ];

    const chosen = cases.map(({ classNames }) => chooseSpecialistWingVariantForTeam(gameState({ classNames }), "T-1"));

    expect(chosen).toEqual(cases.map((entry) => entry.expected));
    // Der eigentliche Punkt: die Wahl ist nicht konstant, sondern hängt am Kader.
    expect(new Set(chosen).size).toBe(4);
  });

  it("ein MEN-Fokus entsteht nur noch, wenn der Kader ihn hergibt", () => {
    const powRoster = gameState({ classNames: ["Berserker", "Warlord", "Tank", "Badass"] });
    const variant = chooseSpecialistWingVariantForTeam(powRoster, "T-1");

    expect(variant).not.toBe("mind_lab");
    expect(SPECIALIST_WING_VARIANTS[variant].focusAxis).toBe("pow");
  });

  it("bricht Gleichstand über den bereits gesetzten Trainingsfokus, sonst deterministisch", () => {
    const tied = ["Berserker", "Mage"];
    expect(chooseSpecialistWingVariantForTeam(gameState({ classNames: tied, trainingFocus: "MEN" }), "T-1")).toBe("mind_lab");
    expect(chooseSpecialistWingVariantForTeam(gameState({ classNames: tied, trainingFocus: "POW" }), "T-1")).toBe("power_gym");
    // Ohne Einstellung: stabil, aber jedenfalls kaderbasiert (POW steht vor MEN in der festen Reihenfolge).
    expect(chooseSpecialistWingVariantForTeam(gameState({ classNames: tied }), "T-1")).toBe("power_gym");
    // Ein Fokus, der gar nicht im Kader vorkommt, hebelt die Kaderzählung nicht aus.
    expect(chooseSpecialistWingVariantForTeam(gameState({ classNames: tied, trainingFocus: "SOC" }), "T-1")).toBe("power_gym");
  });

  it("fällt bei leerem oder routenlosem Kader auf den Katalog-Default zurück", () => {
    expect(chooseSpecialistWingVariantForTeam(gameState({ classNames: [] }), "T-1")).toBe("power_gym");
    expect(chooseSpecialistWingVariantForTeam(gameState({ classNames: ["Nonexistent Class"] }), "T-1")).toBe("power_gym");
  });
});
