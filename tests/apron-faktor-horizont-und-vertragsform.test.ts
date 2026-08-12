/**
 * ZWEI REPARATUREN AN EINER STELLE, DIE SONST NUR BEIM SAISONWECHSEL LAEUFT.
 *
 * Beide Pfade hier laufen im Spiel ausschliesslich in der Saisonende-Kette. Genau das war ihr
 * Problem: kein Test hat sie je beruehrt, und ein gemessener Fehler konnte zwei Releases lang
 * stehen bleiben. Darum konstruiert dieser Test das Faktor-Fenster von Hand — er braucht keinen
 * Saisonwechsel, um die Entscheidung zu pruefen.
 *
 * 1. FAKTOR-HORIZONT (Schritt 1 des Plans, `docs/APRON_UND_VERTRAGSFORMEN.md`): Verkaeufe laufen in
 *    der Preseason, das Faktor-Fenster rueckt erst im LETZTEN Schritt vor. Die Apron-Werkzeuge der
 *    KI lasen deshalb den Faktor der ABGELAUFENEN Saison — obwohl der der kommenden im selben
 *    Fenster steht. Gemessen am Abbild `1hf25q`: `reliefBisZiel` von Hell Raisers stand auf 9,67,
 *    real 0,00 (f_next = 0,87 liegt unter der k=0-Schwelle 0,95).
 *
 * 2. VERTRAGSFORM NACH DEM FENSTER (Schritt 2): Gehaltszahlungen skalieren nicht mit dem Salary
 *    Factor, die Einnahmen schon — faellt das Fenster, ist frueh zahlen guenstiger.
 *
 * 3. DER WAECHTER: die Vertragsform darf die Apron-Abgabe NICHT bewegen (Anti-Gaming-Entscheidung,
 *    Kopfkommentar `apron-service.ts`). Delta exakt 0,00 — dieser Wert schuetzt genau die
 *    Bemessungsgrundlage, die Schritt 3 des Plans spaeter zur Entscheidung stellt.
 */
import { describe, expect, it } from "vitest";

import type { GameState, RosterEntry, SeasonEconomyFactorRecord } from "@/lib/data/olyDataTypes";
import { buildApronAbbauZiel } from "@/lib/ai/apron-abbau-ziel";
import {
  apronKonjunkturhebel,
  computeApronLines,
  getTeamApronSalaryBase,
  resolveApronDecisionSalaryFactor,
  resolveApronSalaryFactor,
  resolveApronSalaryFactorForNextSeason,
  resolveSeasonApronLines,
} from "@/lib/season/apron-service";
import { computeApronSettlement, apronWertungsanteil } from "@/lib/season/apron-service";
import { isBeforeSeasonEconomyFactorAdvance } from "@/lib/season/season-economy-factors";
import {
  getTeamActualSalaryTotal,
  getTeamNegotiatedSalaryTotal,
} from "@/lib/sponsor/sponsor-team-salary-display";
import { resolveRosterContractSalaries } from "@/lib/foundation/player-economy-contract";
import {
  AI_CONTRACT_SHAPE_FACTOR_GEFAELLE_SCHWELLE,
  advanceRosterContractSchedule,
  chooseAiRenewalContractShape,
  resolveContractTermSalaryFactors,
} from "@/lib/contracts/contract-renewal-service";
import { buildContractSalarySchedule } from "@/lib/market/contract-negotiation-preview";
import { withNegotiatedSalaryBenchmark } from "@/lib/contracts/negotiated-salary-benchmark";

const SEASON_ID = "season-2";

function bauFenster(faktoren: number[]): SeasonEconomyFactorRecord[] {
  return faktoren.map((factor, horizonIndex) => ({
    seasonId: SEASON_ID,
    seasonLabel: horizonIndex === 0 ? "Aktuell" : `Season +${horizonIndex}`,
    horizonIndex,
    factor,
    source: "sheet_seed",
    rollSeed: null,
    carriedFromSeasonId: null,
    generatedAt: "2026-08-12T00:00:00.000Z",
  })) as SeasonEconomyFactorRecord[];
}

/**
 * 32 Teams, jedes mit einem Kader aus Spielern mit FESTEM Formel-Gehalt (`salaryDemand`).
 *
 * `salaryDemand` ist die Quelle von `expectedSalary` — der Zahl, gegen die die Apron bemisst. Sie
 * haengt bewusst NICHT an der Vertragsform; die Jahreszahlung (`yearlySalarySchedule[0]`) tut es.
 * Genau diese Trennung prueft der Waechter unten.
 */
function bauLiga(input: {
  gamePhase: GameState["gamePhase"];
  faktoren: number[];
  /** Formel-Gehalt je Spieler, Team fuer Team (jede Zahl = ein Spieler). */
  gehaelterJeTeam: number[][];
  ambition?: number;
}): GameState {
  const players: GameState["players"] = [];
  const rosters: RosterEntry[] = [];
  const teams: GameState["teams"] = [];
  const teamIdentities: GameState["teamIdentities"] = [];

  input.gehaelterJeTeam.forEach((gehaelter, teamIndex) => {
    const teamId = `team-${teamIndex + 1}`;
    teams.push({ teamId, name: `Team ${teamIndex + 1}`, cash: 50 } as GameState["teams"][number]);
    teamIdentities.push({ teamId, ambition: input.ambition ?? 5 } as GameState["teamIdentities"][number]);
    gehaelter.forEach((gehalt, spielerIndex) => {
      const playerId = `${teamId}-p${spielerIndex + 1}`;
      players.push({ id: playerId, name: playerId, salaryDemand: gehalt, marketValue: gehalt * 6 } as GameState["players"][number]);
      rosters.push({
        id: `roster-${playerId}`,
        teamId,
        playerId,
        salary: gehalt,
        // Wie an jedem Unterschriftspfad: das VERHANDELTE Jahresgehalt wird festgeschrieben.
        negotiatedAnnualSalary: gehalt,
        contractLength: 3,
        contractShape: "balanced",
        yearlySalarySchedule: buildContractSalarySchedule({
          contractLength: 3,
          annualSalary: gehalt,
          shape: "balanced",
        } as never).yearlySalarySchedule,
      } as RosterEntry);
    });
  });

  return {
    gamePhase: input.gamePhase,
    season: { id: SEASON_ID, name: "Saison 2", year: 2, currentMatchday: 10, matchdayIds: [] },
    seasonState: { seasonEconomyFactors: bauFenster(input.faktoren) },
    matchdayState: {},
    teams,
    teamIdentities,
    players,
    rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    disciplines: [],
    logs: [],
    mappingReport: {},
  } as unknown as GameState;
}

/** Gleichmaessige Liga (Median 60) mit EINEM Ueberzahler — das Team, um das es geht. */
function bauLigaMitUeberzahler(gamePhase: GameState["gamePhase"], faktoren: number[]): GameState {
  const gehaelterJeTeam = Array.from({ length: 32 }, (_, index) => (index === 0 ? [40, 40, 20] : [30, 30]));
  return bauLiga({ gamePhase, faktoren, gehaelterJeTeam });
}

describe("Schritt 1 — der Faktor-Horizont der Apron-Entscheidungen", () => {
  const FENSTER = [1.19, 0.87, 0.83, 0.91, 1.24];

  it("liest beide Horizonte aus DEMSELBEN Fenster", () => {
    const gs = bauLigaMitUeberzahler("season_completed", FENSTER);
    expect(resolveApronSalaryFactor(gs)).toBe(1.19);
    expect(resolveApronSalaryFactorForNextSeason(gs)).toBe(0.87);
  });

  it("in der Saisonende-Kette gilt der Faktor der KOMMENDEN Saison", () => {
    for (const phase of [
      "season_completed",
      "season_review",
      "season_rewards",
      "player_development",
      "season_end_management",
      "transfer_sell_phase",
      "transfer_buy_phase",
    ] as const) {
      expect(isBeforeSeasonEconomyFactorAdvance(phase)).toBe(true);
      const gs = bauLigaMitUeberzahler(phase, FENSTER);
      expect(resolveApronDecisionSalaryFactor(gs)).toEqual({ factor: 0.87, horizonIndex: 1 });
    }
  });

  it("ab dem Saisonstart gilt wieder der laufende Faktor — dort wird gekauft", () => {
    for (const phase of ["season_active", "lineup_setup", "next_season_ready", "preseason_management"] as const) {
      expect(isBeforeSeasonEconomyFactorAdvance(phase)).toBe(false);
      const gs = bauLigaMitUeberzahler(phase, FENSTER);
      expect(resolveApronDecisionSalaryFactor(gs)).toEqual({ factor: 1.19, horizonIndex: 0 });
    }
  });

  it("faellt der naechste Faktor unter die k=0-Schwelle, ist das Abbau-Relief 0,00 statt eines Phantomnutzens", () => {
    // Dasselbe Muster wie am Abbild `1hf25q`: laufend 1,19 (k > 0), kommend 0,87 (k = 0).
    expect(apronKonjunkturhebel(1.19)).toBeGreaterThan(0);
    expect(apronKonjunkturhebel(0.87)).toBe(0);

    const preseason = bauLigaMitUeberzahler("season_completed", FENSTER);
    const zielPreseason = buildApronAbbauZiel(preseason, "team-1");
    // Die Lage selbst ist unveraendert: das Team steht ueber seiner Decke.
    expect(zielPreseason.ueberschuss).toBeGreaterThan(0);
    expect(zielPreseason.salaryFactor).toBe(0.87);
    expect(zielPreseason.salaryFactorHorizonIndex).toBe(1);
    expect(zielPreseason.reliefBisZiel).toBe(0);

    // Gegenprobe im Saisonstart: derselbe Kader, aber der Horizont 0 gilt — das Relief bleibt echt.
    const laufend = bauLigaMitUeberzahler("season_active", FENSTER);
    const zielLaufend = buildApronAbbauZiel(laufend, "team-1");
    expect(zielLaufend.ueberschuss).toBe(zielPreseason.ueberschuss);
    expect(zielLaufend.salaryFactor).toBe(1.19);
    expect(zielLaufend.salaryFactorHorizonIndex).toBe(0);
    expect(zielLaufend.reliefBisZiel).toBeGreaterThan(0);
  });

  it("steigt der naechste Faktor ueber die Schwelle, bleibt das Relief positiv — die Steuer wird nicht wegdefiniert", () => {
    // Muster des zweiten Spielstands (`0kalpx`): kommender Faktor 1,03, k = 0,28.
    const gs = bauLigaMitUeberzahler("transfer_sell_phase", [1.12, 1.03, 1.05, 1.02, 1.21]);
    const ziel = buildApronAbbauZiel(gs, "team-1");
    expect(ziel.salaryFactor).toBe(1.03);
    expect(ziel.reliefBisZiel).toBeGreaterThan(0);
  });

  it("ohne vollstaendiges Fenster bleibt der dokumentierte Fallback stehen (1 bzw. der laufende Faktor)", () => {
    const ohneFenster = { seasonState: {}, season: { id: SEASON_ID } } as unknown as GameState;
    expect(resolveApronSalaryFactor(ohneFenster)).toBe(1);
    expect(resolveApronSalaryFactorForNextSeason(ohneFenster)).toBe(1);

    // Ein 0-Faktor im Fenster ist kein Faktor: die Abgabe waere sonst unsichtbar statt gedaempft.
    const nullFaktor = bauLigaMitUeberzahler("season_active", [0, 0, 1.1, 1.1, 1.1]);
    expect(resolveApronSalaryFactor(nullFaktor)).toBe(1);
    expect(resolveApronSalaryFactorForNextSeason(nullFaktor)).toBe(1);
  });
});

describe("Der Waechter — die Vertragsform bewegt die Apron-Abgabe um 0,00", () => {
  /**
   * DIE ZUSICHERUNG LAUTET: „EIN FORMWECHSEL AENDERT DIE APRON-ABGABE UM 0,00."
   *
   * Sie lautet ausdruecklich NICHT „die Abgabe haengt am Formel-Gehalt". Der Unterschied ist keine
   * Wortklauberei, sondern der ganze Zweck dieses Tests: der Eigentuemer hat entschieden, dass die
   * Bemessungsgrundlage spaeter auf das VERHANDELTE Durchschnittsgehalt wechseln soll
   * (`resolveRosterContractSalaries().annualSalary`, Schritt 3 des Plans). Ein Test, der auf
   * `expectedSalary` festgenagelt waere, muesste bei dieser Umstellung umgeschrieben werden — und
   * schuetzte damit genau in dem Moment nichts, in dem er gebraucht wird.
   *
   * Deshalb prueft er drei Aussagen, die BEIDE Bemessungsgrundlagen ueberleben:
   *   (a) der Formwechsel wirkt wirklich — die echte Jahreszahlung steigt,
   *   (b) die Apron-Basis (`getTeamApronSalaryBase`) bleibt Zahl fuer Zahl gleich — und zwar auch
   *       der Laufzeit-Durchschnitt, der die kuenftige Basis waere,
   *   (c) die Abgabe aendert sich um EXAKT 0,00.
   * Wer die Basis auf die JAHRESZAHLUNG umstellt (die einzige form-abhaengige Groesse), bricht (b)
   * und (c) sofort — und genau das ist das Schlupfloch, das die Anti-Gaming-Entscheidung meint.
   *
   * Am Abbild nachgewiesen: zehn Vertraege des groessten Zahlers auf `front_loaded` → Jahr-1-Summe
   * +10,5, Abgabe-Delta exakt 0,00.
   */
  function abgabeDerLiga(gs: GameState): number {
    const lines = resolveSeasonApronLines(gs);
    const settlement = computeApronSettlement({
      lines,
      salaryFactor: 1.24,
      teams: gs.teams.map((team, index) => ({
        teamId: team.teamId,
        salary: getTeamApronSalaryBase(gs, team.teamId),
        rankShare: apronWertungsanteil(index + 1, 1.24),
      })),
    });
    return settlement.topf;
  }

  /** Der Laufzeit-Durchschnitt je Kadervertrag — die Basis, auf die Schritt 3 wechseln soll. */
  function verhandelterDurchschnitt(gs: GameState, teamId: string): number {
    const summe = gs.rosters
      .filter((entry) => entry.teamId === teamId)
      .reduce((sum, entry) => sum + (resolveRosterContractSalaries(entry).annualSalary ?? 0), 0);
    return Math.round(summe * 100) / 100;
  }

  it("Formwechsel verschiebt die echte Jahreszahlung — und sonst nichts", () => {
    const vorher = bauLigaMitUeberzahler("season_active", [1.24, 1.24, 1.24, 1.24, 1.24]);
    const nachher: GameState = {
      ...vorher,
      rosters: vorher.rosters.map((entry) =>
        entry.teamId === "team-1"
          ? ({
              ...entry,
              contractShape: "front_loaded",
              yearlySalarySchedule: buildContractSalarySchedule({
                contractLength: 3,
                annualSalary: entry.salary,
                shape: "front_loaded",
              } as never).yearlySalarySchedule,
            } as RosterEntry)
          : entry,
      ),
    };

    // (a) Der Formwechsel wirkt wirklich: die ECHTE Jahreszahlung steigt.
    expect(getTeamActualSalaryTotal(nachher, "team-1")).toBeGreaterThan(
      getTeamActualSalaryTotal(vorher, "team-1"),
    );

    // (b) Die Apron-Basis bleibt Zahl fuer Zahl gleich — heute wie nach einer Umstellung.
    expect(getTeamApronSalaryBase(nachher, "team-1")).toBe(getTeamApronSalaryBase(vorher, "team-1"));
    expect(verhandelterDurchschnitt(nachher, "team-1")).toBe(verhandelterDurchschnitt(vorher, "team-1"));
    // Und sie ist NICHT die Jahreszahlung — genau das waere das Schlupfloch.
    expect(getTeamApronSalaryBase(nachher, "team-1")).not.toBe(getTeamActualSalaryTotal(nachher, "team-1"));
    expect(computeApronLines(nachher)).toEqual(computeApronLines(vorher));

    // (c) Die Abgabe aendert sich um EXAKT 0,00 — bei einer Liga, in der ueberhaupt etwas anfaellt.
    expect(abgabeDerLiga(vorher)).toBeGreaterThan(0);
    expect(abgabeDerLiga(nachher) - abgabeDerLiga(vorher)).toBe(0);
  });

  /**
   * DIE VERSCHAERFUNG: DERSELBE WAECHTER, ABER NACH EINEM SAISONWECHSEL.
   *
   * Ohne diesen Fall bliebe die Falle unsichtbar, die Schritt 3 des Plans beinahe zum Schlupfloch
   * gemacht haette: `advanceRosterContractSchedule` UEBERSCHREIBT `entry.salary` bei jedem
   * Saisonwechsel mit der Jahr-1-Rate der Rest-Schedule. Eine Bemessung auf `annualSalary` (das
   * genau dieses Feld bevorzugt) oder auf den Durchschnitt der REST-Schedule waere im Moment der
   * Unterschrift noch unauffaellig und ein Jahr spaeter formabhaengig — front_loaded senkte die
   * Steuerbasis dauerhaft.
   *
   * Der Test macht das ausdruecklich sichtbar: er prueft ERST, dass die naheliegenden Basen nach
   * dem Saisonwechsel wirklich auseinanderlaufen (sonst prueft er nichts), und DANN, dass die
   * echte Apron-Basis und die Abgabe es nicht tun.
   */
  it("auch NACH einem Saisonwechsel bewegt ein Formwechsel die Abgabe um 0,00", () => {
    const basis = bauLigaMitUeberzahler("season_active", [1.24, 1.24, 1.24, 1.24, 1.24]);
    const geformt: GameState = {
      ...basis,
      rosters: basis.rosters.map((entry) =>
        entry.teamId === "team-1"
          ? ({
              ...entry,
              contractShape: "front_loaded",
              yearlySalarySchedule: buildContractSalarySchedule({
                contractLength: 3,
                annualSalary: entry.negotiatedAnnualSalary ?? entry.salary,
                shape: "front_loaded",
              } as never).yearlySalarySchedule,
            } as RosterEntry)
          : entry,
      ),
    };

    /** Eine Saison weiterdrehen — genau der Schritt, den die Saisonende-Kette am Vertrag macht. */
    function eineSaisonWeiter(gs: GameState): GameState {
      return {
        ...gs,
        rosters: gs.rosters.map((entry) => {
          const nextLength = Math.max(0, (entry.contractLength ?? 0) - 1);
          return { ...entry, ...advanceRosterContractSchedule(entry, nextLength), contractLength: nextLength };
        }),
      };
    }

    const basisNachJahr1 = eineSaisonWeiter(basis);
    const geformtNachJahr1 = eineSaisonWeiter(geformt);

    // (0) DIE FALLE IST ECHT — Beleg 1: der Durchschnitt der REST-Schedule ist schon nach dem
    //     ersten Saisonwechsel gesunken (3 Jahre 1,2/1,0/0,8 ⇒ Rest 1,0/0,8). Genau diese Basis
    //     stand als „Laufzeit-Durchschnitt" zur Debatte.
    const balancedEintrag = basisNachJahr1.rosters.find((entry) => entry.teamId === "team-1")!;
    const geformterEintrag = geformtNachJahr1.rosters.find((entry) => entry.teamId === "team-1")!;
    const restDurchschnitt = (entry: RosterEntry) => {
      const schedule = entry.yearlySalarySchedule ?? [];
      return schedule.reduce((sum, row) => sum + row.salary, 0) / Math.max(1, schedule.length);
    };
    expect(restDurchschnitt(geformterEintrag)).toBeLessThan(restDurchschnitt(balancedEintrag));

    // (1) DAS VERHANDLUNGS-BENCHMARK UEBERLEBT den Saisonwechsel unveraendert.
    expect(geformterEintrag.negotiatedAnnualSalary).toBe(balancedEintrag.negotiatedAnnualSalary);
    expect(getTeamNegotiatedSalaryTotal(geformtNachJahr1, "team-1")).toBe(
      getTeamNegotiatedSalaryTotal(basisNachJahr1, "team-1"),
    );

    // (2) UND DAMIT DIE ZUSICHERUNG: Basis, Linien und Abgabe bleiben Zahl fuer Zahl gleich.
    expect(getTeamApronSalaryBase(geformtNachJahr1, "team-1")).toBe(
      getTeamApronSalaryBase(basisNachJahr1, "team-1"),
    );
    expect(computeApronLines(geformtNachJahr1)).toEqual(computeApronLines(basisNachJahr1));
    expect(abgabeDerLiga(basisNachJahr1)).toBeGreaterThan(0);
    expect(abgabeDerLiga(geformtNachJahr1) - abgabeDerLiga(basisNachJahr1)).toBe(0);

    // (3) Noch eine Saison weiter. JETZT schlaegt die Falle auch auf `entry.salary` durch (bei
    //     drei Jahren ist Jahr 2 zufaellig die Durchschnittsrate, Jahr 3 nicht mehr) — und mit ihm
    //     auf `resolveRosterContractSalaries().annualSalary`, die zweite naheliegende Basis.
    const basisNachJahr2 = eineSaisonWeiter(basisNachJahr1);
    const geformtNachJahr2 = eineSaisonWeiter(geformtNachJahr1);
    expect(geformtNachJahr2.rosters.find((entry) => entry.teamId === "team-1")!.salary).toBeLessThan(
      basisNachJahr2.rosters.find((entry) => entry.teamId === "team-1")!.salary,
    );
    expect(verhandelterDurchschnitt(geformtNachJahr2, "team-1")).toBeLessThan(
      verhandelterDurchschnitt(basisNachJahr2, "team-1"),
    );

    // Die Zusage haelt trotzdem: Basis und Abgabe bleiben Zahl fuer Zahl gleich.
    expect(getTeamApronSalaryBase(geformtNachJahr2, "team-1")).toBe(
      getTeamApronSalaryBase(basisNachJahr2, "team-1"),
    );
    expect(abgabeDerLiga(geformtNachJahr2) - abgabeDerLiga(basisNachJahr2)).toBe(0);
  });

  /**
   * DIE ANDERE HAELFTE DER UMSTELLUNG: das VERHANDELTE Gehalt muss die Abgabe jetzt WIRKLICH
   * bewegen — sonst haette der Umbau nur die Quelle getauscht und nichts gewonnen.
   */
  it("wer unter Formel verhandelt, zahlt weniger Abgabe — das war vorher nicht so", () => {
    const teuer = bauLigaMitUeberzahler("season_active", [1.24, 1.24, 1.24, 1.24, 1.24]);
    // Derselbe Kader, aber 20 % unter dem Formel-Gehalt verhandelt. `salaryDemand` (und damit
    // `expectedSalary`, die ALTE Basis) bleibt unangetastet.
    const guenstig: GameState = {
      ...teuer,
      rosters: teuer.rosters.map((entry) =>
        entry.teamId === "team-1"
          ? ({ ...entry, negotiatedAnnualSalary: (entry.negotiatedAnnualSalary ?? entry.salary) * 0.8 } as RosterEntry)
          : entry,
      ),
    };

    expect(getTeamApronSalaryBase(guenstig, "team-1")).toBeLessThan(getTeamApronSalaryBase(teuer, "team-1"));
    expect(abgabeDerLiga(guenstig)).toBeLessThan(abgabeDerLiga(teuer));
  });

  /**
   * MIGRATION: ein Bestandsvertrag ohne das Feld darf nicht anders besteuert werden als ein
   * frisch unterschriebener mit demselben verhandelten Gehalt.
   */
  it("Bestandsvertraege ohne Feld werden aus der Schedule nachgetragen — gleiche Basis, gleiche Abgabe", () => {
    const mitFeld = bauLigaMitUeberzahler("season_active", [1.24, 1.24, 1.24, 1.24, 1.24]);
    const ohneFeld: GameState = {
      ...mitFeld,
      rosters: mitFeld.rosters.map((entry) => {
        const { negotiatedAnnualSalary: _entfernt, ...rest } = entry;
        return rest as RosterEntry;
      }),
    };

    expect(ohneFeld.rosters.every((entry) => entry.negotiatedAnnualSalary === undefined)).toBe(true);
    expect(getTeamApronSalaryBase(ohneFeld, "team-1")).toBe(getTeamApronSalaryBase(mitFeld, "team-1"));
    expect(abgabeDerLiga(ohneFeld)).toBe(abgabeDerLiga(mitFeld));

    // Und der Lade-Backfill schreibt genau diesen Wert fest — idempotent.
    const nachgetragen = withNegotiatedSalaryBenchmark(ohneFeld);
    expect(nachgetragen.rosters.every((entry) => typeof entry.negotiatedAnnualSalary === "number")).toBe(true);
    expect(getTeamApronSalaryBase(nachgetragen, "team-1")).toBe(getTeamApronSalaryBase(mitFeld, "team-1"));
    expect(withNegotiatedSalaryBenchmark(nachgetragen)).toBe(nachgetragen);
  });
});

describe("Schritt 2 — die Vertragsform folgt dem Faktor-Fenster", () => {
  const ENTRY = { id: "r1", teamId: "team-1", playerId: "p1", salary: 10, contractLength: 3 } as RosterEntry;
  const CASH_GATE_LOCKER = {
    canRenew: true,
    cash: 200,
    requiredReserve: 20,
    salaryTotal: 60,
    warning: null,
    rosterUnderMin: false,
  };

  function form(input: {
    faktoren: number[];
    cash: number;
    requiredReserve?: number;
    laufzeit?: number;
    profile?: Parameters<typeof chooseAiRenewalContractShape>[0]["profile"];
  }) {
    return chooseAiRenewalContractShape({
      team: { teamId: "team-1", name: "Team 1", cash: input.cash } as never,
      entry: ENTRY,
      recommendedLength: input.laufzeit ?? 3,
      renewalSalary: 10,
      cashGate: { ...CASH_GATE_LOCKER, cash: input.cash, requiredReserve: input.requiredReserve ?? 20 },
      // Neutrales Profil (Vorgabe), sofern der Test nicht ausdruecklich eines mitgibt.
      profile: input.profile ?? null,
      termSalaryFactors: input.faktoren,
    });
  }

  function schedule(shape: "front_loaded" | "back_loaded" | "balanced", annualSalary = 10, contractLength = 3) {
    return buildContractSalarySchedule({ contractLength, annualSalary, shape } as never);
  }

  it("faellt das Fenster ueber die Laufzeit, wird frueh gezahlt — und die Schedule zeigt es", () => {
    const shape = form({ faktoren: [1.2, 0.85, 0.85], cash: 200 });
    expect(shape).toBe("front_loaded");

    const plan = schedule("front_loaded");
    const durchschnitt = (plan.totalSalary ?? 0) / plan.yearlySalarySchedule.length;
    expect(plan.yearlySalarySchedule[0]!.salary).toBeGreaterThan(durchschnitt);
  });

  it("steigt das Fenster, wird spaeter gezahlt — und die Schedule zeigt es", () => {
    const shape = form({ faktoren: [0.85, 1.2, 1.2], cash: 200 });
    expect(shape).toBe("back_loaded");

    const plan = schedule("back_loaded");
    const durchschnitt = (plan.totalSalary ?? 0) / plan.yearlySalarySchedule.length;
    expect(plan.yearlySalarySchedule[0]!.salary).toBeLessThan(durchschnitt);
  });

  it("die Summe bleibt exakt — die Form verschiebt, sie verteuert nicht", () => {
    for (const shape of ["balanced", "front_loaded", "back_loaded"] as const) {
      for (const laufzeit of [2, 3, 4]) {
        const plan = schedule(shape, 10, laufzeit);
        const summe = plan.yearlySalarySchedule.reduce((sum, row) => sum + row.salary, 0);
        expect(Math.round(summe * 100) / 100).toBe(10 * laufzeit);
      }
    }
  });

  it("Kassenklemme schlaegt Konjunktur: ein klammes Team belastet sich nicht vorne", () => {
    // Dasselbe fallende Fenster wie oben, aber die Kasse deckt die Rueckstellung nicht.
    expect(form({ faktoren: [1.2, 0.85, 0.85], cash: 8, requiredReserve: 20 })).not.toBe("front_loaded");
    // Nach hinten schieben darf es weiterhin — das entlastet das erste Jahr.
    expect(form({ faktoren: [0.85, 1.2, 1.2], cash: 8, requiredReserve: 20 })).toBe("back_loaded");
  });

  it("ohne nennenswertes Gefaelle bleibt die bisherige Logik unveraendert", () => {
    expect(form({ faktoren: [1.05, 1.02, 1.03], cash: 200 })).toBe("balanced");
    expect(form({ faktoren: [], cash: 200 })).toBe("balanced");
    // Genau an der Schwelle greift der Bias, knapp darunter nicht.
    const knappDrunter = AI_CONTRACT_SHAPE_FACTOR_GEFAELLE_SCHWELLE - 0.01;
    expect(form({ faktoren: [1 + knappDrunter, 1], cash: 200 })).toBe("balanced");
    expect(form({ faktoren: [1 + AI_CONTRACT_SHAPE_FACTOR_GEFAELLE_SCHWELLE, 1], cash: 200 })).toBe("front_loaded");
  });

  it("bei Laufzeit 1 gibt es nichts zu verteilen", () => {
    expect(form({ faktoren: [1.2, 0.85], cash: 200, laufzeit: 1 })).toBe("balanced");
  });

  it("bei ungerader Laufzeit zaehlt das Mitteljahr zu keiner Haelfte", () => {
    // Mitteljahr extrem, Raender gleich → kein Gefaelle, also keine Formaenderung.
    expect(form({ faktoren: [1.0, 1.24, 1.0], cash: 200 })).toBe("balanced");
  });

  /**
   * FABLES ENTSCHEIDUNG (docs/APRON_UND_VERTRAGSFORMEN.md, Abschnitt 5) — die vier Zahlen, an denen
   * die Regel haengt. Jede einzelne ist eine WERT-Zusage, kein Quelltext-String.
   */
  it("die Schwelle ist die benannte 0,15 — nicht die vorlaeufige 0,10", () => {
    expect(AI_CONTRACT_SHAPE_FACTOR_GEFAELLE_SCHWELLE).toBe(0.15);
    // Was zwischen 0,10 und 0,15 liegt, loest jetzt ausdruecklich NICHT mehr aus.
    expect(form({ faktoren: [1.12, 1.0], cash: 200 })).toBe("balanced");
  });

  /**
   * DER MESSKOERPER `1hf25q`: Vertragsjahre [0,87, 0,83, 0,91, 1,24]. Die Haelften-Statistik sieht
   * Δ = +0,22 und schiebt die dicke Rate in die 1,24-Saison. Die naive Rechnung „naechste Saison
   * gegen den Rest" kaeme auf 0,87 − Mittel(0,83; 0,91; 1,24) = −0,12 und damit auf das
   * GEGENTEILIGE Vorzeichen — sie wuerde front_loaded waehlen. Dieser Test haelt das Vorzeichen.
   */
  it("die Haelften-Statistik dreht den Messkoerper korrekt nach hinten — nicht nach vorn", () => {
    const shape = form({ faktoren: [0.87, 0.83, 0.91, 1.24], cash: 200, laufzeit: 4 });
    expect(shape).toBe("back_loaded");

    // Kontrollrechnung beider Lesarten, damit der Befund im Test steht und nicht nur im Dokument.
    const jahre = [0.87, 0.83, 0.91, 1.24];
    const haelften = (jahre[2]! + jahre[3]!) / 2 - (jahre[0]! + jahre[1]!) / 2;
    const naiv = jahre[0]! - (jahre[1]! + jahre[2]! + jahre[3]!) / 3;
    expect(Math.round(haelften * 100) / 100).toBe(0.22);
    expect(Math.round(naiv * 100) / 100).toBe(-0.12);
    expect(Math.sign(haelften)).not.toBe(Math.sign(naiv));

    // Und die Schedule zeigt es: das erste Jahr zahlt weniger als der Durchschnitt.
    const plan = schedule("back_loaded", 10, 4);
    expect(plan.yearlySalarySchedule[0]!.salary).toBeLessThan((plan.totalSalary ?? 0) / 4);
    expect(plan.yearlySalarySchedule[3]!.salary).toBeGreaterThan((plan.totalSalary ?? 0) / 4);
  });

  it("spaete Vertragsjahre zaehlen VOLL — ohne Jahr 4 gaebe es die Drehung nicht", () => {
    // Dieselben Jahre, nur ohne das letzte: Δ faellt auf +0,04 und die Regel schweigt.
    expect(form({ faktoren: [0.87, 0.83, 0.91], cash: 200 })).toBe("balanced");
    // Mit dem vierten Jahr kippt sie. Eine Abwertung spaeter Jahre haette dieses Signal geloescht.
    expect(form({ faktoren: [0.87, 0.83, 0.91, 1.24], cash: 200, laufzeit: 4 })).toBe("back_loaded");
  });

  /**
   * RANGFOLGE Kassenklemme > Faktor > Profil. Das Profil hier („wageSensitivity 9" bei dicker Kasse)
   * saehe front_loaded vor — der Faktor ueberstimmt es.
   */
  it("der Faktor ueberstimmt die Profil-Neigungen", () => {
    const profil = { bias: { wageSensitivity: 9, longContractPreference: 9 } } as never;
    // Ohne Fenster entscheidet das Profil.
    expect(form({ faktoren: [], cash: 200, profile: profil })).toBe("front_loaded");
    // Steigendes Fenster: der Faktor gewinnt.
    expect(form({ faktoren: [0.85, 1.2, 1.2], cash: 200, profile: profil })).toBe("back_loaded");
    // Fallendes Fenster: dieselbe Richtung wie das Profil, aber jetzt aus dem Fenster begruendet.
    expect(form({ faktoren: [1.2, 0.85, 0.85], cash: 200, profile: profil })).toBe("front_loaded");

    // Und andersherum: ein sparsames Profil (cashPriority 9, Kasse ueber der Wache aber ohne
    // dicken Puffer) wird von einem FALLENDEN Fenster nach vorn gezogen.
    const sparsam = { bias: { cashPriority: 9 } } as never;
    expect(form({ faktoren: [], cash: 35, requiredReserve: 20, profile: sparsam })).toBe("back_loaded");
    expect(form({ faktoren: [1.2, 0.85, 0.85], cash: 35, requiredReserve: 20, profile: sparsam })).toBe("front_loaded");
  });

  it("die Kassenklemme bleibt VOR dem Faktor — ein klammes Sparprofil wird nie nach vorn gezogen", () => {
    const sparsam = { bias: { cashPriority: 9 } } as never;
    // cash 8 < requiredReserve 20 + 6 → tightNow, und cashPriority 9 ≥ 7 → Regel 1 greift zuerst.
    expect(form({ faktoren: [1.2, 0.85, 0.85], cash: 8, requiredReserve: 20, profile: sparsam })).toBe("back_loaded");
  });

  it("front_loaded haengt an der BESTEHENDEN Cash-Wache requiredReserve + 10 — keine zweite Zahl", () => {
    // Genau auf der Wache: erlaubt. Ein Zehntel darunter: verwehrt.
    expect(form({ faktoren: [1.2, 0.85, 0.85], cash: 30, requiredReserve: 20 })).toBe("front_loaded");
    expect(form({ faktoren: [1.2, 0.85, 0.85], cash: 29.9, requiredReserve: 20 })).toBe("balanced");
    // back_loaded braucht keine Wache — es entlastet das erste Jahr.
    expect(form({ faktoren: [0.85, 1.2, 1.2], cash: 0, requiredReserve: 20 })).toBe("back_loaded");
  });
});

/**
 * DER HORIZONT DER VERTRAGSJAHRE — Jahr i gegen `window[i]`, und was jenseits des Fensters gilt.
 *
 * Auch dieser Pfad laeuft im Spiel nur in der Saisonende-Kette; das Fenster wird deshalb von Hand
 * gestellt statt eine Saison zu simulieren.
 */
describe("Schritt 2 — welche Faktoren ein Vertrag ueberhaupt sieht", () => {
  const FENSTER = [1.19, 0.87, 0.83, 0.91, 1.24];

  it("in der Preseason ist Vertragsjahr 1 der Horizont 1 — das Fenster rueckt erst danach vor", () => {
    const preseason = bauLigaMitUeberzahler("transfer_sell_phase", FENSTER);
    expect(resolveContractTermSalaryFactors(preseason, 4)).toEqual([0.87, 0.83, 0.91, 1.24]);

    // In einer bereits gestarteten Saison ist Jahr 1 dagegen der Horizont 0.
    const laufend = bauLigaMitUeberzahler("season_active", FENSTER);
    expect(resolveContractTermSalaryFactors(laufend, 4)).toEqual([1.19, 0.87, 0.83, 0.91]);
  });

  it("Jahre jenseits des Fensters bekommen das MITTEL der bekannten — nicht den letzten Wert", () => {
    const preseason = bauLigaMitUeberzahler("transfer_sell_phase", FENSTER);
    const jahre = resolveContractTermSalaryFactors(preseason, 6);
    expect(jahre).toHaveLength(6);
    expect(jahre.slice(0, 4)).toEqual([0.87, 0.83, 0.91, 1.24]);
    const mittel = (0.87 + 0.83 + 0.91 + 1.24) / 4;
    expect(jahre[4]).toBeCloseTo(mittel, 10);
    expect(jahre[5]).toBeCloseTo(mittel, 10);
    // Ausdruecklich NICHT die Fortschreibung des letzten Faktors — das waere die Behauptung, der
    // 1,24-Ausreisser halte an, und blaehte das Gefaelle kuenstlich auf (+0,39 statt +0,25).
    expect(jahre[4]).not.toBe(1.24);
  });

  it("reicht das Fenster genau, wird nichts gefuellt", () => {
    const preseason = bauLigaMitUeberzahler("transfer_sell_phase", FENSTER);
    expect(resolveContractTermSalaryFactors(preseason, 2)).toEqual([0.87, 0.83]);
    expect(resolveContractTermSalaryFactors(preseason, 4)).toHaveLength(4);
  });
});
