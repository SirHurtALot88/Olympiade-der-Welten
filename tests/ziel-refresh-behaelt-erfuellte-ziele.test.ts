import { describe, expect, it } from "vitest";

import type {
  GameState,
  Player,
  RosterEntry,
  Team,
  TeamIdentity,
  TeamSeasonObjectiveRecord,
} from "@/lib/data/olyDataTypes";
import {
  buildTeamObjectiveOverview,
  buildTeamSeasonObjectiveSettlement,
  refreshTeamObjectiveState,
} from "@/lib/board/team-season-objectives-service";

/**
 * PAKET 2: EIN ZIEL-REFRESH DARF KEIN VERGEBENES ZIEL VERLIEREN.
 *
 * Gemessen am Live-Abbild (12.08.2026, `scripts/mess-ziel-refresh-stabilitaet.ts`): ein einziger
 * `refreshTeamObjectiveState` verlor am Messkoerper `1hf25q` drei Ziele — 225 -> 222 — und alle drei
 * waren bereits ERFUELLT: `A-A|sport-axis-spe` (Reward 4), `M-M|sport-axis-spe` (Reward 4),
 * `M-S|player-top20-breakthrough` (Reward 3). 11 C Abrechnungswirkung verschwanden kommentarlos, und
 * die Zielkarten verschwanden vor den Augen des Spielers.
 *
 * Der Pfad lief nur beim Laden und beim Anwenden eines Spieltags — kein Test beruehrte ihn. Deshalb
 * hier ein konstruierter GameState, in dem der Verlust ohne Abbild reproduzierbar ist:
 * Die Slate-Auswahl waehlt ein Ziel im Moment seiner Erfuellung ab
 * (`status !== "completed"`-Praedikate, `pickUrgentObjective`), und der Merge warf jedes
 * gespeicherte Ziel weg, das der frische Slate nicht mehr enthielt.
 */

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "M-M",
    shortCode: partial?.shortCode ?? partial?.teamId ?? "M-M",
    name: partial?.name ?? "Mayhem Mavericks",
    budget: partial?.budget ?? 120,
    cash: partial?.cash ?? 90,
    identityId: partial?.identityId ?? partial?.teamId ?? "M-M",
    humanControlled: partial?.humanControlled ?? false,
    rosterLimit: partial?.rosterLimit ?? 12,
    rosterMinTarget: partial?.rosterMinTarget,
    rosterOptTarget: partial?.rosterOptTarget,
    logoPath: partial?.logoPath ?? null,
  };
}

function createIdentity(teamId: string, partial?: Partial<TeamIdentity>): TeamIdentity {
  return {
    teamId,
    playerType: null,
    pow: partial?.pow ?? 8,
    spe: partial?.spe ?? 7,
    men: partial?.men ?? 5,
    soc: partial?.soc ?? 3,
    ambition: partial?.ambition ?? 8,
    finances: partial?.finances ?? 5,
    boardConfidence: partial?.boardConfidence ?? 7,
    harmony: partial?.harmony ?? 5,
    manners: partial?.manners ?? 5,
    popularity: partial?.popularity ?? 5,
    cooperation: partial?.cooperation ?? 5,
    playerMin: partial?.playerMin ?? 7,
    playerOpt: partial?.playerOpt ?? 10,
  };
}

function createPlayer(id: string): Player {
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
    alignment: "N",
    gender: "f",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: { d1: 50 },
    disciplineTierCounts: { above20: 1, above40: 1, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  };
}

function createRoster(playerId: string, teamId: string): RosterEntry {
  return {
    id: `roster:${teamId}:${playerId}`,
    teamId,
    playerId,
    contractLength: 2,
    salary: 5,
    upkeep: 5,
    purchasePrice: 20,
    currentValue: 20,
    roleTag: "starter",
    joinedSeasonId: "season-1",
  };
}

const SEASON_ID = "season-3";

function createGameState(input?: {
  teams?: Team[];
  teamSeasonObjectives?: TeamSeasonObjectiveRecord[];
  standings?: GameState["seasonState"]["standings"];
}): GameState {
  const teams = input?.teams ?? [createTeam()];
  const players = teams.flatMap((team) => [createPlayer(`${team.teamId}-p1`), createPlayer(`${team.teamId}-p2`)]);
  const rosters = teams.flatMap((team) => [
    createRoster(`${team.teamId}-p1`, team.teamId),
    createRoster(`${team.teamId}-p2`, team.teamId),
  ]);
  return {
    season: { id: SEASON_ID, name: "Season 3", year: 2026, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: SEASON_ID,
      schedule: [],
      standings:
        input?.standings ??
        Object.fromEntries(teams.map((team, index) => [team.teamId, { points: 120 - index * 10, rank: index + 1 }])),
      teamSeasonObjectives: input?.teamSeasonObjectives,
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities: teams.map((team) => createIdentity(team.teamId)),
    players,
    disciplines: [],
    rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: players.length,
      matchedRosterCount: rosters.length,
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

function objective(partial: Partial<TeamSeasonObjectiveRecord> & { objectiveId: string }): TeamSeasonObjectiveRecord {
  return {
    seasonId: SEASON_ID,
    teamId: "M-M",
    category: "sport",
    label: partial.label ?? partial.objectiveId,
    targetValue: null,
    currentValue: null,
    status: "open",
    source: "board_objective_generator_v1",
    ...partial,
  } as TeamSeasonObjectiveRecord;
}

/**
 * Kennungen ohne die Sponsor-Spiegel: der Sponsor ist der eine definierte EREIGNIS-Zugang (mit der
 * Unterschrift ersetzen die Vertrags-Komponenten den Platzhalter). Er darf sich bewegen, alles
 * andere nicht.
 */
const idsOf = (gameState: GameState, teamId = "M-M") =>
  (gameState.seasonState.teamSeasonObjectives ?? [])
    .filter((entry) => entry.seasonId === SEASON_ID && entry.teamId === teamId && entry.category !== "sponsor")
    .map((entry) => entry.objectiveId)
    .sort();

const findObjective = (gameState: GameState, objectiveId: string, teamId = "M-M") =>
  (gameState.seasonState.teamSeasonObjectives ?? []).find(
    (entry) => entry.seasonId === SEASON_ID && entry.teamId === teamId && entry.objectiveId === objectiveId,
  ) ?? null;

describe("Ziel-Refresh behaelt erfuellte Ziele", () => {
  /**
   * Der gespeicherte Bestand traegt ein ERFUELLTES Ziel, das der frisch erzeugte Slate heute nicht
   * mehr waehlt (`sport-axis-spe` faellt aus dem Slate, sobald andere Ziele draengen — genau der
   * Fall der drei Verluste am Messkoerper). Frueher war es nach EINEM Refresh weg.
   */
  function bestandMitErfuelltemZiel(): TeamSeasonObjectiveRecord[] {
    return [
      objective({ objectiveId: "expectation-rank", status: "at_risk", source: "team_expectation_rank_model" }),
      objective({
        objectiveId: "roster-form-color-cover",
        category: "roster",
        status: "at_risk",
        source: "season_formcards",
      }),
      objective({
        objectiveId: "finance-salary-ratio",
        category: "finance",
        status: "failed",
        penaltyCash: 2,
        source: "roster_salary_active_cash",
      }),
      objective({
        objectiveId: "sport-matchday-medals",
        status: "open",
        source: "matchday_team_score_rank",
      }),
      objective({
        objectiveId: "sport-axis-spe",
        label: "Speed-Achse ausbauen",
        status: "completed",
        rewardCash: 4,
        boardConfidenceDelta: 0.4,
        source: "team_profile_axis_bias",
      }),
    ];
  }

  it("verliert das erfuellte Ziel auch nach mehreren Refreshes nicht", () => {
    const start = createGameState({ teamSeasonObjectives: bestandMitErfuelltemZiel() });
    const vorher = idsOf(start);
    expect(vorher).toContain("sport-axis-spe");

    const einmal = refreshTeamObjectiveState(start);
    const zweimal = refreshTeamObjectiveState(einmal);
    const dreimal = refreshTeamObjectiveState(zweimal);

    // Anzahl UND Kennungen bleiben — die Abnahme aus dem Plan, als Wert geprueft.
    expect(idsOf(einmal)).toEqual(vorher);
    expect(idsOf(zweimal)).toEqual(vorher);
    expect(idsOf(dreimal)).toEqual(vorher);
    expect(findObjective(dreimal, "sport-axis-spe")?.status).toBe("completed");
    expect(findObjective(dreimal, "sport-axis-spe")?.rewardCash).toBe(4);
  });

  it("haelt die Abrechnungswirkung des erfuellten Ziels ueber die Refreshes konstant — und zahlt sie genau 1x", () => {
    const start = createGameState({ teamSeasonObjectives: bestandMitErfuelltemZiel() });

    const zeilenFuerZiel = (gameState: GameState) =>
      buildTeamSeasonObjectiveSettlement(gameState).rows.filter(
        (row) => row.teamId === "M-M" && row.objectiveId === "sport-axis-spe",
      );

    expect(zeilenFuerZiel(start)).toHaveLength(1);
    expect(zeilenFuerZiel(start)[0]?.cashDelta).toBe(4);

    const nachDrei = refreshTeamObjectiveState(refreshTeamObjectiveState(refreshTeamObjectiveState(start)));
    const zeilen = zeilenFuerZiel(nachDrei);
    // Genau eine Zeile: das Ziel wird nicht dupliziert und nicht verschluckt.
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]?.cashDelta).toBe(4);

    const summe = (gameState: GameState) => buildTeamSeasonObjectiveSettlement(gameState).byTeamId["M-M"]?.cashDelta ?? 0;
    expect(summe(nachDrei)).toBe(summe(start));
  });

  it("friert ein Ziel ohne frischen Kandidaten sichtbar ein, statt es zu loeschen", () => {
    // Ein Ziel, das der Generator ueberhaupt nicht mehr produziert (Rivalitaet aufgeloest o. ae.).
    const start = createGameState({
      teamSeasonObjectives: [
        ...bestandMitErfuelltemZiel(),
        objective({
          objectiveId: "rivalry-nicht-mehr-erzeugt",
          status: "completed",
          rewardCash: 3,
          source: "team_rivalry",
        }),
      ],
    });
    const nachher = refreshTeamObjectiveState(start);
    const eingefroren = findObjective(nachher, "rivalry-nicht-mehr-erzeugt");
    expect(eingefroren).not.toBeNull();
    expect(eingefroren?.status).toBe("completed");
    expect(eingefroren?.rewardCash).toBe(3);
    // Kein stilles Einfrieren: die Quelle sagt es.
    expect((eingefroren?.source ?? "").split("+")).toContain("status_stale");
  });
});

describe("Ziel-Vergabe laeuft einmal, danach wird nur noch bewertet", () => {
  it("vergibt bei leerem Bestand einen Slate von 3 bis 5 Zielen", () => {
    const vergeben = refreshTeamObjectiveState(createGameState());
    const kernZiele = (vergeben.seasonState.teamSeasonObjectives ?? []).filter(
      (entry) => entry.teamId === "M-M" && entry.category !== "sponsor",
    );
    expect(kernZiele.length).toBeGreaterThanOrEqual(3);
    expect(kernZiele.length).toBeLessThanOrEqual(5);
  });

  it("erzeugt beim zweiten Refresh keine neuen Kennungen, obwohl sich Rang und Status aendern", () => {
    const teams = [createTeam({ teamId: "M-M" }), createTeam({ teamId: "A-A", name: "Alpha" })];
    const vergeben = refreshTeamObjectiveState(createGameState({ teams }));
    const nachVergabe = idsOf(vergeben);

    // Der Rang kippt (Platz 1 -> Platz 2) UND ein vergebenes Ziel wird erfuellt. Genau diese
    // Kombination waehlte das Ziel im Slate ab (`status !== "completed"`, `pickUrgentObjective`).
    const erstesKernziel = nachVergabe[0]!;
    const mitAnderemRang: GameState = {
      ...vergeben,
      seasonState: {
        ...vergeben.seasonState,
        standings: { "M-M": { points: 60, rank: 2 }, "A-A": { points: 120, rank: 1 } },
        teamSeasonObjectives: (vergeben.seasonState.teamSeasonObjectives ?? []).map((entry) =>
          entry.teamId === "M-M" && entry.objectiveId === erstesKernziel
            ? { ...entry, status: "completed" as const }
            : entry,
        ),
      },
    };
    const nachRangwechsel = refreshTeamObjectiveState(mitAnderemRang);

    expect(idsOf(nachRangwechsel)).toEqual(nachVergabe);
  });
});

describe("Bewegliche Zielmarken in der Kennung brechen die Identitaet nicht", () => {
  it("behaelt die vergebene Kennung, wenn der Zielrang der Achsen-Familie neu kalibriert wird", () => {
    // `sport-axis-rank-<achse>-top-<rang>`: der Rang im Namen wandert mit der Kalibrierung. Am Abbild
    // gemessen: `T-G|sport-axis-rank-pow-top-5` verschwand, `...-top-10` kam neu — ein verfehltes
    // Ziel mit 2 C Strafe wurde dabei durch ein anderes ersetzt.
    const start = createGameState({
      teamSeasonObjectives: [
        objective({ objectiveId: "expectation-rank", status: "at_risk", source: "team_expectation_rank_model" }),
        objective({
          objectiveId: "sport-axis-rank-pow-top-3",
          label: "Power Top 3",
          targetValue: "Top 3",
          status: "failed",
          rewardCash: 6,
          penaltyCash: 2,
          source: "team_signature_axis_rank_goal",
        }),
      ],
    });

    const nachher = refreshTeamObjectiveState(start);
    const kennungen = idsOf(nachher);
    // Die gespeicherte Kennung ueberlebt, und es entsteht KEINE zweite aus derselben Familie.
    expect(kennungen).toContain("sport-axis-rank-pow-top-3");
    expect(kennungen.filter((id) => id.startsWith("sport-axis-rank-pow-top-"))).toHaveLength(1);

    const gefunden = findObjective(nachher, "sport-axis-rank-pow-top-3");
    expect(gefunden?.rewardCash).toBe(6);
    // Die Zielmarke wird trotzdem erneuert — Anzeige und Wertung nennen dieselbe Marke.
    expect(gefunden?.targetValue).toBeTruthy();
  });
});

describe("Die Herabstufung zum Zusatzziel bleibt eine Entscheidung der Vergabe", () => {
  it("gibt einem herabgestuften Rang-Ziel seine Strafe nicht zurueck", () => {
    const start = createGameState({
      teamSeasonObjectives: [
        objective({ objectiveId: "expectation-rank", status: "at_risk", source: "team_expectation_rank_model" }),
        objective({
          objectiveId: "sport-axis-rank-pow-top-3",
          label: "Power Top 3 (optional)",
          targetValue: "Top 3",
          status: "failed",
          optional: true,
          rewardCash: 6,
          penaltyCash: undefined,
          boardConfidenceDelta: 0,
          source: "team_signature_axis_rank_goal",
        }),
      ],
    });

    const nachher = refreshTeamObjectiveState(start);
    const zusatzziel = findObjective(nachher, "sport-axis-rank-pow-top-3");
    expect(zusatzziel?.optional).toBe(true);
    expect(zusatzziel?.penaltyCash ?? 0).toBe(0);
    expect(zusatzziel?.boardConfidenceDelta ?? 0).toBeGreaterThanOrEqual(0);
    expect(zusatzziel?.label).toMatch(/\(optional\)$/);

    // Und die Abrechnung zieht dem Team dafuer nichts ab.
    const zeile = buildTeamSeasonObjectiveSettlement(nachher).rows.find(
      (row) => row.teamId === "M-M" && row.objectiveId === "sport-axis-rank-pow-top-3",
    );
    expect(zeile?.cashDelta).toBe(0);
  });
});

describe("Der Bestand blaeht sich nicht auf", () => {
  it("waechst ueber fuenf Refreshes nicht um die nicht gewaehlten Kandidaten", () => {
    let gameState = refreshTeamObjectiveState(createGameState());
    const nachVergabe = buildTeamObjectiveOverview(gameState).objectives.length;
    for (let i = 0; i < 5; i += 1) {
      gameState = refreshTeamObjectiveState(gameState);
    }
    expect(buildTeamObjectiveOverview(gameState).objectives.length).toBe(nachVergabe);
  });
});
