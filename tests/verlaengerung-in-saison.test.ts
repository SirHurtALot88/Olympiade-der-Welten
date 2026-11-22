import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import {
  applyContractRenewalAction,
  applySeasonEndContractTick,
  previewContractRenewalAction,
  previewSeasonEndContracts,
  resolveContractExitRenewBias,
  resolveContractRenewalTco,
} from "@/lib/contracts/contract-renewal-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { assessPlayerMorale } from "@/lib/morale/player-morale-service";

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "A-A",
    shortCode: partial?.shortCode ?? "A-A",
    name: partial?.name ?? "Armageddon Aftermath",
    budget: partial?.budget ?? 100,
    cash: partial?.cash ?? 100,
    identityId: partial?.identityId ?? "A-A",
    humanControlled: partial?.humanControlled ?? false,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function createPlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: partial?.rating ?? 70,
    marketValue: partial?.marketValue ?? 45,
    salaryDemand: partial?.salaryDemand ?? 7,
    displayMarketValue: partial?.displayMarketValue ?? partial?.marketValue ?? 45,
    displaySalary: partial?.displaySalary ?? partial?.salaryDemand ?? 7,
    cost: partial?.cost,
    upkeepBase: partial?.upkeepBase,
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
    disciplineRatings: partial?.disciplineRatings ?? { climb: 70, chess: 65 },
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
    attributeSheetStats: partial?.attributeSheetStats,
    attributeSheetRatings: partial?.attributeSheetRatings,
    currentXP: partial?.currentXP,
    spentXP: partial?.spentXP,
    lifetimeXP: partial?.lifetimeXP,
  };
}

function createRosterEntry(playerId: string, partial?: Partial<RosterEntry>): RosterEntry {
  return {
    id: partial?.id ?? `roster:${partial?.teamId ?? "A-A"}:${playerId}`,
    teamId: partial?.teamId ?? "A-A",
    playerId,
    contractLength: partial?.contractLength ?? 2,
    contractStatus: partial?.contractStatus,
    salary: partial?.salary ?? 7,
    upkeep: partial?.upkeep ?? partial?.salary ?? 7,
    purchasePrice: partial?.purchasePrice ?? 45,
    currentValue: partial?.currentValue ?? 45,
    roleTag: partial?.roleTag ?? "starter",
    joinedSeasonId: partial?.joinedSeasonId ?? "season-1",
  };
}

function createGameState(input?: {
  teams?: Team[];
  players?: Player[];
  rosters?: RosterEntry[];
}): GameState {
  const teams = input?.teams ?? [createTeam()];
  return {
    gamePhase: "season_end_management",
    season: {
      id: "season-2",
      name: "Season 2",
      year: 2026,
      currentMatchday: 10,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: Object.fromEntries(teams.map((team) => [team.teamId, { points: 0 }])),
      teamControlSettings: Object.fromEntries(
        teams.map((team) => [
          team.teamId,
          {
            teamId: team.teamId,
            controlMode: team.humanControlled ? "manual" : "ai",
            ownerId: team.humanControlled ? "user_local" : "ai",
            ownerSlot: team.humanControlled ? "user" : "ai",
            displayLabel: team.shortCode,
            aiLineupPreviewEnabled: !team.humanControlled,
            aiLineupApplyEnabled: false,
            aiLineupAutoApplyEnabled: false,
            aiTransferPreviewEnabled: !team.humanControlled,
            aiTransferAutoApplyEnabled: false,
            aiSellPreviewEnabled: !team.humanControlled,
            aiSellAutoApplyEnabled: false,
          },
        ]),
      ),
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "resolved",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams,
    teamIdentities: [],
    players: input?.players ?? [],
    disciplines: [],
    rosters: input?.rosters ?? [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerProgressionEvents: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: input?.players?.length ?? 0,
      matchedRosterCount: input?.rosters?.length ?? 0,
      teamCount: teams.length,
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

import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { ermittleKiKandidatenInSaison, fuehreKiVerlaengerungenInSaisonAus } from "@/lib/contracts/ki-verlaengerung-in-saison";
import { stempleDraftPicksS1 } from "@/lib/contracts/draft-pick-markierung";
import { gespielteSpieltage, kiPruefSpieltag } from "@/lib/contracts/verlaengerung-in-saison";
import { getTeamActualSalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";

afterEach(() => {
  delete process.env.OLY_VERLAENGERUNG_IN_SAISON;
  delete process.env.NEXT_PUBLIC_OLY_VERLAENGERUNG_IN_SAISON;
});

let saveZaehler = 0;

function createSave(gameState: GameState): PersistedSaveGame {
  saveZaehler += 1;
  return {
    saveId: `in-saison-test-save-${saveZaehler}`,
    name: "In-Saison Test Save",
    status: "active",
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    gameState,
  };
}

function createPersistenceMock() {
  return {
    saveSingleplayerState: vi.fn(),
  } as unknown as PersistenceService;
}

const GESAMT = 10;

/** Saison 3, Phase season_active, `gespielt` von 10 Spieltagen gebucht. */
function inSaison(input: { gespielt: number; seasonId?: string; rosters: RosterEntry[]; players: Player[]; cash?: number }): PersistedSaveGame {
  const seasonId = input.seasonId ?? "season-3";
  const base = createGameState({ teams: [createTeam({ cash: input.cash ?? 100 })], players: input.players, rosters: input.rosters });
  const ids = Array.from({ length: GESAMT }, (_, i) => `matchday-${i + 1}`);
  const gameState: GameState = {
    ...base,
    gamePhase: "season_active",
    season: { ...base.season, id: seasonId, name: seasonId === "season-3" ? "Season 3" : seasonId, currentMatchday: input.gespielt + 1, matchdayIds: ids },
    matchdayState: { ...base.matchdayState, matchdayId: ids[Math.min(input.gespielt, GESAMT - 1)]!, status: "ready" },
    seasonState: {
      ...base.seasonState,
      seasonId,
      matchdayResults: ids.slice(0, input.gespielt).map((matchdayId, i) => ({
        id: `result-${i}`,
        saveId: "s",
        seasonId,
        matchdayId,
        status: "preview_applied" as const,
        sourceVersion: "test",
        teamsTotal: 1,
        teamsReady: 1,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "",
        updatedAt: "",
      })),
    },
  };
  return createSave(gameState);
}

function unterschreibe(save: PersistedSaveGame, opts: { laenge: number; gehalt: number; spieler?: string }) {
  const persistence = createPersistenceMock();
  const playerId = opts.spieler ?? "p1";
  const preview = previewContractRenewalAction({ save, teamId: "A-A", playerId, action: "renew", contractLength: opts.laenge, offeredSalary: opts.gehalt });
  const result = applyContractRenewalAction({
    save,
    teamId: "A-A",
    playerId,
    action: "renew",
    contractLength: opts.laenge,
    offeredSalary: opts.gehalt,
    confirmToken: preview.confirmToken,
    persistence,
    source: "manual_contract_renewal",
  });
  const gespeichert = vi.mocked(persistence.saveSingleplayerState).mock.calls[0]?.[1] as GameState | undefined;
  return { preview, result, gespeichert };
}

describe("Verlaengerung waehrend der Saison", () => {
  const spieler = () => [createPlayer("p1")];
  const letzteSaison = () => [createRosterEntry("p1", { contractLength: 1, salary: 6, joinedSeasonId: "season-1", roleTag: "bench" })];

  it("Phasen-Riegel: zwischen den Spieltagen offen, mit Schalter aus wie vorher zu", () => {
    const save = inSaison({ gespielt: 4, players: spieler(), rosters: letzteSaison() });
    const offen = evaluateGamePhaseAction(save.gameState, "renew_contract");
    expect(offen.allowed).toBe(true);
    expect(offen.warnings).toContain("in_season_renewal_window");
    process.env.OLY_VERLAENGERUNG_IN_SAISON = "0";
    const zu = evaluateGamePhaseAction(save.gameState, "renew_contract");
    expect(zu.allowed).toBe(false);
    expect(zu.reason).toBe("phase_blocked:renew_contract:season_active");
    delete process.env.OLY_VERLAENGERUNG_IN_SAISON;
    // Verkaufen bleibt davon unberuehrt gesperrt.
    expect(evaluateGamePhaseAction(save.gameState, "sell_players").allowed).toBe(false);
  });

  it("Laufzeitrechnung: die laufende Saison zaehlt mit (Saison 3, zwei Saisons -> bis Ende Saison 4)", () => {
    const save = inSaison({ gespielt: 4, players: spieler(), rosters: letzteSaison() });
    const { result, gespeichert, preview } = unterschreibe(save, { laenge: 2, gehalt: 8 });
    expect(result.applied).toBe(true);
    const eintrag = gespeichert!.rosters[0]!;
    expect(eintrag.contractLength).toBe(2);
    expect(eintrag.contractEndSeasonNumber).toBe(4);
    expect(eintrag.contractStatus).toBe("active");
    expect(preview.inSaison).toMatchObject({ abSpieltag: 5, gesamtSpieltage: GESAMT, endSaisonNummer: 4, endSaisonLabel: "Saison 4" });
    expect(eintrag.inSaisonVerlaengerung).toMatchObject({ seasonId: "season-3", spieltageAlt: 4, spieltageGesamt: GESAMT, altesGehalt: 6, neuesGehalt: 8 });
    expect(gespeichert!.seasonState.contractEvents?.[0]?.decisionReason).toBe("in_season_renewal:ab_spieltag_5");
  });

  it("Gehalt gilt ab sofort: Saisonsumme mischt alt (gebuchte Spieltage) und neu, ohne Rueckbuchung", () => {
    const save = inSaison({ gespielt: 4, players: spieler(), rosters: letzteSaison() });
    const vorher = getTeamActualSalaryTotal(save.gameState, "A-A");
    const { gespeichert } = unterschreibe(save, { laenge: 2, gehalt: 8 });
    const nachher = getTeamActualSalaryTotal(gespeichert!, "A-A");
    expect(vorher).toBe(6);
    // 4 von 10 Spieltagen alt (6), 6 neu (8): 6*0,4 + 8*0,6 = 7,2 — nicht 8 (rueckwirkend) und nicht 6 (nichts).
    expect(nachher).toBeCloseTo(7.2, 1);
    // Der Kader-Gehaltsstand (Vorstands-Gehaltstopf) rechnet dagegen mit dem vollen neuen Jahresgehalt.
    expect(gespeichert!.rosters[0]!.salary).toBe(8);
    // In der naechsten Saison greift der Vermerk nicht mehr: das neue Gehalt gilt voll.
    const naechsteSaison = { ...gespeichert!, season: { ...gespeichert!.season, id: "season-4" } } as GameState;
    expect(getTeamActualSalaryTotal(naechsteSaison, "A-A")).toBe(8);
  });

  it("niedrigeres Gehalt gilt ebenfalls ab sofort, ohne Rueckbuchung", () => {
    const save = inSaison({ gespielt: 5, players: spieler(), rosters: [createRosterEntry("p1", { contractLength: 1, salary: 14, roleTag: "bench" })] });
    const { gespeichert } = unterschreibe(save, { laenge: 2, gehalt: 10 });
    expect(getTeamActualSalaryTotal(gespeichert!, "A-A")).toBeCloseTo(12, 1);
  });

  it("einmal je Spieler und Saison; Laufzeit 1 ist keine Verlaengerung", () => {
    const save = inSaison({ gespielt: 4, players: spieler(), rosters: letzteSaison() });
    const eins = previewContractRenewalAction({ save, teamId: "A-A", playerId: "p1", action: "renew", contractLength: 1, offeredSalary: 8 });
    expect(eins.ok).toBe(false);
    expect(eins.blockingReasons).toContain("in_season_renewal_min_length_2");
    const { gespeichert } = unterschreibe(save, { laenge: 2, gehalt: 8 });
    const nochmal = previewContractRenewalAction({ save: createSave(gespeichert!), teamId: "A-A", playerId: "p1", action: "renew", contractLength: 3, offeredSalary: 9 });
    expect(nochmal.ok).toBe(false);
    expect(nochmal.blockingReasons).toContain("in_season_renewal_already_done");
  });

  it("nur Vertraege, die mit dieser Saison auslaufen", () => {
    const save = inSaison({ gespielt: 4, players: spieler(), rosters: [createRosterEntry("p1", { contractLength: 3, salary: 6 })] });
    const vorschau = previewContractRenewalAction({ save, teamId: "A-A", playerId: "p1", action: "renew", contractLength: 2, offeredSalary: 8 });
    expect(vorschau.ok).toBe(false);
    expect(vorschau.blockingReasons).toContain("renewal_only_allowed_at_contract_end");
  });

  it("Saison 1: Draft-Picks mit Festkonditionen werden erst am Ende von Saison 1 verhandelt", () => {
    const save = inSaison({ gespielt: 4, seasonId: "season-1", players: spieler(), rosters: letzteSaison() });
    const mitDraft: GameState = {
      ...save.gameState,
      seasonState: {
        ...save.gameState.seasonState,
        ligaDraft: {
          version: 1,
          saisonId: "season-1",
          status: "fertig",
          seed: "x",
          regeln: { maxRunden: 16, maxPicksJeTeam: 14, minKader: 8 },
          runde: 1,
          reihenfolge: ["A-A"],
          platz: 0,
          teams: {},
          verlauf: [{ nr: 1, pickNr: 1, runde: 1, platz: 1, teamId: "A-A", art: "pick", playerId: "p1", quelle: "ki", abloese: 1, gehalt: 1, transferId: null, top3: null, grund: null, zeit: "" }],
          erstelltAm: "",
          aktualisiertAm: "",
          beendetAm: null,
        },
      },
    };
    const gesperrt = previewContractRenewalAction({ save: createSave(mitDraft), teamId: "A-A", playerId: "p1", action: "renew", contractLength: 2, offeredSalary: 8 });
    expect(gesperrt.blockingReasons).toContain("in_season_renewal_draft_s1");
    const ohneDraft = previewContractRenewalAction({ save, teamId: "A-A", playerId: "p1", action: "renew", contractLength: 2, offeredSalary: 8 });
    expect(ohneDraft.blockingReasons).not.toContain("in_season_renewal_draft_s1");
  });

  it("Review 22.11. Befund 9: die Kennung am Roster sperrt auch OHNE Draft-Verlauf (Blocklauf-Draft)", () => {
    const save = inSaison({ gespielt: 4, seasonId: "season-1", players: spieler(), rosters: letzteSaison() });
    const gestempelt = stempleDraftPicksS1({ ...save.gameState, rosters: save.gameState.rosters.map((r) => ({ ...r, joinedSeasonId: save.gameState.season.id })) });
    expect(gestempelt.rosters.every((r) => r.draftPickS1 === true)).toBe(true);
    expect(stempleDraftPicksS1(gestempelt)).toBe(gestempelt);
    const gesperrt = previewContractRenewalAction({ save: createSave(gestempelt), teamId: "A-A", playerId: "p1", action: "renew", contractLength: 2, offeredSalary: 8 });
    expect(gesperrt.blockingReasons).toContain("in_season_renewal_draft_s1");
    const ohne = previewContractRenewalAction({ save, teamId: "A-A", playerId: "p1", action: "renew", contractLength: 2, offeredSalary: 8 });
    expect(ohne.blockingReasons).not.toContain("in_season_renewal_draft_s1");
  });

  it("Vorstands-Gehaltstopf bleibt hart (Gehaltserhoehung ueber dem freien Gehaltsbudget)", () => {
    const save = inSaison({ gespielt: 4, players: spieler(), rosters: letzteSaison(), cash: 5 });
    const vorschau = previewContractRenewalAction({ save, teamId: "A-A", playerId: "p1", action: "renew", contractLength: 2, offeredSalary: 9000 });
    expect(vorschau.ok).toBe(false);
    expect(vorschau.blockingReasons).toContain("vorstand_gehaltsbudget_nicht_freigegeben");
  });

  it("Schalter aus: der Dienst blockiert mitten in der Saison wie vorher", () => {
    process.env.OLY_VERLAENGERUNG_IN_SAISON = "0";
    const save = inSaison({ gespielt: 4, players: spieler(), rosters: letzteSaison() });
    const vorschau = previewContractRenewalAction({ save, teamId: "A-A", playerId: "p1", action: "renew", contractLength: 2, offeredSalary: 8 });
    expect(vorschau.ok).toBe(false);
    expect(vorschau.blockingReasons).toContain("in_season_renewal_disabled");
  });

  it("nach dem letzten Spieltag gilt das Saisonende-Fenster, nicht die In-Saison-Verlaengerung", () => {
    const save = inSaison({ gespielt: GESAMT, players: spieler(), rosters: letzteSaison() });
    const vorschau = previewContractRenewalAction({ save, teamId: "A-A", playerId: "p1", action: "renew", contractLength: 2, offeredSalary: 8 });
    expect(vorschau.blockingReasons).toContain("in_season_renewal_season_over");
  });

  it("Saisonende-Verlaengerung ist unveraendert (kein Vermerk, volles neues Gehalt)", () => {
    const save = createSave(
      createGameState({ players: spieler(), rosters: [createRosterEntry("p1", { contractLength: 0, contractStatus: "renewal_pending", salary: 6 })] }),
    );
    const { result, gespeichert } = unterschreibe(save, { laenge: 2, gehalt: 8 });
    expect(result.applied).toBe(true);
    expect(gespeichert!.rosters[0]!.inSaisonVerlaengerung ?? null).toBeNull();
    expect(getTeamActualSalaryTotal(gespeichert!, "A-A")).toBe(8);
  });

  it("KI: prueft je Spieler an einem festen Spieltag, nur Laufzeit 1, nie zweimal je Saison", () => {
    const players = [createPlayer("p1"), createPlayer("p2")];
    const rosters = [createRosterEntry("p1", { contractLength: 1, salary: 6, roleTag: "bench" }), createRosterEntry("p2", { contractLength: 3, salary: 6 })];
    const tag = kiPruefSpieltag("season-3", "A-A", "p1", GESAMT);
    expect(tag).toBeGreaterThanOrEqual(2);
    expect(tag).toBeLessThanOrEqual(GESAMT - 3);
    const amTag = inSaison({ gespielt: tag, players, rosters });
    expect(gespielteSpieltage(amTag.gameState)).toBe(tag);
    expect(ermittleKiKandidatenInSaison(amTag).map((e) => e.playerId)).toEqual(["p1"]);
    const anderer = inSaison({ gespielt: tag === 2 ? 3 : 2, players, rosters });
    expect(ermittleKiKandidatenInSaison(anderer)).toEqual([]);
    const mitVermerk = inSaison({
      gespielt: tag,
      players,
      rosters: [
        { ...rosters[0]!, inSaisonVerlaengerung: { seasonId: "season-3", spieltageAlt: 2, spieltageGesamt: GESAMT, altesGehalt: 6, neuesGehalt: 7, endSaisonNummer: 4 } },
        rosters[1]!,
      ],
    });
    expect(ermittleKiKandidatenInSaison(mitVermerk)).toEqual([]);
    process.env.OLY_VERLAENGERUNG_IN_SAISON = "0";
    expect(ermittleKiKandidatenInSaison(amTag)).toEqual([]);
  });

  it("KI: verlaengert nur (gibt nie frei) und hoechstens einmal je Spieler und Saison", () => {
    const players = [createPlayer("p1")];
    const rosters = [createRosterEntry("p1", { contractLength: 1, salary: 6, roleTag: "bench" })];
    const tag = kiPruefSpieltag("season-3", "A-A", "p1", GESAMT);
    const save = inSaison({ gespielt: tag, players, rosters });
    let gespeichert: PersistedSaveGame = save;
    const persistence = {
      getSaveById: () => gespeichert,
      saveSingleplayerState: (_id: string, gs: GameState) => {
        gespeichert = { ...gespeichert, gameState: gs };
        return gespeichert;
      },
    } as unknown as PersistenceService;
    const erst = fuehreKiVerlaengerungenInSaisonAus({ saveId: save.saveId, persistence });
    expect(erst.geprueft).toBe(1);
    const roster = gespeichert.gameState.rosters.find((e) => e.playerId === "p1");
    expect(roster).toBeTruthy();
    if (erst.verlaengert.length > 0) {
      expect(roster!.contractLength).toBeGreaterThanOrEqual(2);
      expect(roster!.inSaisonVerlaengerung?.seasonId).toBe("season-3");
      const zweit = fuehreKiVerlaengerungenInSaisonAus({ saveId: save.saveId, persistence });
      expect(zweit.verlaengert).toEqual([]);
    } else {
      expect(roster!.contractLength).toBe(1);
    }
  });
});
