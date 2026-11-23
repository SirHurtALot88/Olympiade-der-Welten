import { afterEach, describe, expect, it } from "vitest";

import type { GameState, LoanRecord } from "@/lib/data/olyDataTypes";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { buildKontoauszuege } from "@/lib/finance/kontoauszug";
import { stempleFinanzenJeSpieltagBeimAnlegen, summeSpieltagBuchungen } from "@/lib/finance/finanzen-je-spieltag";
import { bucheSpieltagFinanzen } from "@/lib/finance/finanzen-je-spieltag-buchung";
import {
  alsJahresrateKredit,
  alsRatenKredit,
  kreditPlan,
  kreditRatenAktiv,
  kreditRegelFuerNeueSaison,
  kreditSaisonZerlegung,
  ratenKonditionen,
  stempleKreditRegelBeimAnlegen,
  stempleKreditRegelNachLaden,
} from "@/lib/finance/kredit-raten";
import {
  applyEarlyPayoff,
  applyLoanSettlement,
  buildLoanOffers,
  computeEarlyPayoff,
  getTeamAnnualLoanInstallment,
  getTeamAnnualLoanInterest,
  originateLoan,
} from "@/lib/finance/loan-service";
import { planeNotkreditRuecknahme } from "@/lib/finance/notkredit-ruecknahme";
import { computeTeamLoanShares } from "@/lib/finance/season-end-guv";

/**
 * KREDITRATEN JE SPIELTAG (22.11.): Stempel und Schalter, gleichbleibende Rate, Kasse = Summe der Buchungen, Idempotenz, keine Doppelbuchung
 * und keine Luecke beim Wechsel, Team-Kredit (Rueckfluss), Zahlungsausfall, letzte Rate, Notkredit-Ruecknahme, Ablöse, GuV nur Zins,
 * Mensch = KI. Konzept: docs/design/kredite-modern-22-11.md.
 */

const BORGER = "A-A";

function bestuecke(gameState: GameState, jeTeam = 8): GameState {
  const used = new Set(gameState.rosters.map((r) => r.playerId));
  const frei = gameState.players.filter((p) => !used.has(p.id));
  let zaehler = 0;
  const rosters = [...gameState.rosters];
  for (const team of gameState.teams) {
    for (let i = 0; i < jeTeam; i += 1) {
      const player = frei[zaehler++]!;
      rosters.push({
        id: `kr-roster-${team.teamId}-${i}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: 2,
        upkeep: 2,
        purchasePrice: 10,
        currentValue: 10,
        roleTag: "bench",
        joinedSeasonId: gameState.season.id,
      });
    }
  }
  return { ...gameState, rosters };
}

function mitKasse(gameState: GameState, teamId: string, cash: number): GameState {
  return { ...gameState, teams: gameState.teams.map((t) => (t.teamId === teamId ? { ...t, cash } : t)) };
}

/** Ein Spielstand mit Stempel `raten` (Finanzen je Spieltag an). */
function ratenSpielstand(): GameState {
  return stempleKreditRegelBeimAnlegen(stempleFinanzenJeSpieltagBeimAnlegen(mitKasse(bestuecke(createFreshSeasonOneGameState()), BORGER, 200)));
}

/** Ein Spielstand mit Finanzen je Spieltag, aber Kredit-Regel "saisonende" (bestehender Spielstand). */
function saisonendeSpielstand(): GameState {
  const gs = stempleFinanzenJeSpieltagBeimAnlegen(mitKasse(bestuecke(createFreshSeasonOneGameState()), BORGER, 200));
  return stempleKreditRegelNachLaden(gs);
}

function nimmKredit(gs: GameState, principal: number, term: number, extra?: { lenderTeamId?: string }): GameState {
  const r = originateLoan(
    gs,
    { borrowerTeamId: BORGER, principal, termSeasons: term, ...(extra?.lenderTeamId ? { lenderType: "team" as const, lenderTeamId: extra.lenderTeamId } : {}) },
    { execute: true, emergency: true },
  );
  expect(r.ok).toBe(true);
  return r.gameState;
}

function buche(gs: GameState, von: number, bis: number): GameState {
  let out = gs;
  for (const id of gs.season.matchdayIds.slice(von, bis)) out = bucheSpieltagFinanzen(out, id);
  return out;
}

const cashVon = (gs: GameState, teamId: string) => gs.teams.find((t) => t.teamId === teamId)!.cash;
const loanVon = (gs: GameState): LoanRecord => (gs.seasonState.loans ?? [])[0]!;

const SCHALTER = process.env.OLY_KREDIT_RATEN;
afterEach(() => {
  if (SCHALTER == null) delete process.env.OLY_KREDIT_RATEN;
  else process.env.OLY_KREDIT_RATEN = SCHALTER;
});

describe("Stempel und Schalter", () => {
  it("neues Spiel bekommt \"raten\", ein fremder Stempel zaehlt nicht, Stempeln ist idempotent", () => {
    const gs = ratenSpielstand();
    expect(gs.seasonState.kreditRegel).toEqual({ seasonId: gs.seasonState.seasonId, regel: "raten" });
    expect(kreditRatenAktiv(gs)).toBe(true);
    expect(stempleKreditRegelBeimAnlegen(gs)).toBe(gs);
    const fremd: GameState = { ...gs, seasonState: { ...gs.seasonState, kreditRegel: { seasonId: "season-99", regel: "raten" } } };
    expect(kreditRatenAktiv(fremd)).toBe(false);
  });

  it("ohne Finanzen je Spieltag gibt es keine Raten (dort wird gebucht)", () => {
    const gs = stempleKreditRegelBeimAnlegen(createFreshSeasonOneGameState());
    expect(gs.seasonState.kreditRegel?.regel).toBe("raten");
    expect(kreditRatenAktiv(gs)).toBe(false);
  });

  it("bestehender Spielstand: die laufende Saison bekommt \"saisonende\", neue Saisons den Schalter", () => {
    const alt = stempleFinanzenJeSpieltagBeimAnlegen(createFreshSeasonOneGameState());
    const geladen = stempleKreditRegelNachLaden(alt);
    expect(geladen.seasonState.kreditRegel).toEqual({ seasonId: alt.seasonState.seasonId, regel: "saisonende" });
    expect(kreditRatenAktiv(geladen)).toBe(false);
    expect(stempleKreditRegelNachLaden(geladen)).toBe(geladen);
    expect(kreditRegelFuerNeueSaison("season-2")).toEqual({ seasonId: "season-2", regel: "raten" });
  });

  it("OLY_KREDIT_RATEN=aus: neue Saisons bekommen \"saisonende\"", () => {
    process.env.OLY_KREDIT_RATEN = "aus";
    expect(kreditRegelFuerNeueSaison("season-2").regel).toBe("saisonende");
    process.env.OLY_KREDIT_RATEN = "an";
    expect(kreditRegelFuerNeueSaison("season-2").regel).toBe("raten");
  });
});

describe("Aufnahme und Konditionen", () => {
  it("der Kredit traegt Rate je Spieltag, Zahl der Raten und eine Jahressumme, die zur Rate passt", () => {
    const gs = nimmKredit(ratenSpielstand(), 10, 2);
    const loan = loanVon(gs);
    const n = gs.season.matchdayIds.length;
    expect(loan.ratenJeSaison).toBe(n);
    expect(loan.ratenOffen).toBe(2 * n);
    expect(loan.seasonsRemaining).toBe(2);
    const k = ratenKonditionen(10, loan.interestRatePerSeason, 2, n);
    expect(loan.rateJeSpieltag).toBe(k.rateJeSpieltag);
    expect(loan.installmentPerSeason).toBeCloseTo((loan.rateJeSpieltag ?? 0) * n, 1);
  });

  it("das Angebot zeigt dieselbe Rate, die gebucht wird (gezeigt = gebucht)", () => {
    const gs = ratenSpielstand();
    const bank = buildLoanOffers(gs, BORGER, 10, 2, { allowSeason1: true }).find((o) => o.lenderType === "bank")!;
    const aufgenommen = loanVon(nimmKredit(gs, 10, 2));
    expect(bank.rateJeSpieltag).toBe(aufgenommen.rateJeSpieltag);
    expect(bank.ratenGesamt).toBe(aufgenommen.ratenOffen);
    expect(bank.installmentPerSeason).toBe(aufgenommen.installmentPerSeason);
    expect(bank.gesamtZinsen).toBeGreaterThan(0);
  });

  it("in einer Saison ohne Raten bleibt alles beim Alten (keine Raten-Felder)", () => {
    const loan = loanVon(nimmKredit(saisonendeSpielstand(), 10, 2));
    expect(loan.ratenJeSaison).toBeUndefined();
    expect(loan.rateJeSpieltag).toBeUndefined();
  });
});

describe("Buchung je Spieltag", () => {
  it("Kasse = Summe der Buchungen, Zins und Tilgung stehen als Posten, die Restschuld sinkt", () => {
    const start = nimmKredit(ratenSpielstand(), 10, 2);
    const cash0 = cashVon(start, BORGER);
    const nach = buche(start, 0, 3);
    const ledger = (nach.seasonState.spieltagFinanzen ?? []).filter((z) => z.teamId === BORGER);
    expect(ledger).toHaveLength(3);
    const summe = summeSpieltagBuchungen(nach, BORGER);
    expect(summe.kreditZins).toBeLessThan(0);
    expect(summe.kreditTilgung).toBeLessThan(0);
    expect(cashVon(nach, BORGER)).toBeCloseTo(cash0 + summe.cashDelta, 1);
    for (const z of ledger) {
      expect(z.kredit).toHaveLength(1);
      expect(z.cashDelta).toBeCloseTo(
        z.gehalt + z.sponsorBasis + z.gebaeudeEinnahme + z.gebaeudeUnterhalt + (z.rangAbschlag ?? 0) + (z.marketing ?? 0) + (z.kreditZins ?? 0) + (z.kreditTilgung ?? 0),
        1,
      );
    }
    const loan = loanVon(nach);
    expect(loan.ratenOffen).toBe(2 * nach.season.matchdayIds.length - 3);
    expect(loan.principalOutstanding).toBeLessThan(10);
    // Die Summe der gezahlten Tilgung entspricht (auf Rundung) der gesunkenen Restschuld.
    expect(-summe.kreditTilgung).toBeCloseTo(10 - loan.principalOutstanding, 1);
  });

  it("idempotent: derselbe Spieltag, zweimal gebucht, belastet nur einmal", () => {
    const start = nimmKredit(ratenSpielstand(), 10, 2);
    const id = start.season.matchdayIds[0]!;
    const eins = bucheSpieltagFinanzen(start, id);
    const zwei = bucheSpieltagFinanzen(eins, id);
    expect(zwei).toBe(eins);
    expect(loanVon(eins).ratenOffen).toBe(loanVon(start).ratenOffen! - 1);
  });

  it("ohne Kredit aendert sich an der Spieltagsbuchung nichts (kein Kreditfeld in der Zeile)", () => {
    const nach = buche(ratenSpielstand(), 0, 1);
    for (const z of nach.seasonState.spieltagFinanzen ?? []) {
      expect(z.kredit).toBeUndefined();
      expect(z.kreditZins).toBeUndefined();
    }
  });

  it("der Plan zeigt, was gebucht wird: Rest nach einer Saison und Ratenzahl stimmen mit der Buchung ueberein", () => {
    const start = nimmKredit(ratenSpielstand(), 10, 2);
    const loan = loanVon(start);
    const n = start.season.matchdayIds.length;
    const plan = kreditPlan({ restschuld: 10, zinsJeSaison: loan.interestRatePerSeason, n, raten: loan.ratenOffen!, rate: loan.rateJeSpieltag!, start: 1 });
    expect(plan.raten).toBe(2 * n);
    expect(plan.saisons).toHaveLength(2);
    const nach = buche(start, 0, n);
    expect(loanVon(nach).principalOutstanding).toBeCloseTo(plan.saisons[0]!.rest, 1);
    // Die zweite Saison tilgt auf null, die letzte Rate loest den Rest.
    expect(plan.saisons[1]!.rest).toBeCloseTo(0, 3);
  });

  it("ein Kredit ueber eine Saison ist nach der letzten Rate bezahlt, die letzte Rate loest den Rest", () => {
    const start = nimmKredit(ratenSpielstand(), 6, 1);
    const nach = buche(start, 0, start.season.matchdayIds.length);
    const loan = loanVon(nach);
    expect(loan.status).toBe("paid");
    expect(loan.principalOutstanding).toBe(0);
    expect(loan.ratenOffen).toBe(0);
    const summe = summeSpieltagBuchungen(nach, BORGER);
    // Gesamt gezahlt = Kreditsumme + Zinsen (Rundung: hoechstens ein paar Zehntel).
    expect(-(summe.kreditZins + summe.kreditTilgung)).toBeGreaterThan(6);
    expect(-summe.kreditTilgung).toBeCloseTo(6, 0);
  });

  it("Team-Kredit: der Geber bekommt genau, was der Nehmer zahlt (Rueckfluss im Ledger)", () => {
    const geber = "B-B";
    const start = nimmKredit(mitKasse(ratenSpielstand(), geber, 100), 10, 2, { lenderTeamId: geber });
    const vorherNehmer = cashVon(start, BORGER);
    const vorherGeber = cashVon(start, geber);
    const nach = buche(start, 0, 2);
    const n = summeSpieltagBuchungen(nach, BORGER);
    const g = summeSpieltagBuchungen(nach, geber);
    expect(g.kreditEingang).toBeCloseTo(-(n.kreditZins + n.kreditTilgung), 1);
    expect(cashVon(nach, geber)).toBeCloseTo(vorherGeber + g.cashDelta, 1);
    expect(cashVon(nach, BORGER)).toBeCloseTo(vorherNehmer + n.cashDelta, 1);
    // Der Kontoauszug zeigt Zins, Tilgung und Rueckfluss.
    const kontoNehmer = buildKontoauszuege(nach).get(BORGER)!;
    expect(kontoNehmer.jeArt.kredit_zins_spieltag).toBeCloseTo(n.kreditZins, 1);
    expect(kontoNehmer.jeArt.kredit_tilgung_spieltag).toBeCloseTo(n.kreditTilgung, 1);
    expect(buildKontoauszuege(nach).get(geber)!.jeArt.kredit_eingang_spieltag).toBeCloseTo(g.kreditEingang, 1);
  });

  it("Mensch = KI: die Buchung verzweigt nicht nach Besitzer", () => {
    const start = nimmKredit(ratenSpielstand(), 10, 2);
    const mensch: GameState = {
      ...start,
      seasonState: { ...start.seasonState, teamControlSettings: { [BORGER]: { teamId: BORGER, controlMode: "manual" } as never } },
    };
    const a = buche(start, 0, 2);
    const b = buche(mensch, 0, 2);
    expect(loanVon(b).principalOutstanding).toBe(loanVon(a).principalOutstanding);
    expect(cashVon(b, BORGER)).toBe(cashVon(a, BORGER));
  });
});

describe("Zahlungsausfall", () => {
  it("ohne Geld: bezahlt wird, was da ist, der Rest wird samt Strafzins kapitalisiert, der Vorstand verliert einmal Vertrauen", () => {
    let start = nimmKredit(ratenSpielstand(), 10, 2);
    // Kasse leeren: sie liegt nach den anderen Fluessen des Spieltags im Minus.
    start = mitKasse(start, BORGER, -50);
    start = { ...start, seasonState: { ...start.seasonState, boardConfidence: { [BORGER]: { teamId: BORGER, value: 6, pressure: 5, warnings: [] } } } };
    const nach = buche(start, 0, 2);
    const loan = loanVon(nach);
    expect(loan.missedPayments).toBe(2);
    // Nichts gezahlt: die Restschuld wuchs um die ganze Rate samt 5 % Strafzins.
    expect(loan.principalOutstanding).toBeGreaterThan(10);
    const posten = (nach.seasonState.spieltagFinanzen ?? []).filter((z) => z.teamId === BORGER).flatMap((z) => z.kredit ?? []);
    expect(posten.every((p) => (p.ausfall ?? 0) > 0)).toBe(true);
    // EIN Vertrauenspunkt je Kredit und Saison, nicht je Spieltag.
    expect(nach.seasonState.boardConfidence?.[BORGER]?.value).toBe(5);
  });

  it("nach einem Viertel der Saison verpasster Raten gilt der Kredit als geplatzt", () => {
    let start = nimmKredit(ratenSpielstand(), 10, 2);
    start = mitKasse(start, BORGER, -500);
    const n = start.season.matchdayIds.length;
    const nach = buche(start, 0, Math.ceil(n * 0.25));
    expect(loanVon(nach).status).toBe("defaulted");
  });
});

describe("Keine Doppelbuchung, keine Luecke beim Wechsel", () => {
  it("Raten-Saison: die Saisonende-Abrechnung fasst den Kredit nicht an", () => {
    const gs = buche(nimmKredit(ratenSpielstand(), 10, 2), 0, 5);
    const vorher = loanVon(gs);
    const r = applyLoanSettlement(gs, { execute: true });
    expect(r.applied).toBe(false);
    expect(r.gameState.seasonState.loans?.[0]).toEqual(vorher);
    expect(r.gameState.seasonState.loanApplyLogs ?? []).toHaveLength(0);
  });

  it("Saison ohne Raten: nur die Saisonende-Abrechnung bucht, die Spieltage lassen den Kredit in Ruhe", () => {
    const start = nimmKredit(saisonendeSpielstand(), 10, 2);
    const nach = buche(start, 0, 4);
    expect(loanVon(nach)).toEqual(loanVon(start));
    expect((nach.seasonState.spieltagFinanzen ?? []).every((z) => z.kredit == null)).toBe(true);
    const abgerechnet = applyLoanSettlement(nach, { execute: true });
    expect(abgerechnet.applied).toBe(true);
    expect(loanVon(abgerechnet.gameState).seasonsRemaining).toBe(1);
  });

  it("Wechsel: ein Kredit der alten Saison wird in der Raten-Saison umgerechnet und zahlt dann je Spieltag, ohne Luecke", () => {
    // Alte Saison: Jahresrate am Saisonende.
    const alt = nimmKredit(saisonendeSpielstand(), 10, 3);
    const abgerechnet = applyLoanSettlement(alt, { execute: true }).gameState;
    const restNachAlterSaison = loanVon(abgerechnet);
    expect(restNachAlterSaison.seasonsRemaining).toBe(2);
    // Neue Saison mit Raten-Stempel (Saisonwechsel setzt ihn).
    const neu: GameState = {
      ...abgerechnet,
      seasonState: { ...abgerechnet.seasonState, kreditRegel: { seasonId: abgerechnet.seasonState.seasonId, regel: "raten" } },
    };
    const n = neu.season.matchdayIds.length;
    const umgerechnet = alsRatenKredit(restNachAlterSaison, n);
    expect(umgerechnet.ratenOffen).toBe(2 * n);
    expect(umgerechnet.principalOutstanding).toBe(restNachAlterSaison.principalOutstanding);
    const nach = buche(neu, 0, 2);
    expect(loanVon(nach).ratenOffen).toBe(2 * n - 2);
    expect(loanVon(nach).principalOutstanding).toBeLessThan(restNachAlterSaison.principalOutstanding);
  });

  it("Rueckweg: ein Raten-Kredit in einer Saison ohne Raten wird zur Jahresrate zurueckgerechnet und am Saisonende einmal gebucht", () => {
    const raten = buche(nimmKredit(ratenSpielstand(), 10, 2), 0, 3);
    const ohne: GameState = {
      ...raten,
      seasonState: { ...raten.seasonState, kreditRegel: { seasonId: raten.seasonState.seasonId, regel: "saisonende" } },
    };
    const zurueck = alsJahresrateKredit(loanVon(ohne));
    expect(zurueck.ratenOffen).toBeUndefined();
    expect(zurueck.seasonsRemaining).toBe(2);
    const r = applyLoanSettlement(ohne, { execute: true });
    expect(r.applied).toBe(true);
    expect(loanVon(r.gameState).seasonsRemaining).toBe(1);
    expect(loanVon(r.gameState).ratenOffen).toBeUndefined();
  });
});

describe("Zahlen der Seite und der GuV", () => {
  it("Saisonrate und Saisonzins bleiben im Lauf der Saison stabil (gebucht plus offen)", () => {
    const start = nimmKredit(ratenSpielstand(), 12, 3);
    const a = buche(start, 0, 0);
    const b = buche(start, 0, 7);
    const c = buche(start, 0, 14);
    expect(getTeamAnnualLoanInstallment(b, BORGER)).toBeCloseTo(getTeamAnnualLoanInstallment(a, BORGER), 0);
    expect(getTeamAnnualLoanInstallment(c, BORGER)).toBeCloseTo(getTeamAnnualLoanInstallment(a, BORGER), 0);
    expect(Math.abs(getTeamAnnualLoanInterest(b, BORGER) - getTeamAnnualLoanInterest(a, BORGER))).toBeLessThan(0.15);
    expect(Math.abs(getTeamAnnualLoanInterest(c, BORGER) - getTeamAnnualLoanInterest(a, BORGER))).toBeLessThan(0.25);
  });

  it("nach der ganzen Saison steht in der GuV genau der gebuchte Zins, die Tilgung bleibt Bilanz", () => {
    const start = nimmKredit(ratenSpielstand(), 12, 3);
    const nach = buche(start, 0, start.season.matchdayIds.length);
    const summe = summeSpieltagBuchungen(nach, BORGER);
    const guv = computeTeamLoanShares(nach, BORGER);
    expect(guv.interest).toBeCloseTo(-summe.kreditZins, 0);
    expect(guv.principal).toBeCloseTo(-summe.kreditTilgung, 0);
    const z = kreditSaisonZerlegung(nach, loanVon(nach));
    expect(z.jeSpieltag).toBe(true);
    expect(z.rate).toBeCloseTo(-(summe.kreditZins + summe.kreditTilgung), 0);
  });

  it("ein in der Saison getilgter Kredit behaelt seinen gezahlten Zins in der GuV", () => {
    const start = nimmKredit(ratenSpielstand(), 6, 1);
    const nach = buche(start, 0, start.season.matchdayIds.length);
    expect(loanVon(nach).status).toBe("paid");
    expect(getTeamAnnualLoanInterest(nach, BORGER)).toBeCloseTo(-summeSpieltagBuchungen(nach, BORGER).kreditZins, 1);
  });
});

describe("Ablöse und Notkredit-Rücknahme", () => {
  it("die Ablöse rechnet mit den offenen Spieltagsraten und setzt den Kredit auf bezahlt", () => {
    const gs = buche(nimmKredit(ratenSpielstand(), 10, 2), 0, 5);
    const loan = loanVon(gs);
    const quote = computeEarlyPayoff(loan);
    expect(quote.principalPortion).toBe(Math.round(loan.principalOutstanding * 10) / 10);
    expect(quote.foregoneInterest).toBeGreaterThan(0);
    const r = applyEarlyPayoff(gs, loan.loanId, { execute: true });
    expect(r.ok).toBe(true);
    expect(loanVon(r.gameState).status).toBe("paid");
    expect(loanVon(r.gameState).ratenOffen).toBe(0);
  });

  it("ein Zwangs-Notkredit mit Spieltagsraten wird erkannt, solange keine Rate gezahlt ist, und danach nicht mehr", () => {
    let gs = ratenSpielstand();
    const r = originateLoan(gs, { borrowerTeamId: BORGER, principal: 7, termSeasons: 4, lenderType: "bank" }, { execute: true, emergency: true });
    gs = r.gameState;
    expect(planeNotkreditRuecknahme(gs).zeilen).toHaveLength(1);
    const einRate = buche(gs, 0, 1);
    const plan = planeNotkreditRuecknahme(einRate);
    expect(plan.zeilen).toHaveLength(0);
    expect(plan.behalten[0]?.grund).toContain("Rate");
  });
});
