import { describe, expect, it } from "vitest";

import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { buildTransferFinanceAudit, type TransferFinanceTeamSeasonRow } from "@/lib/season/transfer-finance-audit";
import { ensureNulaOnProjectSuicide } from "@/lib/foundation/ensure-nula-on-project-suicide";
import { acceptContractDissolution, type ContractDissolutionOffer } from "@/lib/morale/contract-dissolution-service";

/**
 * DAS HAUPTBUCH MUSS SICH FUER ALLE 32 TEAMS SCHLIESSEN.
 *
 * Die Kette, die hier geprueft wird, ist dieselbe, mit der der Befund am Live-Abbild
 * (`new-game-1785823388048-1hf25q`, Saison 2, Spieltag 10) gemessen wurde:
 *
 *     Startbudget  →  alle Kanaele der Saison 1  →  alle Kanaele der Saison 2  →  heutiges Cash
 *
 * Kanaele sind die Spalten, die `buildTransferFinanceAudit` je Team und Saison ausweist: Transfers,
 * Sponsoren, Sponsor-Events, APRON, Kredite, Gebaeude, Board-Ziele. Bleibt ein Rest ueber der
 * Toleranz von 0,10 C, hat ein Team Geld bewegt, das in keinem Buch steht.
 *
 * Am Abbild schlossen 30 von 32 Teams; die zwei Ausreisser waren genau die zwei Stellen, die zahlten
 * ohne zu buchen:
 *
 *   • Project Suicide      −4,62 C   Nula-Sonderregel (ensure-nula-on-project-suicide.ts)
 *   • Stronghold Crusaders +24,61 C  angenommene Vertragsaufloesung (contract-dissolution-service.ts)
 *
 * Beide Wege laufen in diesem Test durch den ECHTEN Dienst, nicht durch nachgebaute Buchungen — wer
 * die Buchung dort wieder entfernt, macht diesen Test rot. Der Apron-Kanal ist die dritte Luecke
 * derselben Sorte: er bewegte Cash und wurde nur im Audit nicht abgezogen.
 */

const TOLERANZ = 0.1;
/** Team-Kuerzel wie in der Liga: 30 gewoehnliche plus die beiden Teams aus dem Befund. */
const TEAM_IDS = [
  ...Array.from({ length: 30 }, (_, index) => `T-${String(index + 1).padStart(2, "0")}`),
  "P-S",
  "S-C",
];
const NULA_ID = "player-2311-nula";
const NULA_PREIS = 4.66;
/** Vorbesitzerin von Nula: die Sonderregel kauft sie ab, das abgebende Team wird gutgeschrieben. */
const NULA_VERKAEUFER = "T-01";
const AUFLOESUNGS_TEAM = "S-C";
const AUFLOESUNGS_SPIELER = "player-1894-rylialle";

function r2(value: number) {
  return Number(value.toFixed(2));
}

type Bewegung = { teamId: string; betrag: number };

/** Alle Cash-Kanaele einer Zeile — genau die Groessen, die zwischen Start und Ende stehen duerfen. */
function summeKanaele(row: TransferFinanceTeamSeasonRow) {
  return (
    row.netTransferCash +
    row.netSponsorCash +
    row.netSponsorEventCash +
    row.netApronCash +
    row.netLoanCash +
    row.netFacilityCash +
    row.netObjectiveRewardCash
  );
}

/**
 * Ein Spielstand mit 32 Teams, zwei Saisons und in beiden Saisons echten Bewegungen auf jedem
 * verfuegbaren Kanal. Das Cash jedes Teams wird aus genau diesen Bewegungen fortgeschrieben — der
 * Spielstand ist also per Konstruktion sauber, solange jede Bewegung auch gebucht wird.
 */
function baueSpielstand() {
  const budgetByTeam = new Map<string, number>();
  const cashByTeam = new Map<string, number>();
  const sponsorPayoutLogs: Array<{ seasonId: string; teamId: string; cashDelta: number; phase: string }> = [];
  const sponsorEvents: Array<{ seasonId: string; teamId: string; cashDelta: number; status: string }> = [];
  const apronSettlementLogs: Array<Record<string, unknown>> = [];
  const facilityEvents: Array<{ seasonId: string; teamId: string; cost: number }> = [];
  const transferHistory: TransferHistoryEntry[] = [];
  const cashEndSeason1: Bewegung[] = [];

  for (const [seasonIndex, seasonId] of ["season-1", "season-2"].entries()) {
    TEAM_IDS.forEach((teamId, index) => {
      if (seasonIndex === 0) {
        const budget = r2(180 + index * 3.5);
        budgetByTeam.set(teamId, budget);
        cashByTeam.set(teamId, budget);
      }
      const bewege = (betrag: number) => cashByTeam.set(teamId, r2((cashByTeam.get(teamId) ?? 0) + betrag));

      // Sponsoren: Auszahlung und Gehaltslast, beide im selben Ledger.
      const sponsorEin = r2(14 + index * 0.37 + seasonIndex * 2);
      const sponsorAus = r2(-(5 + index * 0.11));
      sponsorPayoutLogs.push({ seasonId, teamId, cashDelta: sponsorEin, phase: "settlement" });
      sponsorPayoutLogs.push({ seasonId, teamId, cashDelta: sponsorAus, phase: "salary" });
      bewege(sponsorEin + sponsorAus);

      // Mid-Season-Sponsor-Event: nur `resolved` ist kassenwirksam.
      if (index % 3 === 0) {
        const eventCash = r2(2.5 + index * 0.09);
        sponsorEvents.push({ seasonId, teamId, cashDelta: eventCash, status: "resolved" });
        sponsorEvents.push({ seasonId, teamId, cashDelta: 9.99, status: "open" });
        bewege(eventCash);
      }

      // APRON: Abgabe oder Ausschuettung am Saisonende — der Kanal, der im Audit fehlte.
      const apronCash = index % 2 === 0 ? r2(0.5 + index * 0.05) : r2(-(1 + index * 0.1));
      apronSettlementLogs.push({
        id: `apron:${seasonId}:${teamId}`,
        saveId: "test-save",
        seasonId,
        teamId,
        phase: "season_end",
        kind: apronCash < 0 ? "levy" : "payout",
        cashDelta: apronCash,
        action: "apply",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      bewege(apronCash);

      // Gebaeude: `cost` ist so gepolt, dass der Kasseneffekt `-cost` ist.
      if (index % 5 === 0) {
        const cost = r2(3 + index * 0.2);
        facilityEvents.push({ seasonId, teamId, cost });
        bewege(-cost);
      }

      // Transfermarkt: Kauf und Verkauf mit Buyout-Abzug.
      if (index % 3 === 1) {
        const fee = r2(9 + index * 0.41);
        transferHistory.push({
          id: `buy:${seasonId}:${teamId}`,
          playerId: `p-buy-${seasonId}-${teamId}`,
          seasonId,
          seasonLabel: `Season ${seasonIndex + 1}`,
          source: "manual_transfermarkt_buy",
          transferType: "buy",
          fromTeamId: null,
          toTeamId: teamId,
          fee,
          salary: 2,
          marketValue: fee,
          remainingContractLength: 3,
          happenedAt: "2026-01-01T00:00:00.000Z",
        });
        bewege(-fee);
      }
      if (index % 4 === 2) {
        const fee = r2(11 + index * 0.27);
        const buyoutCost = r2(1 + index * 0.03);
        transferHistory.push({
          id: `sell:${seasonId}:${teamId}`,
          playerId: `p-sell-${seasonId}-${teamId}`,
          seasonId,
          seasonLabel: `Season ${seasonIndex + 1}`,
          source: "manual_transfermarkt_sell",
          transferType: "sell",
          fromTeamId: teamId,
          toTeamId: null,
          fee,
          buyoutCost,
          netCashImpact: r2(fee - buyoutCost),
          salary: 2,
          marketValue: fee,
          remainingContractLength: 0,
          happenedAt: "2026-01-01T00:00:00.000Z",
        });
        bewege(fee - buyoutCost);
      }

      if (seasonIndex === 0) {
        cashEndSeason1.push({ teamId, betrag: cashByTeam.get(teamId) ?? 0 });
      }
    });
  }

  const gameState = {
    season: { id: "season-2", name: "Season 2" },
    matchdayState: { matchdayId: "season-2-matchday-10" },
    teams: TEAM_IDS.map((teamId) => ({
      teamId,
      name: teamId,
      shortCode: teamId,
      budget: budgetByTeam.get(teamId) ?? 0,
      cash: cashByTeam.get(teamId) ?? 0,
    })),
    teamIdentities: [],
    players: [
      { id: NULA_ID, name: "Nula", marketValue: NULA_PREIS, salaryDemand: 1.31 },
      { id: AUFLOESUNGS_SPIELER, name: "Rylialle", marketValue: 15.23, salaryDemand: 2 },
    ],
    rosters: [
      {
        id: "roster-nula",
        teamId: NULA_VERKAEUFER,
        playerId: NULA_ID,
        contractLength: 2,
        contractStatus: "active",
        salary: 1.31,
        upkeep: 0,
        roleTag: "bench",
        joinedSeasonId: "season-1",
      },
      {
        id: "roster-rylialle",
        teamId: AUFLOESUNGS_TEAM,
        playerId: AUFLOESUNGS_SPIELER,
        contractLength: 5,
        contractStatus: "active",
        salary: 2,
        upkeep: 0,
        roleTag: "bench",
        joinedSeasonId: "season-1",
      },
    ],
    transferHistory,
    seasonState: {
      seasonSnapshots: [
        {
          seasonId: "season-1",
          finalStandings: cashEndSeason1.map((row) => ({
            teamId: row.teamId,
            cashEnd: row.betrag,
            cashTotal: row.betrag,
          })),
        },
      ],
      sponsorPayoutLogs,
      sponsorEvents,
      apronSettlementLogs,
      facilityEvents,
    },
  } as unknown as GameState;

  return gameState;
}

/** Die angenommene Aufloesung aus dem Befund: Verkaufserloes 15,23 C, nicht erlassener Rest 4,38 C. */
const AUFLOESUNGS_ANGEBOT: ContractDissolutionOffer = {
  playerId: AUFLOESUNGS_SPIELER,
  playerName: "Rylialle",
  teamId: AUFLOESUNGS_TEAM,
  morale: 21,
  salePrice: 15.23,
  openBuyout: 8,
  waivedBuyout: 3.62,
  payableBuyout: 4.38,
  waiverShare: 0.4525,
  remainingContractLength: 5,
  previouslyDeclined: false,
};

function spielstandMitBeidenSonderwegen() {
  // 1) Sonderregel Nula: P-S kauft sie beim Vorbesitzer — beide Kassen bewegen sich.
  const nachNula = ensureNulaOnProjectSuicide(baueSpielstand());
  // 2) Angenommene Vertragsaufloesung: Verkaufserloes minus nicht erlassener Rest-Buyout.
  return acceptContractDissolution({
    gameState: nachNula,
    offer: AUFLOESUNGS_ANGEBOT,
    seasonId: "season-2",
    saveId: "test-save",
    decidedAt: "2026-02-02T00:00:00.000Z",
  });
}

describe("Hauptbuch: Startbudget → Saison 1 → Saison 2 → heutiges Cash", () => {
  it("schliesst fuer ALLE 32 Teams innerhalb von 0,10 C", () => {
    const gameState = spielstandMitBeidenSonderwegen();
    const audit = buildTransferFinanceAudit(gameState);

    expect(gameState.teams).toHaveLength(32);

    const reste = gameState.teams.map((team) => {
      const s1 = audit.rows.find((row) => row.teamId === team.teamId && row.seasonId === "season-1");
      const s2 = audit.rows.find((row) => row.teamId === team.teamId && row.seasonId === "season-2");
      const kanaele = summeKanaele(s1!) + summeKanaele(s2!);
      return { teamId: team.teamId, rest: r2(team.cash - (team.budget ?? 0) - kanaele) };
    });

    const offen = reste.filter((eintrag) => Math.abs(eintrag.rest) > TOLERANZ);
    expect(
      offen.map((eintrag) => `${eintrag.teamId}: ${eintrag.rest}`),
      "Teams, deren Kasse nicht durch gebuchte Kanaele erklaert ist",
    ).toEqual([]);
    expect(reste).toHaveLength(32);
  });

  it("weist die Nula-Sonderregel als Kauf bei P-S und als Verkauf beim Vorbesitzer aus", () => {
    const gameState = spielstandMitBeidenSonderwegen();
    const nula = gameState.transferHistory.filter((entry) => entry.playerId === NULA_ID);

    const kauf = nula.find((entry) => entry.transferType === "buy");
    const verkauf = nula.find((entry) => entry.transferType === "sell");
    expect(kauf?.toTeamId).toBe("P-S");
    expect(kauf?.fee).toBe(NULA_PREIS);
    expect(verkauf?.fromTeamId).toBe(NULA_VERKAEUFER);
    expect(verkauf?.netCashImpact).toBe(NULA_PREIS);

    // Die gebuchte Summe deckt die Kassenbewegung beider Seiten exakt ab.
    const audit = buildTransferFinanceAudit(gameState);
    const ps = audit.rows.find((row) => row.teamId === "P-S" && row.seasonId === "season-2");
    const verkaeufer = audit.rows.find((row) => row.teamId === NULA_VERKAEUFER && row.seasonId === "season-2");
    expect(ps?.cashReconciliationDelta).toBeCloseTo(0, 1);
    expect(verkaeufer?.cashReconciliationDelta).toBeCloseTo(0, 1);
  });

  it("bucht die angenommene Vertragsaufloesung mit ihrer tatsaechlichen Kassenwirkung", () => {
    const gameState = spielstandMitBeidenSonderwegen();
    const buchung = gameState.transferHistory.find((entry) => entry.playerId === AUFLOESUNGS_SPIELER);

    expect(buchung?.transferType).toBe("contract_exit");
    expect(buchung?.fromTeamId).toBe(AUFLOESUNGS_TEAM);
    expect(buchung?.fee).toBe(15.23);
    expect(buchung?.buyoutCost).toBe(4.38);
    // salePrice − payableBuyout: das ist, was wirklich auf dem Konto landet.
    expect(buchung?.netCashImpact).toBe(10.85);

    const audit = buildTransferFinanceAudit(gameState);
    const sc = audit.rows.find((row) => row.teamId === AUFLOESUNGS_TEAM && row.seasonId === "season-2");
    expect(sc?.cashReconciliationDelta).toBeCloseTo(0, 1);
  });

  it("zieht den Apron-Kanal in der Abstimmung ab (apronSettlementLogs)", () => {
    const gameState = spielstandMitBeidenSonderwegen();
    const audit = buildTransferFinanceAudit(gameState);

    const mitApron = audit.rows.filter((row) => row.seasonId === "season-2" && row.netApronCash !== 0);
    expect(mitApron).toHaveLength(32);

    for (const row of mitApron) {
      // Der Kanal ist nicht nur ausgewiesen, er ist auch abgezogen: die Abstimmung steht auf 0,
      // OHNE den Term bliebe genau `netApronCash` als Rest stehen — und der ist nicht null.
      expect(Math.abs(row.netApronCash)).toBeGreaterThan(0.4);
      expect(row.cashReconciliationDelta ?? 0).toBeCloseTo(0, 1);
    }
  });

  it("bucht die Sonderregel nicht doppelt, wenn derselbe Spielstand erneut materialisiert wird", () => {
    const einmal = ensureNulaOnProjectSuicide(baueSpielstand());
    const zweimal = ensureNulaOnProjectSuicide(einmal);
    const nulaEintraege = zweimal.transferHistory.filter((entry) => entry.playerId === NULA_ID);
    expect(nulaEintraege).toHaveLength(2);
    expect(zweimal.teams.find((team) => team.teamId === "P-S")?.cash).toBe(
      einmal.teams.find((team) => team.teamId === "P-S")?.cash,
    );

    // Verlaesst Nula P-S wirklich und die Regel kauft sie in derselben Saison erneut, wird der
    // zweite Kauf auch wirklich gebucht — sonst waere die alte Luecke ueber die ID-Vergabe zurueck.
    const erneut = ensureNulaOnProjectSuicide({
      ...zweimal,
      rosters: zweimal.rosters.filter((entry) => entry.playerId !== NULA_ID),
    });
    const kaeufe = erneut.transferHistory.filter((entry) => entry.playerId === NULA_ID && entry.transferType === "buy");
    expect(kaeufe).toHaveLength(2);
    expect(new Set(kaeufe.map((entry) => entry.id)).size).toBe(2);
    expect(erneut.teams.find((team) => team.teamId === "P-S")?.cash).toBe(
      r2((zweimal.teams.find((team) => team.teamId === "P-S")?.cash ?? 0) - NULA_PREIS),
    );
  });
});
