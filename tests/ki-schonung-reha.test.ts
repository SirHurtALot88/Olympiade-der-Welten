import { describe, expect, it } from "vitest";

import { bauKiRehaBeiSpieltagsabschluss } from "@/lib/ai/ai-reha-bau-service";
import { buildAiLegacyLineupModifiers, mergeDelegatedLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { buildAiLegacyLineupSuggestion } from "@/lib/ai/ai-legacy-lineup-engine";
import {
  bestimmeKiSeitenIntensitaet,
  entscheideKiReha,
  istKaderDuenn,
  istTauschEignungsverlustKlein,
  KI_PUSH_DECKEL_SEITEN_FATIGUE,
  kiMindestKaderFuerRotation,
  resolveSpitzenbedarf,
  type KiRehaEingabe,
} from "@/lib/ai/ki-schonung-reha-regeln";
import type { GameState } from "@/lib/data/olyDataTypes";
import { resolvePlannerRosterTargets } from "@/lib/foundation/roster-limits";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";


function createContext(): LegacyLineupLoadedContext {
  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: "A-A",
    entries: [],
    disciplinePlayerCounts: {
      tdm: 2,
      "mini-dm": 2,
    },
    disciplineSidePlayerCounts: {
      "tdm::d1": 2,
      "mini-dm::d2": 2,
    },
    activePlayers: [
      { id: "a1", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "p1", upkeep: 10 },
      { id: "a2", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "p2", upkeep: 10 },
      { id: "a3", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "p3", upkeep: 10 },
      { id: "a4", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "p4", upkeep: 10 },
      { id: "a5", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "p5", upkeep: 10 },
    ],
    disciplineScores: [
      { playerId: "p1", disciplineId: "tdm", score: 90 },
      { playerId: "p2", disciplineId: "tdm", score: 88 },
      { playerId: "p3", disciplineId: "tdm", score: 40 },
      { playerId: "p4", disciplineId: "tdm", score: 30 },
      { playerId: "p5", disciplineId: "tdm", score: 20 },
      { playerId: "p1", disciplineId: "mini-dm", score: 60 },
      { playerId: "p2", disciplineId: "mini-dm", score: 65 },
      { playerId: "p3", disciplineId: "mini-dm", score: 89 },
      { playerId: "p4", disciplineId: "mini-dm", score: 87 },
      { playerId: "p5", disciplineId: "mini-dm", score: 10 },
    ],
    save: {
      id: "save-1",
      name: "Save 1",
      status: "active",
    },
    season: {
      id: "season-1",
      saveId: "save-1",
      name: "Season 1",
      year: 1,
      currentMatchday: 1,
      status: "active",
    },
    matchday: {
      id: "matchday-1",
      seasonId: "season-1",
      index: 1,
      label: "Spieltag 1",
      status: "planning",
    },
    team: {
      id: "A-A",
      shortCode: "A-A",
      name: "Armageddon Aftermath",
    },
    teamSeasonState: {
      id: "tss-1",
      saveId: "save-1",
      seasonId: "season-1",
      teamId: "A-A",
      cash: 500,
      budget: 1000,
      rosterLimit: 6,
      playerOpt: 5,
    },
    teamIdentity: {
      pow: 80,
      spe: 60,
      men: 50,
      soc: 40,
    },
    teamStrategyProfile: {
      teamId: "A-A",
      strategySummary: "Fallout-/Endzeit-Kader. Isoliert, skeptisch und ablehnend gegen fremde Vibes.",
      buyStyle: "Kauft nur harte Ueberlebensprofile mit Endzeit-Fit und mentaler Zaehigkeit.",
      sellStyle: "Verkauft offene Fehlfits ohne Shelter-Mentalitaet schnell.",
      contractStyle: "Kurze Probephasen, lange Deals nur fuer echte Survivors.",
      rosterStyle: "Zaeher Kern mit Misstrauen gegen Fremdkoerper.",
      preferredArchetypes: ["survivor"],
      avoidedArchetypes: ["soft celebrity"],
      preferredRaces: [],
      avoidedRaces: [],
      preferredClasses: [],
      avoidedClasses: [],
      hardNoGos: ["fragile diva"],
      notes: null,
      bias: {
        cashPriority: 6,
        valuePriority: 6,
        starPriority: 4,
        riskTolerance: 6,
        wageSensitivity: 7,
        sellForProfitAggression: 5,
        shortContractPreference: 7,
        longContractPreference: 3,
        loyaltyBias: 4,
        harmonyStrictness: 6,
        rosterDepthPreference: 7,
        eliteSmallRosterPreference: 4,
      },
    },
    rosterPlayers: [
      { id: "p1", name: "Player 1", coreStats: { pow: 80, spe: 20, men: 20, soc: 20 } },
      { id: "p2", name: "Player 2", coreStats: { pow: 75, spe: 30, men: 25, soc: 25 } },
      { id: "p3", name: "Player 3", coreStats: { pow: 20, spe: 70, men: 80, soc: 30 } },
      { id: "p4", name: "Player 4", coreStats: { pow: 15, spe: 75, men: 75, soc: 25 } },
      { id: "p5", name: "Player 5", coreStats: { pow: 10, spe: 10, men: 10, soc: 10 } },
    ],
    disciplines: [
      { id: "tdm", name: "TDM", category: "power" },
      { id: "mini-dm", name: "Mini DM", category: "power" },
    ],
    disciplineWeights: [
      { disciplineId: "tdm", attributeKey: "power", weightPct: 28 },
      { disciplineId: "tdm", attributeKey: "health", weightPct: 20 },
      { disciplineId: "tdm", attributeKey: "determination", weightPct: 6 },
      { disciplineId: "tdm", attributeKey: "spirit", weightPct: 12 },
      { disciplineId: "mini-dm", attributeKey: "torment", weightPct: 24 },
      { disciplineId: "mini-dm", attributeKey: "health", weightPct: 20 },
      { disciplineId: "mini-dm", attributeKey: "power", weightPct: 16 },
      { disciplineId: "mini-dm", attributeKey: "stamina", weightPct: 16 },
    ],
    seasonDisciplineConfigs: [
      { disciplineId: "tdm", originalOrder: 1, displayOrder: 1, playerCount: 2, mutator1: null, mutator2: null },
      { disciplineId: "mini-dm", originalOrder: 2, displayOrder: 2, playerCount: 2, mutator1: null, mutator2: null },
    ],
    teamStatus: {
      lineupFilledCount: 0,
      totalLineupSides: 20,
      captainUsedCount: 0,
      captainSlots: 3,
      displayLabel: "A-A · Lineup 0/20 · Captain 0/3",
    },
    captainRule: {
      seasonCaptainSlots: 3,
      perDisciplineSideMaxCaptains: 1,
      sourceStatus: "mapped_with_transform",
    },
    existingDraft: null,
    contextMeta: {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: "A-A",
      d1DisciplineId: "tdm",
      d2DisciplineId: "mini-dm",
    },
  };
}

// ---------------------------------------------------------------------------------------------
// R1 + R2: Intensitaet (reine Funktion)
// ---------------------------------------------------------------------------------------------
const BASIS = {
  avgSideFatigue: 0,
  matchdayIndex: 6,
  duennerKader: false,
  isWeakDisciplineWindow: false,
  wantsPush: true,
  chancenloseSeiteImAnlauf: false,
} as const;

describe("KI-Schonung R1: Push-Deckel", () => {
  it("pusht nur bis Seiten-Durchschnitt 30 (vorher 65)", () => {
    expect(bestimmeKiSeitenIntensitaet({ ...BASIS, avgSideFatigue: 30 })).toBe("push");
    expect(bestimmeKiSeitenIntensitaet({ ...BASIS, avgSideFatigue: 30.1 })).toBe("normal");
    expect(bestimmeKiSeitenIntensitaet({ ...BASIS, avgSideFatigue: 39 })).toBe("normal");
    // Ab 40 greift R2: dann wird nicht mehr gepusht, sondern geschont.
    expect(bestimmeKiSeitenIntensitaet({ ...BASIS, avgSideFatigue: 50 })).toBe("conserve");
  });

  it("bindet auch den Kapitaens-Push an dieselbe Grenze (wantsPush enthaelt den Kapitaen)", () => {
    // Die Funktion kennt den Kapitaen nur als Teil von wantsPush: gleiche Grenze, kein Sonderweg.
    expect(bestimmeKiSeitenIntensitaet({ ...BASIS, avgSideFatigue: 45 })).not.toBe("push");
    expect(KI_PUSH_DECKEL_SEITEN_FATIGUE).toBe(30);
  });

  it("pusht mit duennem Kader nie", () => {
    expect(bestimmeKiSeitenIntensitaet({ ...BASIS, duennerKader: true })).toBe("normal");
    expect(istKaderDuenn(9, 8)).toBe(true);
    expect(istKaderDuenn(9, 7)).toBe(false);
    expect(istKaderDuenn(10, 12)).toBe(true);
    expect(istKaderDuenn(14, 12)).toBe(false);
  });

  it("ohne Push-Wunsch bleibt es bei normal", () => {
    expect(bestimmeKiSeitenIntensitaet({ ...BASIS, wantsPush: false, avgSideFatigue: 10 })).toBe("normal");
  });
});

describe("KI-Schonung R2: Schonen ab Seiten-Durchschnitt 40, die ganze Saison", () => {
  it("schont ab 40 unabhaengig vom Push-Wunsch und vom Spieltag", () => {
    for (const matchdayIndex of [1, 3, 8, 19]) {
      expect(bestimmeKiSeitenIntensitaet({ ...BASIS, matchdayIndex, avgSideFatigue: 40 })).toBe("conserve");
      expect(bestimmeKiSeitenIntensitaet({ ...BASIS, matchdayIndex, wantsPush: false, avgSideFatigue: 55 })).toBe("conserve");
    }
    expect(bestimmeKiSeitenIntensitaet({ ...BASIS, avgSideFatigue: 39.9 })).toBe("normal");
  });

  it("schont auch im schwachen Fenster ab 40, ohne Spieltagsgrenze", () => {
    expect(bestimmeKiSeitenIntensitaet({ ...BASIS, isWeakDisciplineWindow: true, matchdayIndex: 9, avgSideFatigue: 41 })).toBe("conserve");
  });

  it("schont an Spieltag 1 bis 2 nur noch bei Seiten-Durchschnitt ueber 25", () => {
    const schwach = { ...BASIS, isWeakDisciplineWindow: true, wantsPush: false };
    expect(bestimmeKiSeitenIntensitaet({ ...schwach, matchdayIndex: 1, avgSideFatigue: 0 })).toBe("normal");
    expect(bestimmeKiSeitenIntensitaet({ ...schwach, matchdayIndex: 2, avgSideFatigue: 25 })).toBe("normal");
    expect(bestimmeKiSeitenIntensitaet({ ...schwach, matchdayIndex: 2, avgSideFatigue: 26 })).toBe("conserve");
    expect(bestimmeKiSeitenIntensitaet({ ...schwach, matchdayIndex: 3, avgSideFatigue: 30 })).toBe("normal");
    const anlauf = { ...BASIS, wantsPush: false, chancenloseSeiteImAnlauf: true };
    expect(bestimmeKiSeitenIntensitaet({ ...anlauf, matchdayIndex: 1, avgSideFatigue: 0 })).toBe("normal");
    expect(bestimmeKiSeitenIntensitaet({ ...anlauf, matchdayIndex: 1, avgSideFatigue: 30 })).toBe("conserve");
  });
});

describe("KI-Schonung R1/R2: im Aufstellungsbau (Mensch ueberschreibt)", () => {
  it("setzt eine muede Seite auf Schonen und laesst die vom Menschen gesetzte Intensitaet stehen", () => {
    const context = createContext();
    context.matchday = { ...context.matchday, index: 6 };
    context.matchdayContract = {
      matchdayIndex: 6,
      totalDisciplineSidesInSeason: 20,
      discipline1: { disciplineId: "tdm", requiredPlayers: 2 },
      discipline2: { disciplineId: "mini-dm", requiredPlayers: 2 },
    } as unknown as typeof context.matchdayContract;
    context.teamDisciplineRanks = {
      tdm: { disciplineId: "tdm", teamId: "A-A", rank: 4, score: 500 },
    } as unknown as typeof context.teamDisciplineRanks;
    context.fatigueByPlayerId = {
      p1: { count: 46 },
      p2: { count: 48 },
    } as unknown as typeof context.fatigueByPlayerId;
    const entries = [
      { disciplineId: "tdm", disciplineSide: "d1" as const, slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
      { disciplineId: "tdm", disciplineSide: "d1" as const, slotIndex: 1, playerId: "p2", activePlayerId: "a2" },
    ];
    const ki = buildAiLegacyLineupModifiers(context, entries);
    expect(ki.d1.intensity).toBe("conserve");

    const human = { d1: { ...ki.d1, intensity: "push" as const }, d2: { ...ki.d2, intensity: "normal" as const } };
    expect(mergeDelegatedLineupModifiers(human, ki).d1.intensity).toBe("push");
  });
});

// ---------------------------------------------------------------------------------------------
// R3: Tauschpruefung in der Engine
// ---------------------------------------------------------------------------------------------
function kontextMitBank(input: { starterFatigue: number; bankScoreTdm: number }) {
  const context = createContext();
  context.disciplineScores = context.disciplineScores.map((entry) =>
    entry.playerId === "p5" && entry.disciplineId === "tdm" ? { ...entry, score: input.bankScoreTdm } : entry,
  );
  context.rosterPlayers = (context.rosterPlayers ?? []).map((player) => ({
    ...player,
    fatigue: player.id === "p2" ? input.starterFatigue : player.id === "p5" ? 8 : 10,
  })) as typeof context.rosterPlayers;
  context.fatigueByPlayerId = Object.fromEntries(
    (context.rosterPlayers ?? []).map((player) => [player.id, { count: (player as { fatigue?: number }).fatigue ?? 0 }]),
  ) as unknown as typeof context.fatigueByPlayerId;
  return context;
}

describe("KI-Schonung R3: muede Starter gegen frischeren Ersatz tauschen", () => {
  it("tauscht einen Starter ueber Fatigue 40 gegen einen >= 10 Punkte frischeren Ersatz mit kleinem Eignungsverlust", () => {
    // p2 (tdm 88, Fatigue 46) gegen p5 (tdm 85, Fatigue 8): Verlust 3 von 88 = 3,4 % <= 8 %.
    const suggestion = buildAiLegacyLineupSuggestion(kontextMitBank({ starterFatigue: 46, bankScoreTdm: 85 }));
    const tdm = suggestion.entries.filter((entry) => entry.disciplineSide === "d1").map((entry) => entry.playerId);
    expect(tdm).toContain("p5");
    expect(tdm).not.toContain("p2");
  });

  it("tauscht nicht, wenn der Eignungsverlust zu gross ist", () => {
    const suggestion = buildAiLegacyLineupSuggestion(kontextMitBank({ starterFatigue: 46, bankScoreTdm: 70 }));
    const tdm = suggestion.entries.filter((entry) => entry.disciplineSide === "d1").map((entry) => entry.playerId);
    expect(tdm).toContain("p2");
    expect(tdm).not.toContain("p5");
  });

  it("die Eignungsgrenze ist 8 Prozent des Starters", () => {
    expect(istTauschEignungsverlustKlein(100, 92)).toBe(true);
    expect(istTauschEignungsverlustKlein(100, 91.9)).toBe(false);
    expect(istTauschEignungsverlustKlein(100, 120)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// R4: Reha
// ---------------------------------------------------------------------------------------------
const REHA_BASIS: KiRehaEingabe = {
  kaderGroesse: 12,
  spitzenbedarf: 12,
  fatigueAvg: 20,
  verletzungenDieseSaison: 0,
  verletzungenVorsaison: 0,
  aktuelleStufe: 0,
  finanzwert: 5,
  freiesGeldNachRuecklage: 15,
  naechsteStufeKosten: 7,
};

describe("KI-Schonung R4: Reha-Entscheidung", () => {
  it("baut ohne Grund nichts", () => {
    const e = entscheideKiReha(REHA_BASIS);
    expect(e.bauen).toBe(false);
    expect(e.zielStufe).toBe(0);
  });

  it("baut Stufe 1 bei duennem Kader (Kader <= Spitzenbedarf - 2)", () => {
    expect(entscheideKiReha({ ...REHA_BASIS, kaderGroesse: 10 }).bauen).toBe(true);
    expect(entscheideKiReha({ ...REHA_BASIS, kaderGroesse: 11 }).bauen).toBe(false);
    expect(entscheideKiReha({ ...REHA_BASIS, kaderGroesse: 9 }).grund).toContain("duenner_kader");
  });

  it("baut Stufe 1 bei hoher Erschoepfung oder Verletzungslast", () => {
    expect(entscheideKiReha({ ...REHA_BASIS, fatigueAvg: 40 })).toMatchObject({ bauen: true, zielStufe: 1 });
    expect(entscheideKiReha({ ...REHA_BASIS, verletzungenDieseSaison: 3 })).toMatchObject({ bauen: true, zielStufe: 1 });
    expect(entscheideKiReha({ ...REHA_BASIS, verletzungenVorsaison: 4 })).toMatchObject({ bauen: true, zielStufe: 1 });
  });

  it("zielt auf Stufe 2 bei hoher Verletzungslast oder viel freiem Geld bei Finanzwert >= 6", () => {
    expect(entscheideKiReha({ ...REHA_BASIS, verletzungenDieseSaison: 5, aktuelleStufe: 1, naechsteStufeKosten: 13 })).toMatchObject({
      zielStufe: 2,
      bauen: true,
    });
    expect(entscheideKiReha({ ...REHA_BASIS, freiesGeldNachRuecklage: 30, finanzwert: 6 }).zielStufe).toBe(2);
    expect(entscheideKiReha({ ...REHA_BASIS, freiesGeldNachRuecklage: 30, finanzwert: 5.9 }).zielStufe).toBe(0);
    expect(entscheideKiReha({ ...REHA_BASIS, freiesGeldNachRuecklage: 29, finanzwert: 8 }).zielStufe).toBe(0);
  });

  it("baut nicht, was die Ruecklage nicht hergibt, und nichts ueber das Ziel hinaus", () => {
    const ohneGeld = entscheideKiReha({ ...REHA_BASIS, kaderGroesse: 9, freiesGeldNachRuecklage: 6.9 });
    expect(ohneGeld.bauen).toBe(false);
    expect(ohneGeld.amGeldGescheitert).toBe(true);
    expect(entscheideKiReha({ ...REHA_BASIS, kaderGroesse: 9, aktuelleStufe: 1, naechsteStufeKosten: 13 }).bauen).toBe(false);
    expect(entscheideKiReha({ ...REHA_BASIS, kaderGroesse: 9, naechsteStufeKosten: null }).bauen).toBe(false);
  });
});

function rehaSpielstand(opts: { teams: Array<{ id: string; modus: "ai" | "manual"; delegiertGebaeude?: boolean; kader: number; cash: number }> }): GameState {
  const players: GameState["players"] = [];
  const rosters: GameState["rosters"] = [];
  for (const team of opts.teams) {
    for (let i = 0; i < team.kader; i += 1) {
      const id = `${team.id}-p${i}`;
      players.push({ id, name: id, marketValue: 5, fatigue: 10 } as unknown as GameState["players"][number]);
      rosters.push({ teamId: team.id, playerId: id, salary: 3 } as unknown as GameState["rosters"][number]);
    }
  }
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 3, matchdayIds: ["matchday-3"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      disciplineSchedule: [
        {
          seasonId: "season-1",
          matchdayId: "matchday-3",
          matchdayIndex: 3,
          matchdayLabel: "Spieltag 3",
          discipline1: { playerCount: 6 },
          discipline2: { playerCount: 6 },
          sourceStatus: "mapped",
          sourceNote: null,
        },
      ],
      teamControlSettings: Object.fromEntries(
        opts.teams.map((team) => [
          team.id,
          {
            teamId: team.id,
            controlMode: team.modus,
            ownerId: team.modus === "ai" ? null : "user_local",
            delegation: team.delegiertGebaeude ? { stufe: "halbautomatik", bereiche: { gebaeude: "ki" } } : undefined,
          },
        ]),
      ),
    },
    matchdayState: { matchdayId: "matchday-3", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: opts.teams.map((team) => ({
      teamId: team.id,
      shortCode: team.id,
      name: team.id,
      budget: team.cash,
      cash: team.cash,
      identityId: `identity-${team.id}`,
      humanControlled: team.modus === "manual",
      rosterLimit: 14,
    })),
    teamIdentities: opts.teams.map((team) => ({ teamId: team.id, finances: 5, playerMin: 8, playerOpt: 9 })),
    players,
    disciplines: [],
    rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
  } as unknown as GameState;
}

function speicher(gameState: GameState) {
  let aktuell: PersistedSaveGame = {
    saveId: "save-reha",
    name: "Reha",
    status: "active",
    createdAt: "2026-11-21T00:00:00.000Z",
    updatedAt: "2026-11-21T00:00:00.000Z",
    gameState,
  };
  const persistence = {
    getSaveById: () => aktuell,
    saveSingleplayerState: (saveId: string, next: GameState) => {
      aktuell = { ...aktuell, saveId, gameState: next };
      return aktuell;
    },
  } as unknown as PersistenceService;
  return { persistence, lies: () => aktuell.gameState };
}

describe("KI-Schonung R4: Reha-Bau im laufenden Spiel", () => {
  it("baut bei duenner KI-Mannschaft Stufe 1, nur eine Stufe je Lauf, und bezahlt aus der Kasse", () => {
    const { persistence, lies } = speicher(
      rehaSpielstand({
        teams: [
          { id: "KI-D", modus: "ai", kader: 9, cash: 40 },
          { id: "KI-T", modus: "ai", kader: 13, cash: 40 },
        ],
      }),
    );
    const erster = bauKiRehaBeiSpieltagsabschluss({ saveId: "save-reha", persistence });
    expect(erster.gebaut.map((b) => b.teamId)).toEqual(["KI-D"]);
    const nachher = lies();
    expect(nachher.seasonState.teamFacilities?.["KI-D"]?.facilities.recovery_center?.level).toBe(1);
    expect(nachher.seasonState.teamFacilities?.["KI-T"]?.facilities.recovery_center?.level ?? 0).toBe(0);
    expect(nachher.teams.find((t) => t.teamId === "KI-D")!.cash).toBeLessThan(40);

    // Zweiter Lauf: Stufe 1 ist das Ziel (nur duenner Kader), also keine weitere Stufe.
    const zweiter = bauKiRehaBeiSpieltagsabschluss({ saveId: "save-reha", persistence });
    expect(zweiter.gebaut).toHaveLength(0);
  });

  it("baut nicht, wenn nach der Ruecklage zu wenig frei ist", () => {
    const { persistence, lies } = speicher(rehaSpielstand({ teams: [{ id: "KI-D", modus: "ai", kader: 9, cash: 8 }] }));
    const ergebnis = bauKiRehaBeiSpieltagsabschluss({ saveId: "save-reha", persistence });
    expect(ergebnis.gebaut).toHaveLength(0);
    expect(lies().seasonState.teamFacilities?.["KI-D"]?.facilities.recovery_center?.level ?? 0).toBe(0);
  });

  it("rechnet die Ruecklage in Saison 1 aus der Kasse, nicht aus Kasse plus Kaderwert", () => {
    const gs = rehaSpielstand({ teams: [{ id: "KI-D", modus: "ai", kader: 9, cash: 20 }] });
    for (const player of gs.players) (player as unknown as { marketValue: number }).marketValue = 30;
    const { persistence, lies } = speicher(gs);
    const ergebnis = bauKiRehaBeiSpieltagsabschluss({ saveId: "save-reha", persistence });
    expect(ergebnis.gebaut.map((b) => b.teamId)).toEqual(["KI-D"]);
    expect(lies().seasonState.teamFacilities?.["KI-D"]?.facilities.recovery_center?.level).toBe(1);
  });

  it("fasst Menschen-Teams nur bei delegiertem Bereich Gebaeude an", () => {
    const { persistence, lies } = speicher(
      rehaSpielstand({
        teams: [
          { id: "MENSCH", modus: "manual", kader: 9, cash: 40 },
          { id: "DELEG", modus: "manual", delegiertGebaeude: true, kader: 9, cash: 40 },
        ],
      }),
    );
    const ergebnis = bauKiRehaBeiSpieltagsabschluss({ saveId: "save-reha", persistence });
    expect(ergebnis.gebaut.map((b) => b.teamId)).toEqual(["DELEG"]);
    expect(ergebnis.uebersprungenMensch).toBe(1);
    expect(lies().seasonState.teamFacilities?.MENSCH?.facilities.recovery_center?.level ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// R5: Kader auffuellen
// ---------------------------------------------------------------------------------------------
describe("KI-Schonung R5: Teams unter 11 Spielern werden bevorzugt aufgefuellt (Review 22.11.)", () => {
  it("hebt das Planer-Ziel auf Spitzenbedarf minus 1, aber nie ueber das Kadermaximum", () => {
    const gameState = rehaSpielstand({ teams: [{ id: "KI-D", modus: "ai", kader: 9, cash: 40 }] });
    expect(kiMindestKaderFuerRotation(12)).toBe(11);
    expect(resolveSpitzenbedarf(gameState)).toBe(12);
    const ziele = resolvePlannerRosterTargets(gameState, "KI-D");
    expect(ziele.playerOpt).toBe(11);
    expect(ziele.playerMin).toBe(8);
  });

  it("laesst groessere Ziele unangetastet", () => {
    const gameState = rehaSpielstand({ teams: [{ id: "KI-D", modus: "ai", kader: 9, cash: 40 }] });
    gameState.teamIdentities[0]!.playerOpt = 12;
    expect(resolvePlannerRosterTargets(gameState, "KI-D").playerOpt).toBe(12);
  });
});
