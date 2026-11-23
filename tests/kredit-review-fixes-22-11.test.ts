import { describe, expect, it } from "vitest";

import { resolveAiLoanDecision } from "@/lib/ai/ai-loan-decision-service";
import type { GameState, LoanRecord } from "@/lib/data/olyDataTypes";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { stempleFinanzenJeSpieltagBeimAnlegen } from "@/lib/finance/finanzen-je-spieltag";
import { bucheSpieltagFinanzen } from "@/lib/finance/finanzen-je-spieltag-buchung";
import {
  kreditSaisonZerlegung,
  kreditSaisonwechsel,
  ratenSicht,
  stempleKreditRegelBeimAnlegen,
  stempleKreditRegelNachLaden,
} from "@/lib/finance/kredit-raten";
import { baueKreditVorschau } from "@/lib/finance/kredite-seite-modell";
import { pruefeKreditAufnahme } from "@/lib/finance/kredit-pruefung";
import { applyLoanSettlement, computeEarlyPayoff, originateLoan, previewLoanSettlement } from "@/lib/finance/loan-service";

/**
 * REVIEW-FIXES PR #1717 (22.11.): W1 ungezahlte Tilgung zaehlt nicht doppelt, W2 Verzug wird weiter eingezogen, W3 die KI geht durch dieselbe
 * Sperre, M1 gezeigt = gebucht im Rueckweg, M2 Rechner = Route, M3 fremdes Geld nur mit Freigabe, K1 Ledger-Zeile beim Geber, K2 Neu-Verrenten.
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
        id: `krf-roster-${team.teamId}-${i}`,
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

const mitKasse = (gs: GameState, teamId: string, cash: number): GameState => ({
  ...gs,
  teams: gs.teams.map((t) => (t.teamId === teamId ? { ...t, cash } : t)),
});

function ratenSpielstand(): GameState {
  return stempleKreditRegelBeimAnlegen(stempleFinanzenJeSpieltagBeimAnlegen(mitKasse(bestuecke(createFreshSeasonOneGameState()), BORGER, 200)));
}
function saisonendeSpielstand(): GameState {
  return stempleKreditRegelNachLaden(stempleFinanzenJeSpieltagBeimAnlegen(mitKasse(bestuecke(createFreshSeasonOneGameState()), BORGER, 200)));
}

function nimmKredit(gs: GameState, principal: number, term: number, lenderTeamId?: string): GameState {
  const r = originateLoan(
    gs,
    { borrowerTeamId: BORGER, principal, termSeasons: term, ...(lenderTeamId ? { lenderType: "team" as const, lenderTeamId } : {}) },
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
const loanVon = (gs: GameState): LoanRecord => (gs.seasonState.loans ?? [])[0]!;
const cashVon = (gs: GameState, teamId: string) => gs.teams.find((t) => t.teamId === teamId)!.cash;
const r1 = (x: number) => Math.round(x * 10) / 10;

describe("W1 Zahlungsausfall: die ungezahlte Tilgung zaehlt nicht doppelt", () => {
  it("Raten je Spieltag: 100 C, 3 Saisons, nichts gezahlt -> Restschuld = 100 + ungezahlter Zins + 5 % Fehlbetrag", () => {
    const start = mitKasse(nimmKredit(ratenSpielstand(), 100, 3), BORGER, -5000);
    const vorher = loanVon(start);
    const n = vorher.ratenJeSaison!;
    const zins = r1((100 * vorher.interestRatePerSeason) / n);
    const rate0 = r1(vorher.rateJeSpieltag!);
    const nach = buche(start, 0, 1);
    const erwartet = 100 + zins + 0.05 * rate0;
    expect(loanVon(nach).principalOutstanding).toBeCloseTo(erwartet, 1);
    // Der alte Fehler: Rate samt 5 % obendrauf auf die volle Restschuld.
    expect(loanVon(nach).principalOutstanding).toBeLessThan(100 + rate0 * 1.05 - 0.5);
  });

  it("Saisonende-Weg: Restschuld = Restschuld - gezahlte Tilgung + ungezahlter Zins + Strafzins", () => {
    const start = mitKasse(nimmKredit(saisonendeSpielstand(), 100, 3), BORGER, 0);
    const l = loanVon(start);
    const zins = r1(100 * l.interestRatePerSeason);
    const rate = l.installmentPerSeason;
    const nach = applyLoanSettlement(start, { execute: true }).gameState;
    expect(loanVon(nach).principalOutstanding).toBeCloseTo(100 + zins + 0.05 * rate, 1);
    expect(loanVon(nach).principalOutstanding).toBeLessThan(100 + rate * 1.05 - 0.5);
  });
});

describe("W2 Verzug wird weiter eingezogen", () => {
  function inVerzug(lenderTeamId?: string): GameState {
    const gs = nimmKredit(ratenSpielstand(), 30, 3, lenderTeamId);
    const l = loanVon(gs);
    return { ...gs, seasonState: { ...gs.seasonState, loans: [{ ...l, status: "defaulted", missedPayments: 5 }] } };
  }

  it("ratenSicht liefert fuer einen Kredit in Verzug keine null mehr", () => {
    const gs = inVerzug();
    expect(ratenSicht(gs, loanVon(gs))).not.toBeNull();
    expect(kreditSaisonZerlegung(gs, loanVon(gs)).jeSpieltag).toBe(true);
  });

  it("an Spieltagen mit positiver Kasse zahlt der Kredit weiter, Status bleibt Verzug, der Geber bekommt den Rueckfluss", () => {
    const geber = "B-B";
    const gs = inVerzug(geber);
    const nach = buche(gs, 0, 2);
    expect(loanVon(nach).status).toBe("defaulted");
    expect(loanVon(nach).principalOutstanding).toBeLessThan(30);
    const posten = (nach.seasonState.spieltagFinanzen ?? []).filter((z) => z.teamId === BORGER).flatMap((z) => z.kredit ?? []);
    expect(posten).toHaveLength(2);
    expect(posten.every((p) => (p.ausfall ?? 0) === 0 && p.zins + p.tilgung > 0)).toBe(true);
    const eingang = (nach.seasonState.spieltagFinanzen ?? []).filter((z) => z.teamId === geber).reduce((s, z) => s + (z.kreditEingang ?? 0), 0);
    expect(eingang).toBeGreaterThan(0);
  });

  it("-1 Vertrauen je Saison in Verzug: einmal, nicht je Spieltag", () => {
    let gs = inVerzug();
    gs = { ...gs, seasonState: { ...gs.seasonState, boardConfidence: { [BORGER]: { teamId: BORGER, value: 6, pressure: 5, warnings: [] } } } };
    const nach = buche(gs, 0, 3);
    expect(nach.seasonState.boardConfidence?.[BORGER]?.value).toBe(5);
    expect(loanVon(nach).missedPayments).toBe(5);
  });

  it("ist die Restschuld getilgt, endet der Verzug (paid)", () => {
    let gs = inVerzug();
    const l = loanVon(gs);
    gs = { ...gs, seasonState: { ...gs.seasonState, loans: [{ ...l, principalOutstanding: 0.2, ratenOffen: 1 }] } };
    const nach = buche(gs, 0, 1);
    expect(loanVon(nach).status).toBe("paid");
    expect(loanVon(nach).principalOutstanding).toBe(0);
  });

  it("5 verpasste Raten innerhalb der Saison -> Verzug; der Saisonwechsel setzt den Zaehler zurueck", () => {
    const start = mitKasse(nimmKredit(ratenSpielstand(), 10, 2), BORGER, -5000);
    const n = start.season.matchdayIds.length;
    const nach = buche(start, 0, Math.ceil(n * 0.25));
    expect(loanVon(nach).status).toBe("defaulted");
    const neu = kreditSaisonwechsel(nach.seasonState.loans ?? [], n);
    expect(neu[0]!.missedPayments).toBe(0);
    expect(neu[0]!.status).toBe("defaulted");
  });

  it("am Laufzeitende keine Ballonzahlung: die letzte Rate verpasst -> eine Saison Verlaengerung, neue Rate endlich", () => {
    let gs = mitKasse(nimmKredit(ratenSpielstand(), 10, 1), BORGER, -5000);
    const l = loanVon(gs);
    gs = { ...gs, seasonState: { ...gs.seasonState, loans: [{ ...l, ratenOffen: 1 }] } };
    const nach = buche(gs, 0, 1);
    const k = loanVon(nach);
    expect(k.status).toBe("active");
    expect(k.ratenOffen).toBe(k.ratenJeSaison);
    expect(Number.isFinite(k.rateJeSpieltag!)).toBe(true);
    expect(k.rateJeSpieltag!).toBeGreaterThan(0);
    // Die neue Rate ist KEINE Ballonzahlung: weit unter der ganzen Restschuld.
    expect(k.rateJeSpieltag!).toBeLessThan(k.principalOutstanding / 2);
  });

  it("Saisonende-Weg: ein Kredit in Verzug wird weiter eingezogen und kostet -1 Vertrauen", () => {
    let gs = nimmKredit(saisonendeSpielstand(), 30, 3);
    const l = loanVon(gs);
    gs = { ...gs, seasonState: { ...gs.seasonState, loans: [{ ...l, status: "defaulted", missedPayments: 0 }] } };
    const row = previewLoanSettlement(gs).rows[0]!;
    expect(row.status).toBe("paid_full");
    expect(row.boardConfidenceDelta).toBe(-1);
    const nach = applyLoanSettlement(gs, { execute: true }).gameState;
    expect(loanVon(nach).principalOutstanding).toBeLessThan(30);
    expect(loanVon(nach).status).toBe("defaulted");
  });
});

describe("W3 die KI geht durch dieselbe Sperre", () => {
  it("die KI leiht nie, wenn die gemeinsame Sperre (20 %, Sparauflage) mit der echten Rate nein sagt", () => {
    let gs = nimmKredit(ratenSpielstand(), 150, 2);
    gs = { ...gs, season: { ...gs.season, id: "season-2" }, seasonState: { ...gs.seasonState, seasonId: "season-2" } };
    gs = mitKasse(gs, BORGER, -40);
    const d = resolveAiLoanDecision(gs, BORGER);
    if (d.shouldBorrow) {
      const probe = originateLoan(gs, { borrowerTeamId: BORGER, principal: d.loanAmount, termSeasons: d.termSeasons }, { execute: false });
      expect(pruefeKreditAufnahme(gs, BORGER, probe.loan!.installmentPerSeason).ok).toBe(true);
    } else {
      expect(d.reason).not.toBe("liquidity_negative_cash");
    }
  });
});

describe("M1 gezeigt = gebucht im Rueckweg", () => {
  it("Raten-Kredit in einer saisonende-Saison: GuV/Verpflichtungen zeigen genau die gebuchte Jahresrate", () => {
    const raten = nimmKredit(ratenSpielstand(), 100, 3);
    const rueck: GameState = { ...raten, seasonState: { ...raten.seasonState, kreditRegel: { seasonId: raten.seasonState.seasonId, regel: "saisonende" } } };
    const z = kreditSaisonZerlegung(rueck, loanVon(rueck));
    expect(z.jeSpieltag).toBe(false);
    const row = previewLoanSettlement(rueck).rows[0]!;
    expect(r1(z.rate)).toBe(r1(row.installmentCharged));
    expect(r1(z.zins)).toBe(r1(row.interestPortion));
    expect(computeEarlyPayoff(loanVon(rueck), rueck).payoff).toBeGreaterThan(0);
  });
});

describe("M2 Rechner und Route urteilen gleich (saisonende-Saison)", () => {
  it("die Pruefung des Rechners bekommt installmentPerSeason des simulierten Kredits wie die Route", () => {
    const gs = saisonendeSpielstand();
    const v = baueKreditVorschau(gs, BORGER, { betrag: 100, laufzeit: 3, geberId: null, guvAktuell: 0 });
    const sim = originateLoan(gs, { borrowerTeamId: BORGER, principal: 100, termSeasons: 3 }, { execute: false });
    const route = pruefeKreditAufnahme(gs, BORGER, sim.loan!.installmentPerSeason);
    expect(v.quoteNeu).toBeCloseTo(route.quoteNeu, 10);
    expect(v.sperreGrund === "schuldendienst_obergrenze").toBe(route.reason === "schuldendienst_obergrenze");
    const bis = v.wirkung.find((w) => w.schluessel === "bisSaisonende")!;
    expect(-bis.neu!).toBeCloseTo(sim.loan!.installmentPerSeason, 1);
  });
});

describe("M3 fremdes Geld nur ueber das freigegebene Budget", () => {
  const GEBER = "B-B";
  function mitGeber(budget: number | null): GameState {
    const gs = ratenSpielstand();
    return {
      ...gs,
      seasonState: {
        ...gs.seasonState,
        teamControlSettings: {
          ...(gs.seasonState.teamControlSettings ?? {}),
          [GEBER]: { teamId: GEBER, controlMode: "manual", ...(budget == null ? {} : { lendingBudget: budget }) },
        } as never,
      },
    };
  }
  const poste = (gs: GameState, betrag: number) =>
    originateLoan(gs, { borrowerTeamId: BORGER, principal: betrag, termSeasons: 2, lenderType: "team", lenderTeamId: GEBER }, { execute: true });

  it("ohne Freigabe geht per direktem POST gar nichts", () => {
    const r = poste(mitGeber(null), 10);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("lender_budget_not_released");
  });
  it("mit Freigabe nur bis zum Budget", () => {
    expect(poste(mitGeber(12), 10).ok).toBe(true);
    const r = poste(mitGeber(12), 15);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("lender_budget_not_released");
  });
  it("schon Verliehenes zaehlt mit", () => {
    const erst = poste(mitGeber(12), 10).gameState;
    expect(poste(erst, 5).ok).toBe(false);
  });
});

describe("K1 Rueckfluss an einen Geber mit schon stehender Zeile", () => {
  it("die Zeile des Gebers bekommt kreditEingang, Kasse = Summe der Buchungen", () => {
    const geber = "B-B";
    const gs0 = nimmKredit(ratenSpielstand(), 30, 2, geber);
    const tag = gs0.season.matchdayIds[0]!;
    const ganz = bucheSpieltagFinanzen(gs0, tag);
    const zeileGeber = (ganz.seasonState.spieltagFinanzen ?? []).find((z) => z.teamId === geber)!;
    // Der Geber hat seine Zeile fuer den Tag schon (ohne Kreditanteil), der Kreditnehmer noch nicht.
    const ohneKredit = { ...zeileGeber, cashDelta: r1(zeileGeber.cashDelta - (zeileGeber.kreditEingang ?? 0)) };
    delete (ohneKredit as { kreditEingang?: number }).kreditEingang;
    const start: GameState = {
      ...mitKasse(gs0, geber, cashVon(gs0, geber) + ohneKredit.cashDelta),
      seasonState: { ...gs0.seasonState, spieltagFinanzen: [ohneKredit] },
    };
    const kasseVor = cashVon(start, geber);
    const nach = bucheSpieltagFinanzen(start, tag);
    const zeilen = (nach.seasonState.spieltagFinanzen ?? []).filter((z) => z.teamId === geber);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]!.kreditEingang ?? 0).toBeGreaterThan(0);
    expect(r1(cashVon(nach, geber) - kasseVor)).toBe(r1(zeilen[0]!.kreditEingang!));
    expect(zeilen[0]!.cashDelta).toBeCloseTo(ohneKredit.cashDelta + zeilen[0]!.kreditEingang!, 1);
  });
});

describe("K2 Saisonwechsel verrentet neu", () => {
  it("andere Spieltagszahl -> Rate auf die neue Zahl, gleiche Restschuld; gleiche Zahl bleibt unberuehrt", () => {
    const gs = nimmKredit(ratenSpielstand(), 100, 3);
    const l = loanVon(gs);
    const n = l.ratenJeSaison!;
    expect(kreditSaisonwechsel([l], n)[0]).toEqual(l);
    const neu = kreditSaisonwechsel([l], n * 2)[0]!;
    expect(neu.ratenJeSaison).toBe(n * 2);
    expect(neu.principalOutstanding).toBe(l.principalOutstanding);
    expect(neu.ratenOffen).toBe(3 * n * 2);
    expect(neu.rateJeSpieltag!).toBeGreaterThan(0);
    expect(neu.rateJeSpieltag!).toBeLessThan(l.rateJeSpieltag!);
  });
});
