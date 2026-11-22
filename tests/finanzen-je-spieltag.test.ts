import { describe, expect, it } from "vitest";

import type { GameState, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { buildKontoauszuege } from "@/lib/finance/kontoauszug";
import {
  finanzenJeSpieltagFuerNeueSaison,
  istJeSpieltagSaison,
  stempleFinanzenJeSpieltagBeimAnlegen,
  summeSpieltagBuchungen,
  teileJahresbetrag,
} from "@/lib/finance/finanzen-je-spieltag";
import { kasseVorSpieltagsbuchungen } from "@/lib/finance/finanzen-je-spieltag";
import { bucheSpieltagFinanzen } from "@/lib/finance/finanzen-je-spieltag-buchung";
import { erwarteteSpieltagBuchung } from "@/lib/finance/finanzen-je-spieltag-erwartung";
import { berechneGebaeudeSaisonbetraege } from "@/lib/facilities/facility-season-end-service";
import {
  applySponsorSettlement,
  getSeasonSponsorCashByTeam,
  previewSponsorSettlement,
  sponsorBasisJahr,
  sponsorRangAbschlag,
} from "@/lib/sponsor/sponsor-settlement-service";
import { getTeamActualSalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import { berechneVorstandBudgetStand } from "@/lib/finance/vorstand-budgetfreigabe";

/**
 * FINANZEN JE SPIELTAG (22.11.) — Idempotenz, Pause, Kauf/Verkauf, In-Saison-Verlaengerung, Summengleichheit alt/neu,
 * Stempel/Schalter, Mensch = KI, Kasse = Summe der Buchungen. Konzept: docs/design/finanzen-je-spieltag-22-11.md.
 */

const TEAM = "A-A";

function bestuecke(gameState: GameState, jeTeam = 8): GameState {
  const used = new Set(gameState.rosters.map((r) => r.playerId));
  const frei = gameState.players.filter((p) => !used.has(p.id));
  let zaehler = 0;
  const rosters = [...gameState.rosters];
  for (const team of gameState.teams) {
    for (let i = 0; i < jeTeam; i += 1) {
      const player = frei[zaehler++]!;
      rosters.push({
        id: `fjs-roster-${team.teamId}-${i}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: 5 + (i % 4),
        upkeep: 5 + (i % 4),
        purchasePrice: 10,
        currentValue: 10,
        roleTag: "bench",
        joinedSeasonId: gameState.season.id,
      });
    }
  }
  return { ...gameState, rosters };
}

function mitSponsor(gameState: GameState, teamId: string): GameState {
  const contract: TeamSponsorContract = {
    seasonId: gameState.season.id,
    teamId,
    offerId: "fjs-test-offer",
    archetype: "security",
    name: "Test-Sponsor",
    chosenAt: "2026-01-01T00:00:00.000Z",
    startRank: 16,
    components: [{ componentId: "base-fjs", kind: "base", label: "Saisonbasis", targetValue: "season", rewardCash: 40 }],
    payouts: {},
    rarity: "magisch",
    teamQualityRankAtSign: 16,
  };
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorContractsByTeamId: { ...(gameState.seasonState.sponsorContractsByTeamId ?? {}), [teamId]: contract },
    },
  };
}

function mitFanShop(gameState: GameState, teamId: string): GameState {
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      teamFacilities: {
        ...(gameState.seasonState.teamFacilities ?? {}),
        [teamId]: { facilities: { fan_shop: { level: 2, enabled: true, conditionPct: 100 } } } as never,
      },
    },
  };
}

function fixture(): { alt: GameState; neu: GameState } {
  let gs = createFreshSeasonOneGameState();
  gs = mitFanShop(mitSponsor(bestuecke(gs), TEAM), TEAM);
  return { alt: gs, neu: stempleFinanzenJeSpieltagBeimAnlegen(gs) };
}

function buchAlle(gameState: GameState, bis?: number): GameState {
  let gs = gameState;
  const ids = gameState.season.matchdayIds.slice(0, bis);
  for (const id of ids) gs = bucheSpieltagFinanzen(gs, id);
  return gs;
}

const cashVon = (gs: GameState, teamId: string) => gs.teams.find((t) => t.teamId === teamId)!.cash;

describe("Stempel und Schalter", () => {
  it("neues Spiel bekommt den Stempel, ein fremder Stempel zaehlt nicht, ohne Stempel ist der alte Weg aktiv", () => {
    const { alt, neu } = fixture();
    expect(istJeSpieltagSaison(alt)).toBe(false);
    expect(istJeSpieltagSaison(neu)).toBe(true);
    expect(neu.seasonState.finanzenJeSpieltag).toEqual({ seasonId: neu.seasonState.seasonId, version: "v1" });
    const fremd: GameState = { ...neu, seasonState: { ...neu.seasonState, finanzenJeSpieltag: { seasonId: "season-99", version: "v1" } } };
    expect(istJeSpieltagSaison(fremd)).toBe(false);
  });

  it("Stempeln ist idempotent", () => {
    const { neu } = fixture();
    expect(stempleFinanzenJeSpieltagBeimAnlegen(neu)).toBe(neu);
  });

  it("OLY_FINANZEN_JE_SPIELTAG=aus: neue Saisons bekommen keinen Stempel", () => {
    const vorher = process.env.OLY_FINANZEN_JE_SPIELTAG;
    try {
      process.env.OLY_FINANZEN_JE_SPIELTAG = "aus";
      expect(finanzenJeSpieltagFuerNeueSaison("season-2")).toBeNull();
      const { alt } = fixture();
      expect(stempleFinanzenJeSpieltagBeimAnlegen(alt)).toBe(alt);
      process.env.OLY_FINANZEN_JE_SPIELTAG = "an";
      expect(finanzenJeSpieltagFuerNeueSaison("season-2")).toEqual({ seasonId: "season-2", version: "v1" });
    } finally {
      if (vorher == null) delete process.env.OLY_FINANZEN_JE_SPIELTAG;
      else process.env.OLY_FINANZEN_JE_SPIELTAG = vorher;
    }
  });

  it("ohne Stempel ist die Buchung ein No-op (derselbe Spielstand, bit-identisch)", () => {
    const { alt } = fixture();
    expect(bucheSpieltagFinanzen(alt, alt.season.matchdayIds[0]!)).toBe(alt);
    expect(getTeamActualSalaryTotal(alt, TEAM)).toBeGreaterThan(0);
  });
});

describe("Buchung je Spieltag", () => {
  it("bucht alle Teams gleich (Mensch, KI, delegiert) und Kasse = Summe der Buchungen", () => {
    const { neu } = fixture();
    // Ein Team als menschlich gesteuert markieren: die Buchung darf nirgends nach Besitzer verzweigen.
    const gemischt: GameState = {
      ...neu,
      seasonState: {
        ...neu.seasonState,
        teamControlSettings: {
          [neu.teams[1]!.teamId]: { teamId: neu.teams[1]!.teamId, controlMode: "manual" } as never,
          [neu.teams[2]!.teamId]: { teamId: neu.teams[2]!.teamId, controlMode: "ai" } as never,
        },
      },
    };
    const nach = bucheSpieltagFinanzen(gemischt, gemischt.season.matchdayIds[0]!);
    expect(nach.seasonState.spieltagFinanzen).toHaveLength(gemischt.teams.length);
    for (const team of gemischt.teams) {
      const zeile = nach.seasonState.spieltagFinanzen!.find((z) => z.teamId === team.teamId)!;
      expect(cashVon(nach, team.teamId)).toBeCloseTo(Math.round((team.cash + zeile.cashDelta) * 10) / 10, 9);
      const kader = gemischt.rosters.filter((r) => r.teamId === team.teamId).reduce((s, r) => s + (r.salary ?? 0), 0);
      expect(zeile.gehalt).toBeCloseTo(-Math.round((kader / gemischt.season.matchdayIds.length) * 10) / 10, 9);
    }
  });

  it("ist idempotent je Spieltag: Replay und Re-Apply buchen nichts doppelt", () => {
    const { neu } = fixture();
    const id = neu.season.matchdayIds[0]!;
    const einmal = bucheSpieltagFinanzen(neu, id);
    const zweimal = bucheSpieltagFinanzen(einmal, id);
    expect(zweimal).toBe(einmal);
    expect(zweimal.seasonState.spieltagFinanzen).toHaveLength(neu.teams.length);
    expect(cashVon(zweimal, TEAM)).toBe(cashVon(einmal, TEAM));
  });

  it("die Saisonpause ist kein Spieltag: eine unbekannte ID bucht nichts, gebucht wird nur je Spielplan-Spieltag", () => {
    const { neu } = fixture();
    expect(bucheSpieltagFinanzen(neu, "saisonpause")).toBe(neu);
    const voll = buchAlle(neu);
    expect(voll.seasonState.spieltagFinanzen).toHaveLength(neu.teams.length * neu.season.matchdayIds.length);
    // Nenner ist die Spieltagszahl des Spielplans, nicht hart 20 (diese Fixture hat 10).
    expect(voll.seasonState.spieltagFinanzen![0]!.matchdayCount).toBe(neu.season.matchdayIds.length);
  });

  it("Summengleichheit: Gehalt ueber die Saison = alte Saisonendsumme (+-0,05), Rundungsrest wandert weiter", () => {
    const { alt, neu } = fixture();
    const voll = buchAlle(neu);
    for (const team of neu.teams) {
      const gebucht = -summeSpieltagBuchungen(voll, team.teamId).gehalt;
      expect(Math.abs(gebucht - getTeamActualSalaryTotal(alt, team.teamId))).toBeLessThanOrEqual(0.05 + 1e-9);
      // Die Saisonzahl der Anzeige ist nach der letzten Buchung genau die gebuchte Summe.
      expect(Math.abs(getTeamActualSalaryTotal(voll, team.teamId) - gebucht)).toBeLessThanOrEqual(0.1);
    }
  });

  it("Teilung mit Rest: 10 x teileJahresbetrag ergibt den Jahresbetrag auf 0,05", () => {
    let rest = 0;
    let summe = 0;
    for (let i = 0; i < 10; i += 1) {
      const r = teileJahresbetrag(107.7, 10, rest);
      summe += r.betrag;
      rest = r.rest;
    }
    expect(Math.abs(summe - 107.7)).toBeLessThanOrEqual(0.05 + 1e-9);
  });
});

describe("Saisonende gegen Altmodus", () => {
  it("Endkasse im neuen Modus = Endkasse im alten (Sponsor, Gehalt, Gebaeude), Saisonende bucht keine Basis und kein Gehalt doppelt", () => {
    const { alt, neu } = fixture();
    const altEnde = applySponsorSettlement({ gameState: alt, saveId: "t", execute: true, deductSalary: true }).gameState;
    const neuVoll = buchAlle(neu);
    const neuEnde = applySponsorSettlement({ gameState: neuVoll, saveId: "t", execute: true, deductSalary: true });
    expect(neuEnde.applied).toBe(true);
    // Gebaeude: Einnahme/Unterhalt je Spieltag; im Altmodus am Saisonende. Gegenrechnung ueber dieselben Saisonbetraege.
    const geb = berechneGebaeudeSaisonbetraege(alt, TEAM);
    expect(geb.income).toBeGreaterThan(0);
    for (const team of neu.teams) {
      const altKasse = cashVon(altEnde, team.teamId) + (team.teamId === TEAM ? geb.income - geb.upkeep : 0);
      expect(Math.abs(cashVon(neuEnde.gameState, team.teamId) - altKasse)).toBeLessThanOrEqual(0.15);
    }
    // Das Saisonende bucht kein Gehalt mehr: die salary_deduct-Marke traegt 0.
    const marke = (neuEnde.gameState.seasonState.sponsorPayoutLogs ?? []).filter((l) => l.teamId === TEAM && l.componentId === "salary_deduct");
    expect(marke).toHaveLength(1);
    expect(marke[0]!.cashDelta).toBe(0);
    // Sponsor der Saison (Logs + Ledger) = alter Saisonwert.
    const altSponsor = getSeasonSponsorCashByTeam(altEnde).get(TEAM) ?? 0;
    const neuSponsor = getSeasonSponsorCashByTeam(neuEnde.gameState).get(TEAM) ?? 0;
    expect(Math.abs(altSponsor - neuSponsor)).toBeLessThanOrEqual(0.15);
    expect(neuSponsor).toBeGreaterThan(0);
  });

  it("ein zweiter Apply am Saisonende bucht nichts mehr (Idempotenz je Team ueber die season_end-Marke)", () => {
    const { neu } = fixture();
    const einmal = applySponsorSettlement({ gameState: buchAlle(neu), saveId: "t", execute: true, deductSalary: true });
    const zweimal = applySponsorSettlement({ gameState: einmal.gameState, saveId: "t", execute: true, deductSalary: true });
    expect(cashVon(zweimal.gameState, TEAM)).toBe(cashVon(einmal.gameState, TEAM));
  });

  it("fehlende Spieltage werden am Saisonende anteilig nachgebucht: keine Luecke", () => {
    const { alt, neu } = fixture();
    const altEnde = applySponsorSettlement({ gameState: alt, saveId: "t", execute: true, deductSalary: true }).gameState;
    const luecke = buchAlle(neu, neu.season.matchdayIds.length - 2);
    const ende = applySponsorSettlement({ gameState: luecke, saveId: "t", execute: true, deductSalary: true }).gameState;
    const geb = berechneGebaeudeSaisonbetraege(alt, TEAM);
    for (const team of neu.teams) {
      // Gebaeude laufen ueber den Facility-Dienst; fuer Teams ohne Gebaeude ist die Kasse direkt vergleichbar.
      if (team.teamId === TEAM) continue;
      expect(Math.abs(cashVon(ende, team.teamId) - cashVon(altEnde, team.teamId))).toBeLessThanOrEqual(0.15);
    }
    expect(geb.income).toBeGreaterThan(0);
  });
});

describe("Sonderfaelle", () => {
  it("Verkauf mitten in der Saison: Gehalt nur fuer die Spieltage im Kader", () => {
    const { neu } = fixture();
    const n = neu.season.matchdayIds.length;
    const vorher = buchAlle(neu, 4);
    const verkauft: GameState = { ...vorher, rosters: vorher.rosters.filter((r) => !(r.teamId === TEAM && r.id === `fjs-roster-${TEAM}-3`)) };
    const gehaltVolle = vorher.rosters.filter((r) => r.teamId === TEAM).reduce((s, r) => s + (r.salary ?? 0), 0);
    const gehaltOhne = verkauft.rosters.filter((r) => r.teamId === TEAM).reduce((s, r) => s + (r.salary ?? 0), 0);
    expect(gehaltOhne).toBeLessThan(gehaltVolle);
    let gs = verkauft;
    for (const id of neu.season.matchdayIds.slice(4)) gs = bucheSpieltagFinanzen(gs, id);
    const soll = (gehaltVolle * 4 + gehaltOhne * (n - 4)) / n;
    expect(Math.abs(-summeSpieltagBuchungen(gs, TEAM).gehalt - soll)).toBeLessThanOrEqual(0.1);
  });

  it("Kauf mitten in der Saison: der Neue kostet ab dem naechsten Abschluss, nichts rueckwirkend", () => {
    const { neu } = fixture();
    const n = neu.season.matchdayIds.length;
    const vorher = buchAlle(neu, 3);
    const used = new Set(vorher.rosters.map((r) => r.playerId));
    const player = vorher.players.find((p) => !used.has(p.id))!;
    const gekauft: GameState = {
      ...vorher,
      rosters: [
        ...vorher.rosters,
        { id: "fjs-neu", teamId: TEAM, playerId: player.id, contractLength: 2, salary: 10, upkeep: 10, purchasePrice: 5, currentValue: 5, roleTag: "bench", joinedSeasonId: vorher.season.id },
      ],
    };
    const bisher = -summeSpieltagBuchungen(vorher, TEAM).gehalt;
    let gs = gekauft;
    for (const id of neu.season.matchdayIds.slice(3)) gs = bucheSpieltagFinanzen(gs, id);
    const mehr = -summeSpieltagBuchungen(gs, TEAM).gehalt - bisher;
    const kaderMit = gekauft.rosters.filter((r) => r.teamId === TEAM).reduce((s, r) => s + (r.salary ?? 0), 0);
    expect(Math.abs(mehr - (kaderMit * (n - 3)) / n)).toBeLessThanOrEqual(0.1);
  });

  it("In-Saison-Verlaengerung: ab dem Spieltag das neue Gehalt, ohne Mischrechnung, nichts rueckwirkend", () => {
    const { neu } = fixture();
    const n = neu.season.matchdayIds.length;
    const eintrag = neu.rosters.find((r) => r.teamId === TEAM && r.id === `fjs-roster-${TEAM}-0`)!;
    const alt = eintrag.salary!;
    const nachUnterschrift: GameState = {
      ...neu,
      rosters: neu.rosters.map((r) =>
        r.id === eintrag.id
          ? {
              ...r,
              salary: 12,
              upkeep: 12,
              inSaisonVerlaengerung: { seasonId: neu.season.id, spieltageAlt: 4, spieltageGesamt: n, altesGehalt: alt, neuesGehalt: 12, endSaisonNummer: 2 },
            }
          : r,
      ),
    };
    const gs = buchAlle(nachUnterschrift);
    const ohne = nachUnterschrift.rosters.filter((r) => r.teamId === TEAM && r.id !== eintrag.id).reduce((s, r) => s + (r.salary ?? 0), 0);
    const soll = (ohne * n + alt * 4 + 12 * (n - 4)) / n;
    expect(Math.abs(-summeSpieltagBuchungen(gs, TEAM).gehalt - soll)).toBeLessThanOrEqual(0.1);
    // Die Anzeige mischt nichts mehr: gebucht ist gebucht.
    expect(Math.abs(getTeamActualSalaryTotal(gs, TEAM) + summeSpieltagBuchungen(gs, TEAM).gehalt)).toBeLessThanOrEqual(0.1);
  });

  it("Sponsor-Basis und Gebaeude laufen je Spieltag; Kontoauszug zeigt jede Buchung mit Spieltag und die Summe stimmt", () => {
    const { neu } = fixture();
    const gs = buchAlle(neu, 3);
    const s = summeSpieltagBuchungen(gs, TEAM);
    expect(s.sponsorBasis).toBeGreaterThan(0);
    expect(s.gebaeudeEinnahme).toBeGreaterThan(0);
    expect(s.gehalt).toBeLessThan(0);
    const konto = buildKontoauszuege(gs, gs.season.id).get(TEAM)!;
    const spieltagZeilen = konto.zeilen.filter((z) => z.quelle === "spieltagFinanzen");
    expect(spieltagZeilen.every((z) => z.phase === "saison" && z.matchdayId != null)).toBe(true);
    expect(Math.abs(spieltagZeilen.reduce((x, z) => x + z.betrag, 0) - s.cashDelta)).toBeLessThanOrEqual(0.15);
    expect(sponsorBasisJahr(gs, TEAM)).toBeGreaterThan(0);
  });

  it("die erwartete Buchung je Spieltag deckt sich mit der gebuchten (Rundung)", () => {
    const { neu } = fixture();
    const n = neu.season.matchdayIds.length;
    const erw = erwarteteSpieltagBuchung(neu, TEAM);
    const gs = buchAlle(neu, 1);
    const s = summeSpieltagBuchungen(gs, TEAM);
    expect(Math.abs(s.gehalt - erw.gehalt)).toBeLessThanOrEqual(0.06);
    expect(Math.abs(s.sponsorBasis - erw.sponsorBasis)).toBeLessThanOrEqual(0.06);
    expect(n).toBeGreaterThan(0);
  });

  it("Vorstands-Freigabe: die Quote rechnet weiter auf die Kasse vor den Spieltagsbuchungen", () => {
    const { alt, neu } = fixture();
    const anderes = alt.teams[3]!.teamId;
    const standAlt = berechneVorstandBudgetStand(alt, anderes);
    const standNeu = berechneVorstandBudgetStand(buchAlle(neu, 5), anderes);
    // Freigegebene Gesamtsumme des Transfertopfs ist unveraendert (die harte Grenze ist die echte Kasse).
    expect(standNeu.freigegebenGesamt).toBeCloseTo(standAlt.freigegebenGesamt, 6);
    expect(standNeu.nochFrei).toBeLessThanOrEqual(standAlt.nochFrei + 1e-9);
  });
});


/* ================================================================ Rang-Abschlag (Chris, 22.11.) */

/** Setzt den Tabellenplatz eines Teams (nur das Feld, das der Sponsor-Rang liest). */
function mitPlatz(gameState: GameState, teamId: string, rank: number): GameState {
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      standings: { ...(gameState.seasonState.standings ?? {}), [teamId]: { teamId, rank, points: 10 } as never },
    },
  };
}

const rangZeile = (gs: GameState) =>
  previewSponsorSettlement(gs, "season_end").rows.find((r) => r.teamId === TEAM && r.kind === "rank")!.cashDelta;

describe("Rang-Abschlag je Spieltag", () => {
  it("Abschlag = 0,8 x (Leiter(Platz) - Sockel) / N, mit Platz in der Zeile, gleich fuer jeden Spieltag bei gleichem Platz", () => {
    const { neu } = fixture();
    const gs = buchAlle(mitPlatz(neu, TEAM, 2), 3);
    const n = neu.season.matchdayIds.length;
    const { praemie, abschlag } = sponsorRangAbschlag(gs, TEAM, 2, n);
    expect(praemie).toBeGreaterThan(0);
    expect(Math.abs(abschlag - (0.8 * praemie) / n)).toBeLessThanOrEqual(0.05);
    const zeilen = (gs.seasonState.spieltagFinanzen ?? []).filter((z) => z.teamId === TEAM);
    expect(zeilen).toHaveLength(3);
    for (const z of zeilen) {
      expect(z.rangAbschlag).toBe(abschlag);
      expect(z.rang).toBe(2);
    }
    // Kasse = Summe der Buchungen bleibt exakt, der Abschlag steckt in cashDelta.
    const z = zeilen[0]!;
    expect(z.cashDelta).toBeCloseTo(z.gehalt + z.sponsorBasis + z.gebaeudeEinnahme + z.gebaeudeUnterhalt + abschlag, 6);
    expect(summeSpieltagBuchungen(gs, TEAM).rangAbschlag).toBeCloseTo(3 * abschlag, 6);
  });

  it("offene Spieltage rechnen mit dem aktuellen Platz weiter: die Erwartung traegt den Abschlag", () => {
    const { neu } = fixture();
    const gs = mitPlatz(neu, TEAM, 2);
    const n = neu.season.matchdayIds.length;
    const erw = erwarteteSpieltagBuchung(gs, TEAM);
    expect(Math.abs(erw.rangAbschlag - sponsorRangAbschlag(gs, TEAM, 2, n).abschlag)).toBeLessThanOrEqual(0.05);
    expect(erw.netto).toBeCloseTo(erw.gehalt + erw.sponsorBasis + erw.gebaeudeEinnahme + erw.gebaeudeUnterhalt + erw.rangAbschlag, 9);
  });

  it("Schlussausgleich positiv: Platz verbessert sich, Summe Abschlaege + Ausgleich = Praemie(Endrang) exakt", () => {
    const { neu } = fixture();
    let gs = buchAlle(mitPlatz(neu, TEAM, 20), 10);
    gs = buchAlle(mitPlatz(gs, TEAM, 5), undefined);
    gs = mitPlatz(gs, TEAM, 1);
    const praemie = rangZeile(gs);
    const abschlaege = summeSpieltagBuchungen(gs, TEAM).rangAbschlag;
    const ende = applySponsorSettlement({ gameState: gs, saveId: "t", execute: true, deductSalary: true }).gameState;
    const log = (ende.seasonState.sponsorPayoutLogs ?? []).find((l) => l.teamId === TEAM && (l.componentId ?? "").endsWith(":v3:rank"))!;
    expect(log.cashDelta).toBeGreaterThan(0);
    expect(Math.round((abschlaege + log.cashDelta) * 10) / 10).toBe(praemie);
    // Der Kontoauszug nennt die Zeile "Rangpraemie Schlussausgleich".
    const konto = buildKontoauszuege(ende, ende.season.id).get(TEAM)!;
    expect(konto.zeilen.some((z) => z.art === "rang_schlussausgleich" && z.text === "Rangprämie Schlussausgleich")).toBe(true);
    expect(konto.zeilen.filter((z) => z.art === "rang_abschlag_spieltag")).toHaveLength(ende.season.matchdayIds.length);
    expect(konto.zeilen.find((z) => z.art === "rang_abschlag_spieltag")!.text).toMatch(/^Rangprämie Abschlag Spieltag 1\/\d+ \(Platz 20\)$/);
  });

  it("Schlussausgleich negativ: Platz faellt ab, der Ausgleich zieht von der Kasse ab, die Summe stimmt weiter", () => {
    const { neu } = fixture();
    let gs = buchAlle(mitPlatz(neu, TEAM, 1));
    gs = mitPlatz(gs, TEAM, 32);
    const praemie = rangZeile(gs);
    const abschlaege = summeSpieltagBuchungen(gs, TEAM).rangAbschlag;
    expect(abschlaege).toBeGreaterThan(praemie);
    const vorher = cashVon(gs, TEAM);
    const ende = applySponsorSettlement({ gameState: gs, saveId: "t", execute: true, deductSalary: true }).gameState;
    const log = (ende.seasonState.sponsorPayoutLogs ?? []).find((l) => l.teamId === TEAM && (l.componentId ?? "").endsWith(":v3:rank"))!;
    expect(log.cashDelta).toBeLessThan(0);
    expect(Math.round((abschlaege + log.cashDelta) * 10) / 10).toBe(praemie);
    expect(cashVon(ende, TEAM)).toBeLessThan(vorher + 1e-9 + 100);
    // Sponsor der Saison (Logs + Ledger) enthaelt die Praemie genau einmal.
    const sponsor = getSeasonSponsorCashByTeam(ende).get(TEAM) ?? 0;
    const vorschau = getSeasonSponsorCashByTeam(gs).get(TEAM) ?? 0;
    expect(Math.abs(sponsor - vorschau)).toBeLessThanOrEqual(0.15);
  });

  it("Endkasse bleibt gleich dem Altmodus, auch mit wechselnden Plaetzen (Abschlag + Ausgleich = Praemie)", () => {
    const { alt, neu } = fixture();
    const endPlatz = 7;
    const altEnde = applySponsorSettlement({ gameState: mitPlatz(alt, TEAM, endPlatz), saveId: "t", execute: true, deductSalary: true }).gameState;
    let gs = buchAlle(mitPlatz(neu, TEAM, 3), 12);
    gs = buchAlle(mitPlatz(gs, TEAM, 11));
    const neuEnde = applySponsorSettlement({ gameState: mitPlatz(gs, TEAM, endPlatz), saveId: "t", execute: true, deductSalary: true }).gameState;
    const geb = berechneGebaeudeSaisonbetraege(alt, TEAM);
    const altKasse = cashVon(altEnde, TEAM) + geb.income - geb.upkeep;
    expect(Math.abs(cashVon(neuEnde, TEAM) - altKasse)).toBeLessThanOrEqual(0.15);
  });

  it("Ruckweg und Pause: ohne Stempel kein Abschlag, die Saisonpause bucht keinen", () => {
    const { alt, neu } = fixture();
    const ohne = bucheSpieltagFinanzen(mitPlatz(alt, TEAM, 2), alt.season.matchdayIds[0]!);
    expect(ohne.seasonState.spieltagFinanzen ?? []).toHaveLength(0);
    const pause = bucheSpieltagFinanzen(mitPlatz(neu, TEAM, 2), "pause-nach-spieltag-10");
    expect(pause.seasonState.spieltagFinanzen ?? []).toHaveLength(0);
    // Im Altmodus bucht das Saisonende die volle Rangpraemie (kein Ledger, kein Ausgleich).
    const praemie = rangZeile(mitPlatz(alt, TEAM, 2));
    const ende = applySponsorSettlement({ gameState: mitPlatz(alt, TEAM, 2), saveId: "t", execute: true, deductSalary: true }).gameState;
    const log = (ende.seasonState.sponsorPayoutLogs ?? []).find((l) => l.teamId === TEAM && (l.componentId ?? "").endsWith(":v3:rank"))!;
    expect(log.cashDelta).toBe(praemie);
  });

  it("ohne Sponsorvertrag kein Abschlag", () => {
    const { neu } = fixture();
    const gs = buchAlle(neu, 1);
    const anderes = neu.teams[3]!.teamId;
    expect(gs.seasonState.spieltagFinanzen!.find((z) => z.teamId === anderes)!.rangAbschlag).toBe(0);
  });
});

describe("Kasse fuer KI-Entscheidungen (Verlaengerung)", () => {
  it("mitten in der Saison die Kasse vor den Spieltagsbuchungen, nach der Saisonabrechnung die echte Kasse", () => {
    const { neu } = fixture();
    const gs = buchAlle(mitPlatz(neu, TEAM, 2), 5);
    const L = summeSpieltagBuchungen(gs, TEAM).cashDelta;
    expect(L).not.toBe(0);
    expect(kasseVorSpieltagsbuchungen(gs, TEAM, cashVon(gs, TEAM))).toBeCloseTo(cashVon(gs, TEAM) - L, 6);
    const ende = applySponsorSettlement({ gameState: buchAlle(gs), saveId: "t", execute: true, deductSalary: true }).gameState;
    expect(kasseVorSpieltagsbuchungen(ende, TEAM, cashVon(ende, TEAM))).toBe(cashVon(ende, TEAM));
    // ohne Stempel immer die echte Kasse
    expect(kasseVorSpieltagsbuchungen(fixture().alt, TEAM, 12.3)).toBe(12.3);
  });
});
