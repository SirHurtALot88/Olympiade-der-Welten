import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, LineupDraft, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import {
  buildFormCardSeasonUsageAudit,
  ensureLocalFormCardsForSeason,
  getTeamFormCardOptions,
} from "@/lib/lineups/legacy-lineup-modifiers";
// Statisch importiert (vi.mock wird ohnehin nach oben gehoben): der dynamische Import des
// Transfermarkt-Service kostet beim ersten Aufruf mehrere Sekunden und lief in das 5s-Limit
// des jeweils ERSTEN Tests, der ihn anfasste.
import {
  executeLocalTransfermarktBuy,
  executeLocalTransfermarktSell,
} from "@/lib/market/transfermarkt-local-service";

/**
 * Formkarten gehoeren einer KADERZUGEHOERIGKEIT, nicht einem Team-Konto: der Generator
 * (`buildGeneratedFormCardRecordsForTeam`) baut sie ausschliesslich aus `gameState.rosters` und
 * schluesselt sie ueber (Season, Team, Spieler). Der Transfermarkt schreibt aber nur `rosters` —
 * `executeLocalTransfermarktBuy`/`...Sell` fassen `seasonState.formCards` nie an. Diese Suite nagelt
 * beide Richtungen der Selbstheilung fest:
 *   Kauf    → der Kaeufer bekommt die zwei Karten des Spielers (positiv + negativ).
 *   Verkauf → der Verkaeufer verliert die ungespielten Karten wieder; gespielte bleiben stehen.
 * Ohne die Aufraeum-Richtung behielt der Verkaeufer die Karten des abgegebenen Spielers: er konnte
 * sie weiter ausspielen, und eine ungespielte NEGATIVE Karte kostete ihn am Saisonende Punkte.
 *
 * Ein Vereinswechsel INNERHALB einer Saison wird hier bewusst nicht geprueft: der Markt laesst den
 * Rueckkauf eines in dieser Saison verkauften Spielers nicht zu (`player_sold_this_season_unavailable`),
 * beide Teams koennen dieselbe Karte also gar nicht gleichzeitig halten.
 */

const persistenceState = {
  save: null as { saveId: string; gameState: GameState } | null,
  saveSingleplayerState: vi.fn(),
};

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    bootstrapSingleplayerSave: () => ({ save: persistenceState.save, createdFromSeed: false }),
    getActiveSave: () => persistenceState.save,
    getSaveById: (saveId: string) => (persistenceState.save?.saveId === saveId ? persistenceState.save : null),
    saveSingleplayerState: (saveId: string, nextState: GameState) => {
      persistenceState.saveSingleplayerState(saveId, nextState);
      if (persistenceState.save && persistenceState.save.saveId === saveId) {
        persistenceState.save = { ...persistenceState.save, gameState: nextState };
      }
      return persistenceState.save;
    },
  }),
}));

const SAVE_ID = "save-formcard-transfer";
const SEASON_ID = "season-1";

function createTeam(teamId: string, partial?: Partial<Team>): Team {
  return {
    teamId,
    shortCode: teamId,
    name: partial?.name ?? `Team ${teamId}`,
    budget: partial?.budget ?? 500,
    cash: partial?.cash ?? 500,
    identityId: teamId,
    humanControlled: partial?.humanControlled ?? false,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: null,
  };
}

function createPlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: 50,
    marketValue: partial?.marketValue ?? 20,
    salaryDemand: partial?.salaryDemand ?? 5,
    displayMarketValue: partial?.marketValue ?? 20,
    displaySalary: partial?.salaryDemand ?? 5,
    pps: null,
    ovr: null,
    // "Berserker" ist im CLASS_COLOR_MAP hinterlegt (rot) — ohne Kartenfarbe erzeugt der
    // Generator bewusst gar keine Formkarte, der Test wuerde dann am falschen Ende messen.
    className: partial?.className ?? "Berserker",
    race: "Human",
    alignment: "N",
    gender: "f",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
    preferredDisciplineIds: [],
    disciplineRatings: { d1: 10, d2: 10 },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  };
}

function createRosterEntry(id: string, teamId: string, playerId: string): RosterEntry {
  return {
    id,
    teamId,
    playerId,
    contractLength: 3,
    salary: 5,
    upkeep: 5,
    purchasePrice: 20,
    currentValue: 20,
    roleTag: "starter",
    promisedRole: null,
    joinedSeasonId: SEASON_ID,
  };
}

function createGameState(input: {
  teams: Team[];
  players: Player[];
  rosters: RosterEntry[];
  gamePhase?: GameState["gamePhase"];
  lineupDrafts?: LineupDraft[];
}): GameState {
  return {
    season: {
      id: SEASON_ID,
      name: "Season 1",
      year: 2026,
      currentMatchday: 1,
      matchdayIds: ["matchday-1"],
    },
    gamePhase: input.gamePhase ?? "transfer_sell_phase",
    seasonState: {
      seasonId: SEASON_ID,
      schedule: [],
      standings: Object.fromEntries(input.teams.map((team) => [team.teamId, { points: 0 }])),
      lineupDrafts: input.lineupDrafts ?? [],
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: input.teams,
    teamIdentities: [],
    players: input.players,
    disciplines: [],
    rosters: input.rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: input.teams.length,
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

/** Karten eines Spielers im Kartenbestand eines Teams — die Groesse, um die es hier geht. */
function cardsOf(gameState: GameState, teamId: string, playerId: string) {
  return (gameState.seasonState.formCards ?? []).filter(
    (card) => card.teamId === teamId && card.playerId === playerId,
  );
}

function baseGameState() {
  return createGameState({
    teams: [
      // Mensch und KI im selben Save — die Kartenlogik darf die beiden nicht unterscheiden.
      createTeam("A-A", { humanControlled: true, cash: 500 }),
      createTeam("B-B", { humanControlled: false, cash: 500 }),
    ],
    players: [
      createPlayer("p-a1"),
      createPlayer("p-a2"),
      createPlayer("p-b1"),
      createPlayer("p-b2"),
      createPlayer("fa-1", { name: "Freie Kraft 1" }),
      createPlayer("fa-2", { name: "Freie Kraft 2" }),
    ],
    rosters: [
      createRosterEntry("r-a1", "A-A", "p-a1"),
      createRosterEntry("r-a2", "A-A", "p-a2"),
      createRosterEntry("r-b1", "B-B", "p-b1"),
      createRosterEntry("r-b2", "B-B", "p-b2"),
    ],
  });
}

describe("Formkarten bei Kauf und Verkauf", () => {
  // Eigene saveId je Test: `buildLocalMarketContext` cacht seinen Kontext pro (saveId + Inhalts-
  // Signatur). Teilen sich zwei Tests dieselbe saveId bei nahezu gleichem State, erbt der zweite
  // die gecachte Spielphase des ersten — ein Verkaufstest lief so gegen ein Kauffenster und wurde
  // mit `sell_only_at_season_end` abgewiesen.
  function installSave(saveId: string, gameState: GameState) {
    persistenceState.save = { saveId, gameState };
    return saveId;
  }

  beforeEach(() => {
    persistenceState.saveSingleplayerState.mockReset();
    persistenceState.save = null;
  });

  it("gibt jedem Kaderspieler genau zwei Formkarten: eine positive und eine negative", () => {
    const saveId = installSave("save-formcards-basis", baseGameState());
    const healed = ensureLocalFormCardsForSeason(persistenceState.save!.gameState, saveId, SEASON_ID);
    const cards = healed.seasonState.formCards ?? [];

    expect(cards).toHaveLength(healed.rosters.length * 2);
    for (const entry of healed.rosters) {
      const playerCards = cardsOf(healed, entry.teamId, entry.playerId);
      // Der Kartenwert selbst darf 0 sein (FORM_CARD_VALUES enthaelt die 0) — eine solche Karte
      // ist im UI nur nicht waehlbar. Der ANSPRUCH sind trotzdem immer zwei Karten je Spieler,
      // deshalb wird hier ueber die Vorzeichen-Slots geprueft und nicht ueber den Wert.
      expect(playerCards.map((card) => card.id).sort()).toEqual(
        [
          `formcard:${SEASON_ID}:${entry.teamId}:${entry.playerId}:negative`,
          `formcard:${SEASON_ID}:${entry.teamId}:${entry.playerId}:positive`,
        ].sort(),
      );
      expect(playerCards.find((card) => card.id.endsWith(":positive"))!.cardValue).toBeGreaterThanOrEqual(0);
      expect(playerCards.find((card) => card.id.endsWith(":negative"))!.cardValue).toBeLessThanOrEqual(0);
    }
  });

  it("legt beim Kauf durch ein menschlich gesteuertes Team zwei Formkarten fuer den neuen Spieler an", () => {
    const saveId = installSave("save-formcards-kauf-mensch", {
      ...ensureLocalFormCardsForSeason(baseGameState(), "save-formcards-kauf-mensch", SEASON_ID),
      gamePhase: "season_active",
    });
    expect(cardsOf(persistenceState.save!.gameState, "A-A", "fa-1")).toHaveLength(0);

    expect(
      executeLocalTransfermarktBuy({ saveId, seasonId: SEASON_ID, teamId: "A-A", playerId: "fa-1" }).canBuy,
    ).toBe(true);

    // Der Transfer schreibt nur den Kader — die Karten entstehen im naechsten Aufstellungs-/
    // Spieltagspfad ueber die Selbstheilung.
    const healed = ensureLocalFormCardsForSeason(persistenceState.save!.gameState, saveId, SEASON_ID);
    expect(cardsOf(healed, "A-A", "fa-1").map((card) => card.id).sort()).toEqual([
      `formcard:${SEASON_ID}:A-A:fa-1:negative`,
      `formcard:${SEASON_ID}:A-A:fa-1:positive`,
    ]);
  });

  it("gibt einem KI-Team beim Kauf genau dieselben zwei Karten wie einem menschlichen Team", () => {
    const saveId = installSave("save-formcards-kauf-ki", {
      ...baseGameState(),
      gamePhase: "season_active",
    });

    expect(executeLocalTransfermarktBuy({ saveId, seasonId: SEASON_ID, teamId: "A-A", playerId: "fa-1" }).canBuy).toBe(
      true,
    );
    expect(executeLocalTransfermarktBuy({ saveId, seasonId: SEASON_ID, teamId: "B-B", playerId: "fa-2" }).canBuy).toBe(
      true,
    );

    const healed = ensureLocalFormCardsForSeason(persistenceState.save!.gameState, saveId, SEASON_ID);
    // A-A ist humanControlled, B-B nicht — die Kartenlogik kennt den Unterschied nicht.
    expect(cardsOf(healed, "A-A", "fa-1")).toHaveLength(2);
    expect(cardsOf(healed, "B-B", "fa-2")).toHaveLength(2);
  });

  it("nimmt dem Verkaeufer die ungespielten Formkarten des abgegebenen Spielers", () => {
    const saveId = installSave(
      "save-formcards-verkauf",
      ensureLocalFormCardsForSeason(baseGameState(), "save-formcards-verkauf", SEASON_ID),
    );
    expect(cardsOf(persistenceState.save!.gameState, "A-A", "p-a1")).toHaveLength(2);

    expect(
      executeLocalTransfermarktSell({ saveId, seasonId: SEASON_ID, teamId: "A-A", activePlayerId: "r-a1" }).canSell,
    ).toBe(true);

    const healed = ensureLocalFormCardsForSeason(persistenceState.save!.gameState, saveId, SEASON_ID);
    expect(cardsOf(healed, "A-A", "p-a1")).toHaveLength(0);
    // Der verbliebene Kader behaelt seine Karten unveraendert.
    expect(cardsOf(healed, "A-A", "p-a2")).toHaveLength(2);
    expect(
      getTeamFormCardOptions({ gameState: healed, seasonId: SEASON_ID, teamId: "A-A" }).filter(
        (option) => option.playerId === "p-a1",
      ),
    ).toHaveLength(0);
  });

  it("laesst eine bereits gespielte Formkarte auch nach dem Verkauf im Bestand", () => {
    const saveId = "save-formcards-gespielte-karte";
    const withCards = ensureLocalFormCardsForSeason(baseGameState(), saveId, SEASON_ID);
    const playedCard = cardsOf(withCards, "A-A", "p-a1")[0]!;
    const draft: LineupDraft = {
      lineupId: "lineup-a-md1",
      saveId,
      seasonId: SEASON_ID,
      matchdayId: "matchday-1",
      teamId: "A-A",
      status: "resolved",
      entries: [],
      modifiers: {
        d1: {
          primaryFormCardId: playedCard.id,
          secondaryFormCardId: null,
          mutatorTrait1: null,
          mutatorTrait2: null,
          teamPowerId: null,
          intensity: "normal",
        },
        d2: {
          primaryFormCardId: null,
          secondaryFormCardId: null,
          mutatorTrait1: null,
          mutatorTrait2: null,
          teamPowerId: null,
          intensity: "normal",
        },
      },
      createdAt: "2026-06-10T12:00:00.000Z",
      updatedAt: "2026-06-10T12:00:00.000Z",
    };
    installSave(saveId, {
      ...withCards,
      seasonState: { ...withCards.seasonState, lineupDrafts: [draft] },
    });

    expect(
      executeLocalTransfermarktSell({ saveId, seasonId: SEASON_ID, teamId: "A-A", activePlayerId: "r-a1" }).canSell,
    ).toBe(true);

    const healed = ensureLocalFormCardsForSeason(persistenceState.save!.gameState, saveId, SEASON_ID);
    // Nur die gespielte Karte bleibt: sie steckt in der Wertung eines gelaufenen Spieltags.
    expect(cardsOf(healed, "A-A", "p-a1").map((card) => card.id)).toEqual([playedCard.id]);
  });

  it("nimmt dem Verkaeufer mit der Karte auch die Saisonend-Strafe fuer die ungespielte Minuskarte", () => {
    const saveId = "save-formcards-strafe";
    const withCards = ensureLocalFormCardsForSeason(baseGameState(), saveId, SEASON_ID);
    // Kaderzeile suchen, deren Minuskarte wirklich einen Wert traegt: Karten mit Wert 0 zaehlen
    // weder als Option noch in der Strafe, an ihnen liesse sich der Effekt nicht messen.
    const sellable = withCards.rosters.find(
      (entry) =>
        entry.teamId === "A-A" && cardsOf(withCards, "A-A", entry.playerId).some((card) => card.cardValue < 0),
    );
    expect(sellable).toBeTruthy();
    const negativeCard = cardsOf(withCards, "A-A", sellable!.playerId).find((card) => card.cardValue < 0)!;
    const before = buildFormCardSeasonUsageAudit(withCards, SEASON_ID).rows.find((row) => row.teamId === "A-A")!;
    expect(before.negativePenaltyPoints).toBeGreaterThan(0);

    installSave(saveId, withCards);
    expect(
      executeLocalTransfermarktSell({ saveId, seasonId: SEASON_ID, teamId: "A-A", activePlayerId: sellable!.id })
        .canSell,
    ).toBe(true);

    const healed = ensureLocalFormCardsForSeason(persistenceState.save!.gameState, saveId, SEASON_ID);
    const after = buildFormCardSeasonUsageAudit(healed, SEASON_ID).rows.find((row) => row.teamId === "A-A")!;
    // Die Strafe faellt genau um den Anteil der abgegebenen Minuskarte (0,5 je Kartenpunkt) —
    // vorher wurde der Verkaeufer am Saisonende fuer die Form eines Spielers bestraft, den er
    // gar nicht mehr im Kader hatte.
    expect(after.negativePenaltyPoints).toBe(
      before.negativePenaltyPoints - Math.abs(negativeCard.cardValue) * 0.5,
    );
  });
});
