import { ankerNachSaison, fanGruendeSaisonende, fanGruendeSpieltag, fanPrognoseFaktor, sternFans, sternGewicht, startStadionPlaetze, startStadionSchritte, wendeFanGruendeAn } from "@/lib/arena/fan-modell";
import { afterEach, describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { stempleFinanzenJeSpieltagBeimAnlegen, summeSpieltagBuchungen } from "@/lib/finance/finanzen-je-spieltag";
import { bucheSpieltagFinanzen } from "@/lib/finance/finanzen-je-spieltag-buchung";
import { buildKontoauszuege } from "@/lib/finance/kontoauszug";
import { bauArenaAus } from "@/lib/arena/arena-ausbau";
import {
  GRUND_PLAETZE,
  PREIS_ANHEBUNG,
  OBERGRENZE,
  ausbauVorschau,
  bauKosten,
  dauerkartenGeld,
  kiDauerkartenStufe,
  leiterZeile,
  maxSchritte,
  rechneHeimspiel,
  stimmungNachSpieltag,
  unterhaltSaison,
  volleHausSaison,
} from "@/lib/arena/arena-modell";
import { arenaAktiv, arenaAusAltemGebaeude, stempleArenaBeimAnlegen, stempleArenaNachLaden } from "@/lib/arena/arena-regel";
import { ereignisProdukt, ereignisseFuerHeimspiel, holeArenaStand, setzeDauerkarten } from "@/lib/arena/arena-stand";
import { medaillenPlaetze, type MedaillenTabellenZeile } from "@/lib/foundation/leaders-modern";
import { medaillenAktiv, rangPraemieFaktor, stempleMedaillenBeimAnlegen, stempleMedaillenNachLaden } from "@/lib/medaillen/medaillen-regel";
import { sponsorRangAbschlag } from "@/lib/sponsor/sponsor-settlement-service";

/**
 * ARENA UND MEDAILLEN (22.11., docs/design/arena-tickets-medaillen-22-11.md): Leiter und Zahlen aus i.1, Nachfrage und Kasse,
 * Dauerkarten, Ausbau (Kasse, Obergrenze, harte Vorstands-Freigabe), Regel-Stempel, Buchung je Spieltag = Kontoauszug, Medaillen-Gleichstand.
 */

function neuesSpiel(): GameState {
  return stempleArenaBeimAnlegen(stempleMedaillenBeimAnlegen(stempleFinanzenJeSpieltagBeimAnlegen(createFreshSeasonOneGameState())));
}

afterEach(() => {
  delete process.env.OLY_ARENA;
  delete process.env.OLY_MEDAILLEN;
});

describe("Arena: Zahlen der Vorlage (i.1, h.1)", () => {
  it("Leiter: Bau gesamt und Unterhalt wie in der Tabelle", () => {
    expect(bauKosten("steh", 0, 12)).toBeCloseTo(12.0, 5);
    expect(bauKosten("sitz", 0, 9)).toBeCloseTo(19.6, 5);
    expect(bauKosten("loge", 0, 12)).toBeCloseTo(19.8, 5);
    expect(leiterZeile("steh", 7, false).bauGesamt).toBeCloseTo(6.5, 5);
    expect(leiterZeile("sitz", 6, false).bauGesamt).toBeCloseTo(12.4, 5);
    const voll = { steh: 15000, sitz: 10000, loge: 1200 };
    expect(unterhaltSaison(voll)).toBeCloseTo(4.2, 5);
    expect(volleHausSaison(voll, false)).toBeCloseTo(28.2 * PREIS_ANHEBUNG, 5);
    expect(volleHausSaison(voll, true)).toBeCloseTo(37.6 * PREIS_ANHEBUNG, 5);
  });

  it("Grundarena hat 4.000 Plaetze und Obergrenzen 15.000 / 10.000 / 1.200", () => {
    expect(GRUND_PLAETZE).toEqual({ steh: 3000, sitz: 1000, loge: 0 });
    expect(OBERGRENZE).toEqual({ steh: 15000, sitz: 10000, loge: 1200 });
    expect([maxSchritte("steh"), maxSchritte("sitz"), maxSchritte("loge")]).toEqual([12, 9, 12]);
    expect(volleHausSaison(GRUND_PLAETZE, false)).toBeCloseTo(3.0 * PREIS_ANHEBUNG, 5);
    expect(volleHausSaison(GRUND_PLAETZE, true)).toBeCloseTo(4.0 * PREIS_ANHEBUNG, 5);
  });

  it("Steh und Sitz zahlen sich bei voller Nachfrage in Liga 2 in 1,5 bis 2,5 Saisons", () => {
    expect(leiterZeile("steh", 1, false).bezahlt!).toBeGreaterThan(1.5 / PREIS_ANHEBUNG - 0.05);
    expect(leiterZeile("steh", 12, false).bezahlt!).toBeLessThan(2.5 / PREIS_ANHEBUNG);
    expect(leiterZeile("sitz", 1, false).bezahlt!).toBeGreaterThan(1.5 / PREIS_ANHEBUNG - 0.05);
    expect(leiterZeile("sitz", 9, false).bezahlt!).toBeLessThan(2.5 / PREIS_ANHEBUNG);
  });
});

describe("Arena: Nachfrage, Kasse, Dauerkarten", () => {
  const basis = { plaetze: { steh: 3000, sitz: 1000, loge: 0 }, fanbasis: 5000, stimmung: 50, liga1: false, sponsorStufe: 0.5, tabellenAnteil: 0.5 };

  it("ausverkauft deckelt die Auslastung und hebt die Tageskarten (halber Ueberhang, hoechstens +25 %)", () => {
    const r = rechneHeimspiel({ ...basis, fanbasis: 20000 });
    expect(r.auslastung.steh).toBe(1);
    expect(r.zuschlag.steh).toBeCloseTo(0.25, 5);
    expect(r.kasse.steh).toBeCloseTo(3000 * 0.00006 * PREIS_ANHEBUNG * 1.25, 5);
  });

  it("Dauerkarten-Inhaber zaehlen als anwesend, die Tageskasse sinkt um ihren Anteil", () => {
    const ohne = rechneHeimspiel(basis);
    const mit = rechneHeimspiel({ ...basis, dauer: { steh: 1200, sitz: 400, loge: 0 } });
    expect(mit.kasse.steh).toBeLessThan(ohne.kasse.steh);
    expect(mit.besucher).toBeGreaterThanOrEqual(ohne.besucher);
  });

  it("Dauerkarten: 25 % Rabatt, Anteil 20/40/60 %", () => {
    const g = dauerkartenGeld(GRUND_PLAETZE, "normal", false, 10);
    expect(g).toBeCloseTo(0.4 * 3.0 * PREIS_ANHEBUNG * 0.75, 2);
    expect(kiDauerkartenStufe(0.6, false)).toBe("viel");
    expect(kiDauerkartenStufe(0.9, false)).toBe("wenig");
    expect(kiDauerkartenStufe(0.75, true)).toBe("viel");
  });

  it("Fan-Modell: die Fanbasis haengt nicht am Stadion, ein leeres Haus senkt sie nicht", () => {
    const e = { fanbasis: 8000, anker: 8000, deltaPunkte: 2 as number | null, erwartetePunkte: 2, serie: 0 };
    const klein = fanGruendeSpieltag(e).reduce((x, g) => x + g.delta, 0);
    expect(klein).toBeCloseTo(0, 5);
    expect(fanGruendeSpieltag({ ...e, deltaPunkte: 4 }).reduce((x, g) => x + g.delta, 0)).toBeGreaterThan(0);
    expect(fanGruendeSpieltag({ ...e, deltaPunkte: 0 }).reduce((x, g) => x + g.delta, 0)).toBeLessThan(0);
    expect(fanGruendeSpieltag({ ...e, serie: 3 }).some((g) => g.id === "serie" && g.delta > 0)).toBe(true);
    expect(fanGruendeSpieltag({ ...e, serie: -4 }).some((g) => g.id === "serie" && g.delta < 0)).toBe(true);
  });

  it("Fan-Modell: Kauf eines Stars bringt Fans, Verkauf kostet sie, Schwache zaehlen kaum", () => {
    const star = sternGewicht(85, 95);
    expect(star).toBeGreaterThan(0.4);
    expect(sternFans(star, true)).toBeGreaterThan(400);
    expect(sternFans(star, false)).toBe(-sternFans(star, true));
    expect(sternGewicht(30, 50)).toBe(0);
  });

  it("Fan-Modell: Saison-Schranke -15 % bis +30 %, Anker folgt langsam, Saisonende nach Platz", () => {
    const hoch = wendeFanGruendeAn(10000, 10000, [{ id: "x", label: "x", delta: 9000 }]);
    expect(hoch.fanbasis).toBeCloseTo(13000, 3);
    expect(hoch.gekappt).toBe(true);
    expect(hoch.gruende[0]!.delta).toBeCloseTo(3000, 3);
    expect(wendeFanGruendeAn(10000, 10000, [{ id: "x", label: "x", delta: -9000 }]).fanbasis).toBeCloseTo(8500, 3);
    expect(ankerNachSaison(10000, 12000)).toBeCloseTo(10800, 3);
    const meister = fanGruendeSaisonende({ fanbasis: 10000, rangAnteil: 1, erwartungAnteil: 0.8, titel: true, aufgestiegen: false, abgestiegen: false });
    const letzter = fanGruendeSaisonende({ fanbasis: 10000, rangAnteil: 0, erwartungAnteil: 0.2, titel: false, aufgestiegen: false, abgestiegen: true });
    expect(meister.reduce((x, g) => x + g.delta, 0)).toBeGreaterThan(1500);
    expect(letzter.reduce((x, g) => x + g.delta, 0)).toBeLessThan(-1500);
  });

  it("Start-Stadion: 4.000 bis 7.000 Plaetze, das Budget allein macht es nicht gross", () => {
    expect(startStadionSchritte(0, false, 0)).toBe(0);
    expect(startStadionSchritte(1, true, 1)).toBe(3);
    expect(startStadionSchritte(0, false, 1)).toBe(0);
    expect(startStadionSchritte(0.2, true, 1)).toBeLessThan(startStadionSchritte(0.9, true, 0.2) + 1);
    const p = startStadionPlaetze(GRUND_PLAETZE, 3);
    expect(p.steh + p.sitz + p.loge).toBe(7000);
    expect(startStadionPlaetze(GRUND_PLAETZE, 0)).toEqual(GRUND_PLAETZE);
  });

  it("Fan-Prognose der KI: Trend der Saison hochgerechnet, gedaempft und begrenzt", () => {
    expect(fanPrognoseFaktor({ fanbasis: 11000, saisonStart: 10000, spieltage: 10, trendVorsaison: 0 })).toBeCloseTo(1 + 0.7 * 0.2, 5);
    expect(fanPrognoseFaktor({ fanbasis: 10000, saisonStart: 10000, spieltage: 2, trendVorsaison: 0.1 })).toBeCloseTo(1.07, 5);
    expect(fanPrognoseFaktor({ fanbasis: 5000, saisonStart: 10000, spieltage: 10, trendVorsaison: 0 })).toBeCloseTo(0.85, 5);
  });

  it("Stimmung: Sieg hebt, Niederlage senkt, Heimspiel x 1,5, Rueckzug zur Mitte", () => {
    expect(stimmungNachSpieltag(50, 4, false, 1)).toBeGreaterThan(50);
    expect(stimmungNachSpieltag(50, 0, false, -1)).toBeLessThan(50);
    expect(stimmungNachSpieltag(50, 4, true, 1)).toBeGreaterThan(stimmungNachSpieltag(50, 4, false, 1));
    expect(stimmungNachSpieltag(90, 2, false, 0)).toBeLessThan(90);
  });

  it("Ereignisse: Derby, Finale und Produkt bleiben zwischen 0,5 und 2,0", () => {
    const z = ereignisseFuerHeimspiel({ seasonId: "s", saat: "x", index: 18, spieltage: 20, heimTage: [2, 6, 10, 14, 18], gegnerId: "G", derbyIntensitaet: 5, eigenRang: 2, gegnerRang: 1, ligaGroesse: 16, serie: 4 });
    const ids = z.map((e) => e.id);
    expect(ids).toContain("derby");
    expect(ids).toContain("fuehrer");
    expect(ids).toContain("finale");
    const p = ereignisProdukt(z);
    expect(p.steh).toBeLessThanOrEqual(2);
    expect(p.steh).toBeGreaterThanOrEqual(0.5);
  });

  it("Ausbau-Vorschau: ein nicht ausverkaufter Bereich bringt erwartet nichts ausser Unterhalt, ausverkauft zahlt sich aus", () => {
    const leer = ausbauVorschau({ plaetze: GRUND_PLAETZE, schritte: { steh: 2 }, fanbasis: 2000, stimmung: 50, liga1: false, sponsorStufe: 0.5, tabellenAnteil: 0.5 });
    expect(leer.nettoErwartet).toBeLessThan(0);
    expect(leer.bezahltErwartet).toBeNull();
    expect(leer.zeilen[0]!.nichtVoll).toBe(true);
    const voll = ausbauVorschau({ plaetze: GRUND_PLAETZE, schritte: { steh: 2 }, fanbasis: 6000, stimmung: 80, liga1: false, sponsorStufe: 0.5, tabellenAnteil: 0.5 });
    expect(voll.nettoErwartet).toBeGreaterThan(0);
    expect(voll.bezahltErwartet).not.toBeNull();
    // Mehr Nachfrage als Plaetze fuellt nur einen Teil der zwei Schritte: erwartet zahlt es sich langsamer als bei vollem Haus.
    expect(voll.bezahltErwartet!).toBeGreaterThan(voll.bezahltVoll!);
    expect(voll.kosten).toBeCloseTo(1.8, 5);
  });
});

describe("Arena: Regel-Stempel", () => {
  it("neues Spiel: an; Rueckweg-Schalter wirkt nur auf neue Saisons; Lade-Migration: aus", () => {
    const gs = neuesSpiel();
    expect(arenaAktiv(gs)).toBe(true);
    expect(medaillenAktiv(gs)).toBe(true);
    process.env.OLY_ARENA = "aus";
    expect(arenaAktiv(gs)).toBe(true);
    delete process.env.OLY_ARENA;
    const alt = stempleMedaillenNachLaden(stempleArenaNachLaden(stempleFinanzenJeSpieltagBeimAnlegen(createFreshSeasonOneGameState())));
    expect(arenaAktiv(alt)).toBe(false);
    expect(medaillenAktiv(alt)).toBe(false);
    expect(rangPraemieFaktor(alt)).toBe(1);
  });

  it("Notbremse aus-sofort schaltet die Wirkung ab", () => {
    const gs = neuesSpiel();
    process.env.OLY_ARENA = "aus-sofort";
    expect(arenaAktiv(gs)).toBe(false);
  });

  it("Abbildung des alten Gebaeudes: Stufe 0 = Grundarena, Stufe 5 = Obergrenze", () => {
    expect(arenaAusAltemGebaeude(0)).toEqual(GRUND_PLAETZE);
    expect(arenaAusAltemGebaeude(5)).toEqual(OBERGRENZE);
    expect(arenaAusAltemGebaeude(3).steh).toBeGreaterThan(arenaAusAltemGebaeude(2).steh);
  });

  it("Rangpraemie sinkt um den Topf-Abzug", () => {
    const gs = neuesSpiel();
    expect(rangPraemieFaktor(gs)).toBeCloseTo(0.916, 3);
    const team = gs.teams[0]!.teamId;
    // Ohne Sponsorvertrag ist die Praemie 0; die Funktion bleibt stabil.
    expect(sponsorRangAbschlag(gs, team, 1, 20).abschlag).toBe(0);
  });
});

describe("Arena: Ausbau und Dauerkarten ueber den Server-Weg", () => {
  it("baut aus der Kasse, schreibt das Gebaeude-Ereignis (Investitionstopf) und haelt Obergrenzen ein", () => {
    const gs0 = neuesSpiel();
    const teamId = gs0.teams[0]!.teamId;
    const gs = { ...gs0, teams: gs0.teams.map((t) => (t.teamId === teamId ? { ...t, cash: 500 } : t)) };
    const r = bauArenaAus(gs, teamId, { steh: 2, sitz: 1 });
    expect(r.ok).toBe(true);
    expect(r.kosten).toBeCloseTo(0.9 * 2 + 2.0, 5);
    const stand = holeArenaStand(r.gameState, teamId);
    expect(stand.plaetze).toEqual({ steh: 5000, sitz: 2000, loge: 0 });
    expect(r.gameState.seasonState.facilityEvents?.[0]?.cost).toBeCloseTo(r.kosten, 5);
    expect(r.gameState.teams.find((t) => t.teamId === teamId)!.cash).toBeCloseTo(500 - r.kosten, 1);
    const zuViel = bauArenaAus(r.gameState, teamId, { steh: 11 });
    expect(zuViel.ok).toBe(false);
    expect(zuViel.reason).toBe("obergrenze");
  });

  it("lehnt ab, wenn die Kasse nicht reicht, und ohne Regel", () => {
    const gs0 = neuesSpiel();
    const teamId = gs0.teams[0]!.teamId;
    const arm = { ...gs0, teams: gs0.teams.map((t) => (t.teamId === teamId ? { ...t, cash: 0.5 } : t)) };
    expect(bauArenaAus(arm, teamId, { steh: 1 }).reason).toBe("kasse");
    const alt = stempleArenaNachLaden(stempleFinanzenJeSpieltagBeimAnlegen(createFreshSeasonOneGameState()));
    expect(bauArenaAus(alt, teamId, { steh: 1 }).reason).toBe("arena_regel_aus");
    expect(bauArenaAus(gs0, teamId, {}).reason).toBe("nichts_zu_bauen");
  });

  it("Dauerkarten: Wahl schreibt Geld sofort, eine neue Wahl bucht nur die Differenz", () => {
    const gs = neuesSpiel();
    const teamId = gs.teams[0]!.teamId;
    const kasse0 = gs.teams[0]!.cash;
    const a = setzeDauerkarten(gs, teamId, "viel");
    const geldViel = holeArenaStand(a, teamId).dauerkarten!.geld;
    expect(Math.abs(a.teams[0]!.cash - (kasse0 + geldViel))).toBeLessThan(0.06);
    const b = setzeDauerkarten(a, teamId, "wenig");
    expect(Math.abs(b.teams[0]!.cash - (kasse0 + holeArenaStand(b, teamId).dauerkarten!.geld))).toBeLessThan(0.1);
  });
});

describe("Arena: Buchung je Spieltag = Kontoauszug", () => {
  it("Heimspiel bucht Tickets, die Summe der Buchungen bleibt die Kasse, doppelt bucht nichts", () => {
    const gs0 = neuesSpiel();
    const matchdayId = gs0.season.matchdayIds[0]!;
    const gebucht = bucheSpieltagFinanzen(gs0, matchdayId);
    const heimTeams = new Set(gs0.seasonState.schedule.filter((f) => f.matchdayId === matchdayId).map((f) => f.homeTeamId));
    let summeTickets = 0;
    for (const t of gs0.teams) {
      const s = summeSpieltagBuchungen(gebucht, t.teamId);
      if (heimTeams.has(t.teamId)) summeTickets += s.tickets;
      else expect(s.tickets).toBe(0);
      const kasseNachher = gebucht.teams.find((x) => x.teamId === t.teamId)!.cash;
      expect(kasseNachher).toBeCloseTo(t.cash + s.cashDelta, 1);
    }
    // Das Grundhaus bringt je Heimspiel hoechstens 0,4 C; ohne Teams im Heimrecht gaebe es keine Tickets.
    if (heimTeams.size > 0) expect(summeTickets).toBeGreaterThan(0);
    const nochmal = bucheSpieltagFinanzen(gebucht, matchdayId);
    expect(nochmal).toBe(gebucht);
    const team = [...heimTeams][0];
    if (team) {
      const zeilen = buildKontoauszuege(gebucht).get(team)!.zeilen;
      expect(zeilen.some((z) => z.art === "dauerkarten" || z.art === "tickets_spieltag")).toBe(true);
    }
  });

  it("Auswaerts: kein Heimspiel, die Stimmung wird trotzdem fortgeschrieben", () => {
    const gs0 = neuesSpiel();
    const matchdayId = gs0.season.matchdayIds[0]!;
    const gebucht = bucheSpieltagFinanzen(gs0, matchdayId);
    const gast = gs0.seasonState.schedule.find((f) => f.matchdayId === matchdayId)?.awayTeamId;
    if (gast) expect(gebucht.seasonState.arena?.[gast]?.stand).toBe(1);
  });
});

describe("Medaillen: Gleichstand teilt", () => {
  const zeile = (teamId: string, wert: number, vh = 0, pp = 0): MedaillenTabellenZeile => ({ teamId, name: teamId, wert, vh, pp });
  it("ohne Gleichstand: Gold, Silber, Bronze mit vollem Geld", () => {
    const p = medaillenPlaetze([zeile("a", 9), zeile("b", 8), zeile("c", 7), zeile("d", 6)], [0.3, 0.2, 0.1]);
    expect(p.map((x) => [x.teamId, x.platz, x.praemie])).toEqual([["a", 1, 0.3], ["b", 2, 0.2], ["c", 3, 0.1]]);
  });
  it("Gleichauf in Summe, Verhaeltnis und PP teilt die Medaille und halbiert das Geld", () => {
    const p = medaillenPlaetze([zeile("a", 9, 1, 2), zeile("b", 9, 1, 2), zeile("c", 7)], [0.5, 0.3, 0.2]);
    expect(p.filter((x) => x.platz === 1)).toHaveLength(2);
    expect(p.find((x) => x.teamId === "a")!.praemie).toBeCloseTo((0.5 + 0.3) / 2, 5);
    expect(p.find((x) => x.teamId === "c")!.platz).toBe(3);
  });
  it("PP-Summe entscheidet vor dem Teilen", () => {
    const p = medaillenPlaetze([zeile("a", 9, 1, 3), zeile("b", 9, 1, 2)], [0.5, 0.3, 0.2]);
    expect(p.map((x) => x.platz)).toEqual([1, 2]);
  });
});
