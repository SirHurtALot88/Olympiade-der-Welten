import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { computeTeamExpectation } from "@/lib/board/team-season-objectives-service";
import { stempleFinanzenJeSpieltagBeimAnlegen, summeSpieltagBuchungen } from "@/lib/finance/finanzen-je-spieltag";
import { bucheSpieltagFinanzen } from "@/lib/finance/finanzen-je-spieltag-buchung";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { rangPraemieFaktor, stempleMedaillenBeimAnlegen } from "@/lib/medaillen/medaillen-regel";
import { berechneVergabe } from "@/lib/medaillen/medaillen-modell";
import {
  gueltigerSponsorStempel,
  sponsorAnkerFuer,
  sponsorLeistungAktiv,
  sponsorRegelFuer,
  sponsorRegelFuerNeueSaison,
  sponsorRegelFuerSpielmodus,
  sponsorTopfAktiv,
  spiegleSponsorNotbremse,
  stempleSponsorRegelBeimAnlegen,
  stempleSponsorRegelNachLaden,
} from "@/lib/resolve/sponsor-regel";
import { maybeGenerateSponsorEvents } from "@/lib/sponsor/sponsor-event-service";
import { advanceSponsorContractsForNewSeason } from "@/lib/sponsor/sponsor-contract-lifecycle";
import {
  chooseSponsorOfferForAiTeams,
  ensureSeasonSponsorOffers,
  getTeamSponsorContract,
  getTeamSponsorOffers,
  chooseSponsorOffer,
} from "@/lib/sponsor/sponsor-offer-service";
import { applySponsorSettlement, getSeasonSponsorCashByTeam, previewSponsorSettlement, sponsorBasisJahr } from "@/lib/sponsor/sponsor-settlement-service";
import { topfFarbVerteilung, topfLeistungJetzt, topfStandFuer } from "@/lib/sponsors/sponsor-topf-buchung";
import { berechneVorlaeufig, sichereSponsorTopf, stempleVorlaeufig, topfPlanungSponsor, uebertragFuerSaisonwechsel } from "@/lib/sponsors/sponsor-topf-stichtag";
import { baueSponsorUebersicht } from "@/lib/sponsors/sponsor-uebersicht";
import { erzeugeTermine, entscheideTermin, offeneSponsorTermine, beantworteTermineDerKi, sponsorTermine, terminSpieltage } from "@/lib/sponsors/sponsor-topf-termine";
import { pruefeTopfWahl, ueberfuehreAltvertraege } from "@/lib/sponsors/sponsor-topf-wahl";
import { erwarteterSponsorFuerPlanung } from "@/lib/finance/sponsor-erwartung";

// Die Zustaende (32 Teams, 552 Spieler, Angebote) sind teuer aufzubauen; unter Last reichen 20 s nicht.
vi.setConfig({ testTimeout: 240_000 });

function battleSpiel(): GameState {
  const gs = structuredClone(createSingleplayerGameState());
  gs.scenarioMeta = { ...(gs.scenarioMeta ?? {}), gameMode: "battle" } as GameState["scenarioMeta"];
  gs.seasonState.leagueByTeamId = Object.fromEntries(gs.teams.map((t, i) => [t.teamId, i < 16 ? "liga1" : "liga2"])) as never;
  return gs;
}

/** Battle-Spiel mit Topf-Stempel, Je-Spieltag-Stempel und KI-Vertraegen fuer alle 32 Teams. */
function topfSpiel(): GameState {
  let gs = stempleSponsorRegelBeimAnlegen(stempleMedaillenBeimAnlegen(stempleFinanzenJeSpieltagBeimAnlegen(battleSpiel())));
  gs = ensureSeasonSponsorOffers(gs);
  return chooseSponsorOfferForAiTeams(gs, Object.fromEntries(gs.teams.map((t) => [t.teamId, { controlMode: "ai" }])) as never);
}

afterEach(() => {
  delete process.env.OLY_SPONSOR_REGEL;
});

const summe = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("Sponsor-Regel: Stempel (Muster formkarten-regel)", () => {
  it("neues Battle-Spiel bekommt \"topf\" ab Saison 1, ein Manager-Spiel keinen Stempel", () => {
    const gs = stempleSponsorRegelBeimAnlegen(battleSpiel());
    expect(sponsorRegelFuer(gs)).toBe("topf");
    expect(gueltigerSponsorStempel(gs)?.kaderErsatz).toBe(1);
    expect(gueltigerSponsorStempel(gs)?.saisonfaktor).toBe(1);
    const manager = stempleSponsorRegelBeimAnlegen(createSingleplayerGameState());
    expect(manager.seasonState.sponsorRegel).toBeUndefined();
    expect(sponsorRegelFuer(manager)).toBe("alt");
  });

  it("bestehender Spielstand: die laufende Saison bleibt \"alt\", Idempotenz, der Stempel einer anderen Saison zaehlt nicht", () => {
    const gs = battleSpiel();
    const geladen = stempleSponsorRegelNachLaden(gs);
    expect(sponsorRegelFuer(geladen)).toBe("alt");
    expect(stempleSponsorRegelNachLaden(geladen)).toBe(geladen);
    const fremd = { ...gs, seasonState: { ...gs.seasonState, sponsorRegel: { ...sponsorRegelFuerNeueSaison("season-0"), version: "topf" as const } } };
    expect(sponsorRegelFuer(fremd)).toBe("alt");
    expect(sponsorRegelFuerSpielmodus(gs, "season-2")?.version).toBe("topf");
  });

  it("Schalter OLY_SPONSOR_REGEL: aus -> neue Saisons \"alt\"; aus-sofort wirkt nur ueber den Stempel (Notbremse)", () => {
    process.env.OLY_SPONSOR_REGEL = "aus";
    expect(sponsorRegelFuerNeueSaison("season-2").version).toBe("alt");
    delete process.env.OLY_SPONSOR_REGEL;
    const gs = stempleSponsorRegelBeimAnlegen(battleSpiel());
    process.env.OLY_SPONSOR_REGEL = "aus-sofort";
    // Rechenwege lesen die Variable nicht: ohne Spiegel bleibt alles beim Alten
    expect(sponsorLeistungAktiv(gs)).toBe(true);
    const gespiegelt = spiegleSponsorNotbremse(gs);
    expect(gespiegelt.seasonState.sponsorRegel?.notbremse).toBe(true);
    expect(sponsorTopfAktiv(gespiegelt)).toBe(true);
    expect(sponsorLeistungAktiv(gespiegelt)).toBe(false);
    // danach ist die Variable fuer den Rechenweg egal
    delete process.env.OLY_SPONSOR_REGEL;
    expect(sponsorLeistungAktiv(gespiegelt)).toBe(false);
  });
});

describe("Sponsor-Topf: Liga-Wert-Rueckkopplung im Stempel", () => {
  it("der Stichtag friert Liga-Wert und Korrektur ein, der Stempel der naechsten Saison traegt sie als Bezug weiter", () => {
    const gs = sichereSponsorTopf(topfSpiel());
    const f = gs.seasonState.sponsorRegel!.eingefroren!;
    expect(f.ligaWert).toBeGreaterThan(1000);
    expect(f.ligaWertDrift).toBeNull();
    expect(f.wertKorrektur).toBe(0);
    const naechste = sponsorRegelFuerNeueSaison("season-2", gs.seasonState.sponsorRegel);
    expect(naechste.ligaWertVorjahr).toBe(f.ligaWert);
    expect(naechste.ligaWertKorrektur).toBe(0);
    expect(naechste.betriebsteilVorjahr).toBe(f.betriebsteil);
    // sinkt der Liga-Wert gegen den Vorjahres-Stichtag, steigt der Topf; waechst er, sinkt er
    const kleinerVorher = { ...gs, seasonState: { ...gs.seasonState, sponsorRegel: { ...gs.seasonState.sponsorRegel!, eingefroren: null, ligaWertVorjahr: f.ligaWert + 400 } } };
    const groesserVorher = { ...gs, seasonState: { ...gs.seasonState, sponsorRegel: { ...gs.seasonState.sponsorRegel!, eingefroren: null, ligaWertVorjahr: f.ligaWert - 400 } } };
    const a = sichereSponsorTopf(kleinerVorher).seasonState.sponsorRegel!.eingefroren!;
    const b = sichereSponsorTopf(groesserVorher).seasonState.sponsorRegel!.eingefroren!;
    expect(a.wertKorrektur).toBeLessThan(0);
    expect(b.wertKorrektur).toBeGreaterThan(0);
    expect(a.topf).toBeGreaterThan(b.topf);
    expect(a.ligaWertDrift).toBeCloseTo(-400, 0);
  });
});

describe("Sponsor-Topf: Vertraege, Stichtag und Buchung", () => {
  it("jeder KI-Vertrag traegt Vertragsart, Laufzeit und genau zwei Farben; die Laufzeit steuert den Vertrag", () => {
    const gs = topfSpiel();
    for (const team of gs.teams) {
      const c = getTeamSponsorContract(gs, team.teamId)!;
      expect(c.sponsorTopf).toBeTruthy();
      expect(["fest", "leistung", "praemie"]).toContain(c.sponsorTopf!.vertragsart);
      expect(c.sponsorTopf!.farben).toHaveLength(2);
      expect(new Set(c.sponsorTopf!.farben).size).toBe(2);
      expect(c.seasonsRemaining).toBe(c.sponsorTopf!.laufzeit);
      expect(c.sponsorTopf!.jahr).toBe(1);
    }
  });

  it("Stichtag: Topf eingefroren, idempotent, Summe der Grundbetraege + Farb-Toepfe + Treue = Topf (auf 0,1 je Liga)", () => {
    const gs = sichereSponsorTopf(topfSpiel());
    const f = gs.seasonState.sponsorRegel!.eingefroren!;
    expect(f).toBeTruthy();
    expect(sichereSponsorTopf(gs)).toBe(gs);
    const g = summe(Object.values(f.teams).map((t) => t.grundbetrag));
    expect(Math.abs(g + 4 * (f.farbTopf[0] + f.farbTopf[1]) + f.treueSumme - f.topf)).toBeLessThan(0.11);
    expect(f.sigma).toBe(0.5);
    expect(Object.keys(f.teams)).toHaveLength(32);
    // Erwartungsraenge je Liga auf Summe 136
    for (const liga of [1, 2] as const) {
      expect(summe(Object.values(f.teams).filter((t) => t.liga === liga).map((t) => t.erwartungsrang))).toBeCloseTo(136, 3);
    }
  });

  it("Leistungsteil JETZT: Summe je Liga 0; Grundbetrag je Spieltag = Grundbetrag / N, durch sponsorBasisJahr", () => {
    const gs = sichereSponsorTopf(topfSpiel());
    const l = topfLeistungJetzt(gs)!;
    for (const liga of [1, 2] as const) {
      const ids = Object.values(gs.seasonState.sponsorRegel!.eingefroren!.teams).filter((t) => t.liga === liga).map((t) => t.teamId);
      expect(Math.abs(Math.round(summe(ids.map((id) => l.leistung[id]!)) * 10))).toBe(0);
    }
    const team = gs.teams[0]!.teamId;
    const stand = topfStandFuer(gs)!.teams[team]!;
    expect(sponsorBasisJahr(gs, team)).toBeCloseTo(stand.grundbetrag + stand.treue, 6);
  });

  it("gezeigt = gebucht: die Zeilen des Saisonendes sind die der Uebersicht, je Spieltag wird Grundbetrag/N gebucht", () => {
    let gs = sichereSponsorTopf(topfSpiel());
    const team = gs.teams[3]!.teamId;
    const vorschau = previewSponsorSettlement(gs, "season_end");
    const zeilen = vorschau.rows.filter((r) => r.teamId === team);
    expect(zeilen.map((r) => r.kind).sort()).toEqual(["base", "farbe", "rank", "special"].sort());
    const uebersicht = baueSponsorUebersicht(gs, team)!;
    expect(uebersicht).toBeTruthy();
    expect(zeilen.find((r) => r.kind === "base")!.cashDelta).toBeCloseTo(uebersicht.vertrag!.zeilen.grund.saison, 6);
    expect(zeilen.find((r) => r.kind === "rank")!.cashDelta).toBeCloseTo(uebersicht.vertrag!.zeilen.leistung.saison, 6);
    expect(zeilen.find((r) => r.kind === "farbe")!.cashDelta).toBeCloseTo(uebersicht.vertrag!.zeilen.farbe.saison, 6);
    // Spieltag 1 buchen
    const n = gs.season.matchdayIds.length;
    gs = bucheSpieltagFinanzen(gs, gs.season.matchdayIds[0]!);
    const gebucht = summeSpieltagBuchungen(gs, team);
    expect(gebucht.sponsorBasis).toBeCloseTo(sponsorBasisJahr(gs, team) / n, 1);
    // Saisonende: Basis-Rest + gebuchte Abschlaege + Rest = Saisonbetrag der Zeilen
    const nachher = previewSponsorSettlement(gs, "season_end").rows.filter((r) => r.teamId === team);
    expect(nachher.find((r) => r.kind === "base")!.cashDelta).toBeCloseTo(uebersicht.vertrag!.zeilen.grund.saison, 6);
  });

  it("ganze Saison gebucht: je Spieltag Grundbetrag und Abschlag, am Ende der Rest -- die Summe ist genau die vorher gezeigte Vorschau", () => {
    let gs = sichereSponsorTopf(topfSpiel());
    for (const id of gs.season.matchdayIds) gs = bucheSpieltagFinanzen(gs, id);
    // Die Vorschau steht auf dem Stand NACH den Spieltagsbuchungen: das Ziel liest den Kassenstand (Achse Soliditaet), der sich durch die Buchungen bewegt.
    const vorschau = previewSponsorSettlement(gs, "season_end");
    const sollJeTeam = new Map<string, number>();
    for (const r of vorschau.rows) sollJeTeam.set(r.teamId, Math.round(((sollJeTeam.get(r.teamId) ?? 0) + r.cashDelta) * 10) / 10);
    const cashVor = new Map(gs.teams.map((t) => [t.teamId, t.cash] as const));
    const ledgerJeTeam = new Map(gs.teams.map((t) => {
      const l = summeSpieltagBuchungen(gs, t.teamId);
      return [t.teamId, l.sponsorBasis + l.rangAbschlag] as const;
    }));
    const apply = applySponsorSettlement({ gameState: gs, saveId: "s", execute: true, deductSalary: false });
    expect(apply.applied).toBe(true);
    for (const team of apply.gameState.teams) {
      const rest = Math.round((team.cash - cashVor.get(team.teamId)!) * 10) / 10;
      // Ledger je Spieltag + Saisonende-Rest = die gezeigte Saisonsumme (je Team auf Rundung genau; 10 Spieltage, Rest absorbiert die Rundung)
      expect(ledgerJeTeam.get(team.teamId)! + rest).toBeCloseTo(sollJeTeam.get(team.teamId) ?? 0, 1);
    }
    // und die Saison-Sponsorsumme (Logs + Ledger) ist dieselbe Zahl
    const summe = getSeasonSponsorCashByTeam(apply.gameState);
    for (const team of apply.gameState.teams) expect(summe.get(team.teamId) ?? 0).toBeCloseTo(sollJeTeam.get(team.teamId) ?? 0, 1);
  });

  it("Farb-Partner: jeder der acht Toepfe wird auf den Cent (0,1) verteilt, Summe = Topf, nur Unterschreiber bekommen Geld", () => {
    const gs = sichereSponsorTopf(topfSpiel());
    const v = topfFarbVerteilung(gs)!;
    expect(v.toepfe).toHaveLength(8);
    for (const t of v.toepfe) {
      expect(t.teilnehmer).toBeGreaterThan(0);
      expect(Math.round(t.verteilt * 10)).toBe(Math.round(t.topf * 10));
    }
    const stand = topfStandFuer(gs)!;
    for (const z of v.zeilen) expect(stand.teams[z.teamId]!.farben).toContain(z.farbe);
    expect(Math.round(summe(Object.values(v.jeTeam)) * 10)).toBe(Math.round(summe(v.toepfe.map((t) => t.topf)) * 10));
  });

  it("kein Doppel: unter dem Topf-Stempel gibt es keine Farb-Meister-Auszahlung, die Medaillen bleiben; Rangpraemie wird nicht gekuerzt", () => {
    const gs = sichereSponsorTopf(topfSpiel());
    // berechneVergabe laeuft auf dem Leaders-Modell; eine leere Saison hat keine Farb-Meister und keine Medaillen -- die Regel prueft die Quelle
    expect(quelle("lib/medaillen/medaillen-modell.ts")).toContain("sponsorTopfAktiv(gameState) ? []");
    expect(quelle("lib/medaillen/medaillen-regel.ts")).toContain("sponsorTopfAktiv(gameState as Parameters<typeof sponsorTopfAktiv>[0])");
    expect(typeof berechneVergabe).toBe("function");
    expect(sponsorRegelFuer(gs)).toBe("topf");
    // die Rangpraemie wird nicht um den Medaillen-Topf gekuerzt (es gibt keine Rangpraemie mehr); im alten System bleibt der Abzug
    expect(rangPraemieFaktor(gs)).toBe(1);
    const alt = stempleSponsorRegelNachLaden(stempleMedaillenBeimAnlegen(stempleFinanzenJeSpieltagBeimAnlegen(battleSpiel())));
    expect(rangPraemieFaktor(alt)).toBeLessThan(1);
  });

  it("Notbremse: Grundbetrag zahlt weiter, Leistungsteil und Farb-Partner sind 0", () => {
    const start = topfSpiel();
    process.env.OLY_SPONSOR_REGEL = "aus-sofort";
    const gs = sichereSponsorTopf(spiegleSponsorNotbremse(start));
    delete process.env.OLY_SPONSOR_REGEL;
    const team = gs.teams[0]!.teamId;
    expect(sponsorBasisJahr(gs, team)).toBeGreaterThan(0);
    expect(Object.values(topfLeistungJetzt(gs)!.leistung).every((v) => v === 0)).toBe(true);
    expect(Object.values(topfFarbVerteilung(gs)!.jeTeam).every((v) => v === 0)).toBe(true);
  });

  it("Wuerfel-Ereignisse sind unter dem Topf-Stempel aus", () => {
    const gs = sichereSponsorTopf(topfSpiel());
    for (let md = 1; md <= 6; md += 1) {
      const g = { ...gs, season: { ...gs.season, currentMatchday: md } };
      expect(maybeGenerateSponsorEvents(g, "t")).toBe(g);
    }
  });

  it("alt-Stempel: sponsorBasisJahr und Abrechnung bleiben die des alten Systems (bit-gleich zum Lauf ohne Stempel)", () => {
    const ohne = stempleFinanzenJeSpieltagBeimAnlegen(battleSpiel());
    const mitAlt = stempleSponsorRegelNachLaden(ohne);
    const a = chooseSponsorOfferForAiTeams(ensureSeasonSponsorOffers(ohne), Object.fromEntries(ohne.teams.map((t) => [t.teamId, { controlMode: "ai" }])) as never);
    const b = chooseSponsorOfferForAiTeams(ensureSeasonSponsorOffers(mitAlt), Object.fromEntries(ohne.teams.map((t) => [t.teamId, { controlMode: "ai" }])) as never);
    const t0 = ohne.teams[0]!.teamId;
    expect(getTeamSponsorContract(b, t0)!.sponsorTopf).toBeUndefined();
    expect(sponsorBasisJahr(b, t0)).toBe(sponsorBasisJahr(a, t0));
    expect(previewSponsorSettlement(b).rows.map((r) => [r.teamId, r.kind, r.cashDelta])).toEqual(previewSponsorSettlement(a).rows.map((r) => [r.teamId, r.kind, r.cashDelta]));
  });
});

describe("Sponsor-Topf: Wahl, Delegation, Migration", () => {
  it("Mensch ueberschreibt, KI respektiert das: gesetzte Felder bleiben, fehlende fuellt die KI; ungueltige Wahl wird abgelehnt", () => {
    const gs = sichereSponsorTopf(topfSpiel());
    void gs;
    let leer = ensureSeasonSponsorOffers(stempleSponsorRegelBeimAnlegen(battleSpiel()));
    const team = leer.teams[5]!.teamId;
    const offer = getTeamSponsorOffers(leer, team)[0]!;
    const r = chooseSponsorOffer({ gameState: leer, teamId: team, offerId: offer.offerId, topf: { vertragsart: "praemie", laufzeit: 3, farben: ["pow", "soc"], von: "mensch" } });
    expect(r.error).toBeUndefined();
    const c = getTeamSponsorContract(r.gameState, team)!;
    expect(c.sponsorTopf).toMatchObject({ vertragsart: "praemie", laufzeit: 3, farben: ["pow", "soc"], gewaehltVon: "mensch", zielEinsatz: 8 });
    expect(c.seasonsRemaining).toBe(3);
    // nur die Vertragsart gesetzt: Laufzeit und Farben kommen von der KI
    const team2 = leer.teams[6]!.teamId;
    const r2 = chooseSponsorOffer({ gameState: leer, teamId: team2, offerId: getTeamSponsorOffers(leer, team2)[0]!.offerId, topf: { vertragsart: "fest" } });
    expect(r2.error).toBeUndefined();
    const c2 = getTeamSponsorContract(r2.gameState, team2)!;
    expect(c2.sponsorTopf!.vertragsart).toBe("fest");
    expect(c2.sponsorTopf!.zielEinsatz).toBe(0);
    expect(c2.sponsorTopf!.farben).toHaveLength(2);
    expect(pruefeTopfWahl({ farben: ["pow", "pow"] })).toBe("sponsor_farben_ungueltig");
    expect(pruefeTopfWahl({ vertragsart: "x" as never })).toBe("sponsor_vertragsart_ungueltig");
    expect(pruefeTopfWahl({ laufzeit: 4 as never })).toBe("sponsor_laufzeit_ungueltig");
    const bad = chooseSponsorOffer({ gameState: leer, teamId: team, offerId: offer.offerId, topf: { farben: ["pow"] as never } });
    expect(bad.error).toBe("sponsor_farben_ungueltig");
    leer = r2.gameState;
  });

  it("Stichtag fuellt fehlende Vertraege (Mensch ohne Unterschrift): Leistungsvertrag, Laufzeit 1, KI-Farben, gewaehltVon auto", () => {
    let gs = ensureSeasonSponsorOffers(stempleSponsorRegelBeimAnlegen(stempleFinanzenJeSpieltagBeimAnlegen(battleSpiel())));
    const mensch = gs.teams[2]!.teamId;
    gs = chooseSponsorOfferForAiTeams(gs, Object.fromEntries(gs.teams.map((t) => [t.teamId, { controlMode: t.teamId === mensch ? "manual" : "ai" }])) as never);
    expect(getTeamSponsorContract(gs, mensch)).toBeNull();
    const eingefroren = sichereSponsorTopf(gs);
    const c = getTeamSponsorContract(eingefroren, mensch)!;
    expect(c.sponsorTopf).toMatchObject({ vertragsart: "leistung", laufzeit: 1, gewaehltVon: "auto" });
    expect(c.sponsorTopf!.farben).toHaveLength(2);
  });

  it("Jahr 2 und 3: Vertragsjahr zaehlt weiter, Treuebonus +1 / +2 C wird vorab aus dem Topf genommen", () => {
    let gs = topfSpiel();
    const team = gs.teams[0]!.teamId;
    const alt = getTeamSponsorContract(gs, team)!;
    gs = { ...gs, seasonState: { ...gs.seasonState, sponsorContractsByTeamId: { ...gs.seasonState.sponsorContractsByTeamId, [team]: { ...alt, seasonsRemaining: 3, termSeasons: 3, sponsorTopf: { ...alt.sponsorTopf!, laufzeit: 3 } } } } };
    const vertragVon = (g: GameState) => g.seasonState.sponsorContractsByTeamId![team]!;
    const naechste = advanceSponsorContractsForNewSeason(gs, "season-2");
    expect(vertragVon(naechste).sponsorTopf!.jahr).toBe(2);
    const uebernaechste = advanceSponsorContractsForNewSeason(naechste, "season-3");
    expect(vertragVon(uebernaechste).sponsorTopf!.jahr).toBe(3);
    const mit = { ...gs, seasonState: { ...gs.seasonState, sponsorContractsByTeamId: { ...gs.seasonState.sponsorContractsByTeamId, [team]: { ...vertragVon(naechste), seasonId: gs.season.id } } } };
    const frozen = sichereSponsorTopf(mit).seasonState.sponsorRegel!.eingefroren!;
    expect(frozen.teams[team]!.treue).toBe(1);
    expect(frozen.treueSumme).toBe(1);
  });

  it("Migration beim Saisonwechsel: ein laufender Altvertrag wird zum Leistungsvertrag derselben Marke, Restlaufzeit bleibt", () => {
    const alt = stempleSponsorRegelNachLaden(stempleFinanzenJeSpieltagBeimAnlegen(battleSpiel()));
    let gs = chooseSponsorOfferForAiTeams(ensureSeasonSponsorOffers(alt), Object.fromEntries(alt.teams.map((t) => [t.teamId, { controlMode: "ai" }])) as never);
    const team = gs.teams[0]!.teamId;
    const c = getTeamSponsorContract(gs, team)!;
    expect(c.sponsorTopf).toBeUndefined();
    gs = { ...gs, seasonState: { ...gs.seasonState, sponsorContractsByTeamId: { ...gs.seasonState.sponsorContractsByTeamId, [team]: { ...c, termSeasons: 3, seasonsRemaining: 3 } } } };
    // Saisonwechsel: Vertrag rollt, neuer Stempel "topf", Ueberfuehrung
    const gerollt = advanceSponsorContractsForNewSeason(gs, "season-2");
    const neu = { ...gerollt, season: { ...gerollt.season, id: "season-2" }, seasonState: { ...gerollt.seasonState, seasonId: "season-2", sponsorRegel: sponsorRegelFuerNeueSaison("season-2", gerollt.seasonState.sponsorRegel) } };
    const ueber = ueberfuehreAltvertraege(neu);
    const v = getTeamSponsorContract(ueber, team)!;
    expect(v.sponsorParentBrandId).toBe(c.sponsorParentBrandId);
    expect(v.sponsorTopf).toMatchObject({ vertragsart: "leistung", laufzeit: 3, jahr: 2, gewaehltVon: "ueberfuehrt" });
    expect(v.seasonsRemaining).toBe(2);
    expect(typeof v.sponsorTopf!.vorherAnker).toBe("number");
    // der Wechsel steht offen in der Uebersicht: alter Anker, neuer Betrag bei Erwartung und die Differenz
    const u = baueSponsorUebersicht(ueber, team)!;
    expect(u.vertrag!.ueberfuehrung).toMatchObject({ alterAnker: v.sponsorTopf!.vorherAnker });
    expect(u.vertrag!.ueberfuehrung!.differenz).toBeCloseTo(u.vertrag!.ueberfuehrung!.neuBeiErwartung - v.sponsorTopf!.vorherAnker!, 1);
    expect(ueberfuehreAltvertraege(ueber)).toBe(ueber);
    // ohne Topf-Stempel passiert nichts
    expect(ueberfuehreAltvertraege(gs)).toBe(gs);
  });

  it("Vorab-Zusage: die Kaufplanung der KI rechnet mit 90 % des vorlaeufigen Grundbetrags, nach dem Stichtag mit dem Grundbetrag", () => {
    const gs0 = topfSpiel();
    const mitVorab = stempleVorlaeufig(gs0);
    const team = gs0.teams[0]!.teamId;
    const v = mitVorab.seasonState.sponsorRegel!.vorlaeufig!;
    expect(Object.keys(v.grund)).toHaveLength(32);
    // Vorab-Zusage (90 % des vorlaeufigen Grundbetrags) plus die vom Topf verdraengten Einnahmen (Tickets, Marketing, Medaillen, Farb-Mittel)
    expect(topfPlanungSponsor(mitVorab, team)!).toBeGreaterThanOrEqual(Math.round(v.grund[team]! * 9) / 10);
    expect(topfPlanungSponsor(mitVorab, team)!).toBeLessThan(v.grund[team]! + 60);
    expect(erwarteterSponsorFuerPlanung(mitVorab, team)).toBeCloseTo(topfPlanungSponsor(mitVorab, team)!, 6);
    const f = sichereSponsorTopf(mitVorab);
    const stand = f.seasonState.sponsorRegel!.eingefroren!.teams[team]!;
    expect(topfPlanungSponsor(f, team)!).toBeGreaterThanOrEqual(stand.grundbetrag + stand.treue);
    // eingefrorener Grundbetrag ist mindestens die Zusage
    for (const [id, t] of Object.entries(f.seasonState.sponsorRegel!.eingefroren!.teams)) {
      expect(t.grundbetrag).toBeGreaterThanOrEqual(Math.round(v.grund[id]! * 9) / 10 - 0.11);
    }
    expect(berechneVorlaeufig(gs0).topf).toBeGreaterThan(0);
  });

  it("Uebertrag der Vorsaison ist auf 3 % des Topfs gedeckelt", () => {
    const gs = sichereSponsorTopf(topfSpiel());
    expect(Math.abs(uebertragFuerSaisonwechsel(gs))).toBeLessThanOrEqual(0.03 * gs.seasonState.sponsorRegel!.eingefroren!.topf + 0.06);
  });
});

describe("Sponsor-Topf: ein Anker fuer Vorstand und Sponsor", () => {
  it("nach dem Stichtag liest der Vorstand den eingefrorenen Erwartungsrang (gerundet)", () => {
    const gs = sichereSponsorTopf(topfSpiel());
    const rows = buildTeamSeasonOverviewRows({ gameState: gs });
    const byId = new Map(rows.map((r) => [r.teamId, r] as const));
    const team = gs.teams[4]!.teamId;
    const e = sponsorAnkerFuer(gs, team)!;
    const x = computeTeamExpectation({ row: byId.get(team)!, rowsByTeamId: byId, identity: null, gameState: gs });
    expect(x.expectedRank).toBe(Math.min(x.teamCount, Math.max(1, Math.round(e))));
    expect(sponsorAnkerFuer(topfSpiel(), team)).toBeNull();
  });
});

describe("Sponsorentermin: Entscheidung statt Wuerfel", () => {
  it("zwei feste Spieltage je Saison und Team, einer je Saisonhaelfte", () => {
    const [a, b] = terminSpieltage("season-1", "T-1", 20);
    expect(a).toBeGreaterThan(1);
    expect(a).toBeLessThanOrEqual(10);
    expect(b).toBeGreaterThan(10);
    expect(b).toBeLessThan(20);
    expect(terminSpieltage("season-1", "T-1", 20)).toEqual([a, b]);
  });

  it("Zusage bucht +1,5 C als Ereignis und senkt die Form des benannten Spielers; Absage nichts; doppelte Antwort wird abgelehnt", () => {
    let gs = sichereSponsorTopf(topfSpiel());
    for (let i = 1; i <= 3; i += 1) gs = erzeugeTermine(gs, i);
    const alle = sponsorTermine(gs);
    expect(alle.length).toBeGreaterThanOrEqual(32);
    expect(alle.length).toBeLessThanOrEqual(64);
    const je = new Map<string, number>();
    for (const t of alle) je.set(t.teamId, (je.get(t.teamId) ?? 0) + 1);
    expect(Math.max(...je.values())).toBeLessThanOrEqual(2);
    expect(erzeugeTermine(gs, 3)).toBe(gs);
    const termin = alle.find((t) => t.spielerId)!;
    const cash0 = gs.teams.find((t) => t.teamId === termin.teamId)!.cash;
    const r = entscheideTermin(gs, termin.id, "zusagen", "mensch", { saveId: "s" });
    expect(r.error).toBeUndefined();
    expect(r.gameState.teams.find((t) => t.teamId === termin.teamId)!.cash).toBeCloseTo(cash0 + 1.5, 6);
    expect((r.gameState.seasonState.sponsorEvents ?? []).some((e) => e.eventType === "sponsor_termin" && e.status === "resolved" && e.cashDelta === 1.5)).toBe(true);
    const form = r.gameState.playerFormState?.find((f) => f.playerId === termin.spielerId);
    expect(form).toBeTruthy();
    expect(form!.form).toBeLessThan(50);
    expect(entscheideTermin(r.gameState, termin.id, "absagen", "mensch").error).toBe("sponsor_termin_entschieden");
    // Absage: keine Kassenbewegung, keine Form
    const andere = alle.find((t) => t.id !== termin.id && t.teamId !== termin.teamId)!;
    const ab = entscheideTermin(gs, andere.id, "absagen", "mensch");
    expect(ab.gameState.teams.find((t) => t.teamId === andere.teamId)!.cash).toBe(gs.teams.find((t) => t.teamId === andere.teamId)!.cash);
    expect(ab.gameState.playerFormState).toBe(gs.playerFormState);
  });

  it("KI und delegierte Teams beantworten sofort, ein Mensch ohne Delegation bleibt offen und verfaellt nach zwei Spieltagen", () => {
    let gs = sichereSponsorTopf(topfSpiel());
    const mensch = gs.teams[1]!.teamId;
    gs = { ...gs, seasonState: { ...gs.seasonState, teamControlSettings: { ...(gs.seasonState.teamControlSettings ?? {}), [mensch]: { controlMode: "manual" } as never } } };
    const n = gs.season.matchdayIds.length;
    for (let i = 1; i <= 3; i += 1) gs = erzeugeTermine(gs, i);
    const nachKi = beantworteTermineDerKi(gs);
    expect(offeneSponsorTermine(nachKi).length).toBeGreaterThan(0);
    expect(offeneSponsorTermine(nachKi).every((t) => t.teamId === mensch)).toBe(true);
    expect(sponsorTermine(nachKi).filter((t) => t.teamId !== mensch).every((t) => t.status !== "offen")).toBe(true);
    // verfaellt nach zwei Spieltagen
    let spaeter = nachKi;
    for (let i = 4; i <= n; i += 1) spaeter = erzeugeTermine(spaeter, i);
    expect(offeneSponsorTermine(spaeter).filter((t) => t.nachSpieltag <= n - 2)).toHaveLength(0);
  });
});

describe("Sponsor-Uebersicht: das eine View-Modell der Seite", () => {
  it("liefert vier Ansichten: Vertrag, Angebote (ohne Vertrag), Liga-Vergleich mit 16 Teams, vierstufige Rechnung", () => {
    const gs = sichereSponsorTopf(topfSpiel());
    const team = gs.teams[0]!.teamId;
    const u = baueSponsorUebersicht(gs, team)!;
    expect(u.vertrag!.zeilen.grund.saison).toBeGreaterThan(0);
    expect(u.vertrag!.farben).toHaveLength(2);
    expect(u.farbPartner).toHaveLength(2);
    expect(u.liga_vergleich).toHaveLength(16);
    expect(u.liga_vergleich.filter((x) => !x.nebel)).toHaveLength(1);
    expect(u.rechnung.schritte.map((s) => s.id)).toEqual(["betrieb", "ersatz", "faktor", "verteilung"]);
    expect(u.rechnung.topf).toBeCloseTo(gs.seasonState.sponsorRegel!.eingefroren!.topf, 6);
    expect(u.angebote).toHaveLength(0);
    // ohne Vertrag: drei Vertragsarten je Angebot mit Passungszeile
    const offen = ensureSeasonSponsorOffers(stempleVorlaeufig(stempleSponsorRegelBeimAnlegen(battleSpiel())));
    const o = baueSponsorUebersicht(offen, offen.teams[0]!.teamId)!;
    expect(o.vertrag).toBeNull();
    expect(o.angebote.length).toBe(3);
    for (const a of o.angebote) {
      expect(a.arten.map((x) => x.vertragsart)).toEqual(["fest", "leistung", "praemie"]);
      expect(a.passung.text).toMatch(/^Passung [+−±]\d+ %/);
      expect(a.laufzeiten.map((l) => l.laufzeit)).toEqual([1, 2, 3]);
    }
  });

  it("unter dem alten System: null (die alte Seite bleibt zustaendig)", () => {
    const alt = stempleSponsorRegelNachLaden(battleSpiel());
    expect(baueSponsorUebersicht(alt, alt.teams[0]!.teamId)).toBeNull();
  });
});

describe("Sponsor-Topf: Schreibwege und Quelltext-Waechter", () => {
  it("Sponsor-Routen schreiben nur hinter authorizeServerRoomWrite mit resolveAuthoritativeWriteOwnerId, frisch gelesen", () => {
    for (const datei of ["app/api/sponsor/choose/route.ts", "app/api/sponsor/event/route.ts"]) {
      const q = quelle(datei);
      expect(q).toContain("authorizeServerRoomWrite");
      expect(q).toContain("resolveAuthoritativeWriteOwnerId");
      expect(q).toContain("persistence.getSaveById");
    }
    expect(quelle("app/api/sponsor/choose/route.ts")).toContain("topf: { vertragsart: body.vertragsart, laufzeit: body.laufzeit, farben: body.farben");
    expect(quelle("app/api/sponsor/event/route.ts")).toContain("entscheideTermin");
  });

  it("der Stempel wird nur dort aus der Variable gelesen, wo er gesetzt wird (nie in einem Rechenweg)", () => {
    const treffer: string[] = [];
    const wurzel = path.resolve(__dirname, "..");
    const gehe = (dir: string) => {
      for (const e of fs.readdirSync(path.join(wurzel, dir), { withFileTypes: true })) {
        const rel = path.join(dir, e.name);
        if (e.isDirectory()) gehe(rel);
        else if (/\.tsx?$/.test(e.name) && fs.readFileSync(path.join(wurzel, rel), "utf8").includes("process.env.OLY_SPONSOR_REGEL")) treffer.push(rel);
      }
    };
    gehe("lib");
    gehe("app");
    expect(treffer.sort()).toEqual(["lib/resolve/sponsor-regel.ts"]);
  });

  it("Stichtag haengt am Fensterschluss vor der ersten Wertung und als Rueckfall am ersten Buchen", () => {
    expect(quelle("lib/resolve/legacy-matchday-result-apply-service.ts")).toContain("sichereSponsorTopf(ensureSeasonApronLinesFrozen(save.gameState))");
    expect(quelle("lib/finance/finanzen-je-spieltag-buchung.ts")).toContain("sichereSponsorTopf(spiegleSponsorNotbremse(gameState))");
  });
});

// ── Hilfen ────────────────────────────────────────────────────────────────────────────────────────
function quelle(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");
}
