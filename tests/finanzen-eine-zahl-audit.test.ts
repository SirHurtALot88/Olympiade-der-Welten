import { describe, expect, it } from "vitest";

import type { GameState, PersistedSaveGame, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { computeFacilitySeasonCash } from "@/lib/finance/season-end-guv";
import { resolveSeasonGuvByTeam, resolveSeasonGuvPartsByTeam } from "@/lib/finance/season-guv-resolver";
import { previewFacilitySeasonEndFinance } from "@/lib/facilities/facility-season-end-service";
import { buildFinancesLeagueTable } from "@/lib/foundation/finances/use-finances-league-table";
import { buildFinancesViewModel } from "@/lib/foundation/finances/use-finances-view-model";
import {
  applySponsorSettlement,
  getSeasonSponsorCashByTeam,
  getSeasonSponsorCashTotal,
  previewSponsorSettlement,
} from "@/lib/sponsor/sponsor-settlement-service";
import { getTeamActualSalaryTotal, getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import { makePlayer, makeRosterEntry, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

/**
 * FINANZ-AUDIT VOR DER RUNDE (11.08.2026, `docs/AUDIT_PLAN_VOR_DER_RUNDE.md` Abschnitt 6).
 *
 * Alle Zusicherungen hier sind WERT-Messungen an einem gebauten Spielstand — kein `grep` im
 * Quelltext. Ein Test, der Quelltext liest, bleibt grün über toter Funktion; genau diese
 * Fehlerklasse steht im Prüfplan (Klasse 3).
 *
 * Abgesichert werden vier Reparaturen, jede mit ihrer Messung am Live-Abbild im Kommentar:
 *   1. Die Sponsor-Saisonsumme sprang beim Abrechnen (+8,80 C am aktiven Spielstand).
 *   2. Die Gehaltssumme hatte drei Rechenwege (bis 8,6 C je Team auseinander).
 *   3. Die GuV war nach dem Abrechnen um die volle Sponsoreinnahme zu niedrig (46–96 C je Team).
 *   4. Der Gebäude-Nachbau sprang klammen Teams den Unterhalt über, den das Original abbucht.
 */

const SEASON_ID = "season-1";

/** Ein V3-Vertrag mit Sonderziel — das Sonderziel trägt bei Verfehlung einen NEGATIVEN Sockelabzug. */
function buildV3Contract(input: { teamId: string; startRank: number; goalSize: number; goalP: number }): TeamSponsorContract {
  const baseLadder = Array.from({ length: 32 }, (_, index) => 90 - index * 2);
  return {
    teamId: input.teamId,
    seasonId: SEASON_ID,
    seasonsRemaining: 1,
    offerId: `offer-${input.teamId}`,
    name: "Testsponsor",
    payouts: { baseFirstPaid: false, baseSecondPaid: false },
    components: [
      { componentId: "base", kind: "base", label: "Basis", rewardCash: 40 },
      // Ein Sonderziel, das dieses Fixture NICHT erfüllt: `evaluateSpecialComponentStage` liefert 0.
      {
        componentId: "special",
        kind: "special",
        label: "Sonderziel",
        rewardCash: input.goalSize,
        objectiveKey: "top_rank",
        targetValue: 1,
      },
    ],
    sponsorV3: {
      version: 3,
      rankLadder: baseLadder,
      baseLadder,
      anchor: 58,
      tilt: 0,
      cardKey: "test",
      cardName: "Testkarte",
      rarity: "common",
      startRank: input.startRank,
      goalKey: "top_rank",
      goalP: input.goalP,
      goalSize: input.goalSize,
      salaryFactor: 1,
      floor: 47.3,
    },
  } as unknown as TeamSponsorContract;
}

function buildGameState(overrides?: {
  contracts?: Record<string, TeamSponsorContract>;
  cashByTeamId?: Record<string, number>;
  teamFacilities?: GameState["seasonState"]["teamFacilities"];
  sponsorPayoutLogs?: GameState["seasonState"]["sponsorPayoutLogs"];
}): GameState {
  // Zwei Spieler mit GEFORMTEN Verträgen: `yearlySalarySchedule[0]` (die Rate dieser Saison) weicht
  // bewusst von `entry.salary` (dem verhandelten Jahresmittel) ab — genau die Konstellation, an der
  // die drei Gehaltswege am echten Spielstand auseinanderliefen.
  const teams = [
    makeTeam({ teamId: "team-1", shortCode: "T1", name: "Test United", cash: overrides?.cashByTeamId?.["team-1"] ?? 100, budget: 100 }),
    makeTeam({ teamId: "team-2", shortCode: "T2", name: "Rival City", cash: overrides?.cashByTeamId?.["team-2"] ?? 80, budget: 100 }),
  ];
  return {
    season: { id: SEASON_ID, name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
    matchdayState: { matchdayId: "md-1" },
    teams,
    teamIdentities: [makeTeamIdentity({ teamId: "team-1" }), makeTeamIdentity({ teamId: "team-2" })],
    teamStrategyProfiles: [],
    players: [
      makePlayer({ id: "player-1", name: "Front Loaded", salaryDemand: 10 }),
      makePlayer({ id: "player-2", name: "Back Loaded", salaryDemand: 6 }),
    ],
    rosters: [
      makeRosterEntry({
        id: "r1",
        teamId: "team-1",
        playerId: "player-1",
        salary: 10,
        contractShape: "front_loaded",
        yearlySalarySchedule: [{ seasonIndex: 1, salary: 13.4 }, { seasonIndex: 2, salary: 6.6 }],
      } as never),
      makeRosterEntry({
        id: "r2",
        teamId: "team-1",
        playerId: "player-2",
        salary: 6,
        contractShape: "back_loaded",
        yearlySalarySchedule: [{ seasonIndex: 1, salary: 4.2 }, { seasonIndex: 2, salary: 7.8 }],
      } as never),
    ],
    disciplines: [],
    transferHistory: [],
    playerProgressionEvents: [],
    seasonState: {
      seasonId: SEASON_ID,
      loans: [],
      standings: {
        "team-1": { teamId: "team-1", points: 10, rank: 1 },
        "team-2": { teamId: "team-2", points: 8, rank: 2 },
      },
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      formCards: [],
      facilityEvents: [],
      seasonSnapshots: [],
      teamFacilities: overrides?.teamFacilities ?? {},
      sponsorPayoutLogs: overrides?.sponsorPayoutLogs ?? [],
      sponsorContractsByTeamId:
        overrides?.contracts ??
        ({ "team-1": buildV3Contract({ teamId: "team-1", startRank: 4, goalSize: 9, goalP: 0.3 }) } as Record<
          string,
          TeamSponsorContract
        >),
    },
  } as unknown as GameState;
}

describe("Finanzen: die Sponsor-Saisonsumme springt beim Abrechnen nicht", () => {
  /**
   * BEFUND (gemessen am aktiven Spielstand `new-game-1786465783606-0kalpx`, Abbild 11.08. 20:39):
   * 86 Vorschauzeilen, davon 3 negativ mit zusammen −8,80 C (verfehlte Sonderziele, Sockelabzug).
   * `getSeasonSponsorCashTotal` stand vor dem Apply bei 2 533,8 C und danach bei 2 542,6 C —
   * derselbe Sachverhalt, zwei Zahlen. Ursache: der Zweig „bereits gezahlt" filterte `cashDelta > 0`,
   * der Zweig „projizierter Rest" summierte vorzeichenecht.
   */
  it("liefert vor und nach dem Apply dieselbe Zahl, obwohl negative Zeilen dabei sind", () => {
    const gameState = buildGameState();

    const vorschau = previewSponsorSettlement(gameState, "season_end");
    const negative = vorschau.rows.filter((row) => row.cashDelta < 0);
    // Ohne eine negative Zeile prüft dieser Test nichts — die Vorbedingung wird deshalb zugesichert.
    expect(negative.length).toBeGreaterThan(0);
    const summeNegativ = Number(negative.reduce((sum, row) => sum + row.cashDelta, 0).toFixed(2));
    expect(summeNegativ).toBeLessThan(0);

    const vorher = getSeasonSponsorCashTotal(gameState);
    const nachher = getSeasonSponsorCashTotal(
      applySponsorSettlement({ gameState, saveId: "save-1", execute: true, deductSalary: false }).gameState,
    );

    expect(nachher).toBe(vorher);
    // GEGENPROBE ZUM ALTEN VERHALTEN: der alte Code hätte um genau die negativen Zeilen zu hoch
    // gelegen. Dieser Wert darf NICHT herauskommen.
    expect(nachher).not.toBeCloseTo(vorher - summeNegativ, 2);
  });

  it("zählt den Vorschuss nicht doppelt: Log +Betrag und Verrechnung −(Betrag+Gebühr) heben sich auf", () => {
    // Der Vorschuss ist vorgezogenes eigenes Geld. Zählte man nur positive Logs, bliebe er als
    // Einnahme stehen, obwohl die Settlement-Zeile ihn zurückrechnet.
    const gameState = buildGameState({
      sponsorPayoutLogs: [
        {
          id: "log-advance",
          saveId: "save-1",
          seasonId: SEASON_ID,
          teamId: "team-1",
          phase: "base_first",
          componentId: "v4_advance",
          cashDelta: 12,
          action: "apply",
          createdAt: "2026-08-11T00:00:00.000Z",
        },
        {
          id: "log-verrechnung",
          saveId: "save-1",
          seasonId: SEASON_ID,
          teamId: "team-1",
          phase: "season_end",
          componentId: "offer-team-1:v3:base",
          cashDelta: -13.2,
          action: "apply",
          createdAt: "2026-08-11T00:00:00.000Z",
        },
      ] as never,
    });

    const byTeam = getSeasonSponsorCashByTeam(gameState);
    const gebuchterAnteil = 12 - 13.2;
    const projiziert = previewSponsorSettlement(gameState, "season_end")
      .rows.filter((row) => row.teamId === "team-1")
      .reduce((sum, row) => sum + row.cashDelta, 0);
    expect(byTeam.get("team-1")).toBeCloseTo(gebuchterAnteil + projiziert, 1);
    // Nur die Gebühr bleibt hängen — nicht der volle Vorschuss.
    expect(byTeam.get("team-1")).toBeLessThan(projiziert);
  });

  it("lässt Gehalts-Buchungen aus der Sponsoreinnahme heraus", () => {
    // Eine abgerechnete Saison: eine echte Sponsor-Zeile plus die beiden Gehalts-Buchungen, die in
    // derselben Logliste mitfahren. Nur die Sponsor-Zeile darf zählen.
    const logs = [
      {
        id: "log-base",
        saveId: "save-1",
        seasonId: SEASON_ID,
        teamId: "team-1",
        phase: "season_end",
        componentId: "offer-team-1:v3:base",
        cashDelta: 62.4,
        action: "apply",
        createdAt: "2026-08-11T00:00:00.000Z",
      },
      {
        id: "log-salary",
        saveId: "save-1",
        seasonId: SEASON_ID,
        teamId: "team-1",
        phase: "season_end",
        componentId: "salary_deduct",
        cashDelta: -17.6,
        action: "apply",
        createdAt: "2026-08-11T00:00:00.000Z",
      },
      {
        id: "log-repair",
        saveId: "save-1",
        seasonId: SEASON_ID,
        teamId: "team-1",
        phase: "season_end",
        componentId: "salary_factor_repair",
        cashDelta: 11.6,
        action: "apply",
        createdAt: "2026-08-11T00:00:00.000Z",
      },
    ] as never;
    expect(getSeasonSponsorCashByTeam(buildGameState({ sponsorPayoutLogs: logs })).get("team-1")).toBeCloseTo(62.4, 2);
  });
});

describe("Finanzen: eine Gehaltssumme, kein zweiter Weg", () => {
  /**
   * BEFUND (Messkörper `new-game-1785823388048-1hf25q`, Saison 2, Spieltag 10): 340 Rosterverträge,
   * 142 davon mit einem Jahr-1-Satz, der vom gespeicherten `entry.salary` abweicht. Der GuV-Resolver
   * summierte das rohe Feld und lag bei 27 von 32 Teams daneben, bis zu 8,6 C (Mayhem Mavericks
   * 107,7 gebucht gegen 99,1 im Resolver).
   */
  it("Resolver, Anzeige und Abbuchung nennen denselben Betrag — und NICHT die Rohsumme", () => {
    const gameState = buildGameState();

    const anzeige = getTeamActualSalaryTotal(gameState, "team-1");
    const resolver = resolveSeasonGuvPartsByTeam(gameState).get("team-1")?.salaryTotal ?? 0;
    const roh = gameState.rosters
      .filter((entry) => entry.teamId === "team-1")
      .reduce((sum, entry) => sum + (entry.salary ?? 0), 0);

    // Die Rate DIESER Saison: 13,4 + 4,2 = 17,6. Das Jahresmittel wäre 10 + 6 = 16.
    expect(anzeige).toBeCloseTo(17.6, 2);
    expect(roh).toBeCloseTo(16, 2);
    expect(resolver).toBeCloseTo(anzeige, 2);
    expect(resolver).not.toBeCloseTo(roh, 1);

    // Und die Abbuchung am Saisonende nennt exakt dieselbe Zahl.
    const gebucht = applySponsorSettlement({ gameState, saveId: "save-1", execute: true, deductSalary: true })
      .gameState.seasonState.sponsorPayoutLogs!.filter(
        (log) => log.componentId === "salary_deduct" && log.teamId === "team-1",
      )
      .reduce((sum, log) => sum + Math.abs(log.cashDelta), 0);
    expect(gebucht).toBeCloseTo(anzeige, 2);
  });

  /**
   * Der Sponsor-Anker hängt über `getTeamSponsorBaseReferenceTotal` an `getTeamDisplaySalaryTotal`.
   * Die geglättete Summe bleibt bewusst eine EIGENE Größe — sie ist Bemessungsgrundlage, kein
   * Cashflow. Dieser Test hält die Trennung an Werten fest, nicht am Quelltext.
   */
  it("die geglättete Summe bleibt getrennt und folgt dem Formelwert", () => {
    const gameState = buildGameState();
    // Beide Spieler tragen `salaryDemand` 10 bzw. 6 → geglättet 16, fällig 17,6.
    expect(getTeamDisplaySalaryTotal(gameState, "team-1")).toBeCloseTo(16, 1);
    expect(getTeamActualSalaryTotal(gameState, "team-1")).toBeCloseTo(17.6, 1);
  });
});

describe("Finanzen: eine GuV, überall dieselbe Zahl", () => {
  function guvDreiWege(gameState: GameState) {
    const model = buildFinancesViewModel(gameState, "team-1");
    if (model.status !== "ready") throw new Error("erwartet: ready");
    const resolver = resolveSeasonGuvByTeam(gameState).get("team-1");
    const liga = buildFinancesLeagueTable(gameState).find((row) => row.teamId === "team-1");
    return { detail: model.team, resolver: resolver!, liga: liga! };
  }

  it("Finanzen-Reiter, Resolver und Liga-Tabelle stimmen VOR der Abrechnung überein", () => {
    const { detail, resolver, liga } = guvDreiWege(buildGameState());
    expect(detail.guv).toBeCloseTo(resolver.guv, 2);
    expect(liga.guv).toBeCloseTo(resolver.guv, 2);
    expect(liga.incomeAnnual).toBeCloseTo(detail.totalIncome, 2);
    expect(liga.expensesAnnual).toBeCloseTo(detail.totalExpenses, 2);
  });

  /**
   * DER EIGENTLICHE BEFUND. Nach dem Saisonende-Apply überspringt `previewSponsorSettlement` das
   * Team (Duplikat-Wache) — wer nur die Vorschau liest, sieht Sponsoreinnahme 0. Am Messkörper
   * (Saison 2 war abgerechnet) wies der Resolver dadurch je Team 46 bis 96 C zu wenig aus, während
   * der Finanzen-Reiter über seinen Schätz-Proxy eine ganz andere Zahl zeigte.
   */
  it("und AUCH NACH der Abrechnung — die gebuchte Sponsoreinnahme bleibt in der GuV stehen", () => {
    const vorher = buildGameState();
    const guvVorher = resolveSeasonGuvByTeam(vorher).get("team-1")!.guv;
    const sponsorVorher = getSeasonSponsorCashByTeam(vorher).get("team-1") ?? 0;
    expect(sponsorVorher).toBeGreaterThan(0);

    const nachher = applySponsorSettlement({ gameState: vorher, saveId: "save-1", execute: true, deductSalary: false })
      .gameState;
    // Vorbedingung: die Vorschau ist jetzt wirklich leer für dieses Team.
    expect(previewSponsorSettlement(nachher, "season_end").rows.filter((row) => row.teamId === "team-1")).toHaveLength(0);

    const { detail, resolver, liga } = guvDreiWege(nachher);
    expect(resolver.posten.find((posten) => posten.key === "sponsor")?.amount).toBeCloseTo(sponsorVorher, 1);
    expect(resolver.guv).toBeCloseTo(guvVorher, 1);
    expect(detail.guv).toBeCloseTo(resolver.guv, 2);
    expect(liga.guv).toBeCloseTo(resolver.guv, 2);
    // GEGENPROBE ZUM ALTEN VERHALTEN: fiele der Sponsor wieder auf 0, läge die GuV genau um die
    // Sponsoreinnahme tiefer. Dieser Wert darf nicht herauskommen.
    expect(resolver.guv).not.toBeCloseTo(guvVorher - sponsorVorher, 1);
  });
});

describe("Finanzen: der Gebäude-Nachbau bucht wie das Original", () => {
  /**
   * BEFUND (aktiver Spielstand `new-game-1786465783606-0kalpx`): 4 von 32 Teams wichen ab. Der
   * Nachbau sprang eine Unterhaltszeile über, wenn Cash + Einnahmen sie nicht deckten — das
   * Original (`facility-season-end-service.buildRows`) kennt diese Regel nicht mehr und bucht immer
   * ab („Unterhalt ist PFLICHT"). Project Suicide (Cash 1,69) sah 0,0 statt 1,8 C Unterhalt.
   */
  const mitEinnahme = {
    "team-1": {
      facilities: {
        training_center: { level: 3, enabled: true, conditionPct: 100 },
        fan_shop: { level: 2, enabled: true, conditionPct: 100 },
      },
    },
  } as unknown as GameState["seasonState"]["teamFacilities"];

  /**
   * NUR Unterhalt, KEINE Einnahme (Trainingszentrum Stufe 3 = 2,4 C Unterhalt, 0 C Einnahme).
   * Ein Team mit 0,1 C Cash kann diese Zeile nicht aus eigener Kraft decken — genau der Fall, den
   * der alte Nachbau übersprang und das Original trotzdem abbucht.
   */
  const nurUnterhalt = {
    "team-1": { facilities: { training_center: { level: 3, enabled: true, conditionPct: 100 } } },
  } as unknown as GameState["seasonState"]["teamFacilities"];

  function messe(cash: number, teamFacilities = mitEinnahme) {
    const gameState = buildGameState({ teamFacilities, cashByTeamId: { "team-1": cash } });
    const save = { saveId: "save-1", status: "active", gameState } as unknown as PersistedSaveGame;
    return {
      nachbau: computeFacilitySeasonCash(gameState, "team-1", cash),
      original: previewFacilitySeasonEndFinance(save, "team-1"),
    };
  }

  it("stimmt bei einem Team mit Geld in Einnahme UND bezahltem Unterhalt überein", () => {
    const { nachbau, original } = messe(100);
    expect(nachbau.income).toBeCloseTo(original.facilityIncomeTotal, 2);
    expect(nachbau.paidUpkeep).toBeCloseTo(original.facilityUpkeepTotal, 2);
    expect(nachbau.paidUpkeep).toBeGreaterThan(0);
  });

  it("und AUCH bei einem klammen Team — der Unterhalt wird trotzdem gebucht", () => {
    const { nachbau, original } = messe(0.1, nurUnterhalt);
    // Vorbedingung: das Cash reicht für diese Zeile wirklich nicht (2,4 C Unterhalt, 0,1 C Cash,
    // keine Gebäude-Einnahme, die einspringen könnte).
    expect(original.facilityIncomeTotal).toBe(0);
    expect(original.facilityUpkeepTotal).toBeGreaterThan(0.1);
    expect(nachbau.paidUpkeep).toBeCloseTo(original.facilityUpkeepTotal, 2);
    // GEGENPROBE ZUM ALTEN VERHALTEN: der Nachbau hätte hier 0 gezeigt.
    expect(nachbau.paidUpkeep).not.toBe(0);
  });

  it("und der Finanzen-Reiter zeigt genau diese Zahlen", () => {
    const gameState = buildGameState({ teamFacilities: nurUnterhalt, cashByTeamId: { "team-1": 0.1 } });
    const save = { saveId: "save-1", status: "active", gameState } as unknown as PersistedSaveGame;
    const original = previewFacilitySeasonEndFinance(save, "team-1");
    const model = buildFinancesViewModel(gameState, "team-1");
    if (model.status !== "ready") throw new Error("erwartet: ready");
    expect(model.team.expenses.facilityUpkeep.total).toBeCloseTo(original.facilityUpkeepTotal, 2);
    expect(model.team.income.facilityIncome?.total ?? 0).toBeCloseTo(original.facilityIncomeTotal, 2);
  });
});
