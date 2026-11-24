/**
 * Review-Runde PR 1740 (24.11.): eigene Tests fuer die Punkte, die vorher nur indirekt abgedeckt waren.
 * Nummern wie in docs/design/sponsoren-rework-bau-24-11.md Abschnitt 9.
 */
import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";

// Ligalokale Tabellenplaetze fuer die Tests steuerbar machen (der Baum der Tabelle ist im Test-Spielstand ohne Ergebnisse leer).
const tabelle = vi.hoisted(() => ({ rang: null as null | Record<string, number | null> }));
vi.mock("@/lib/foundation/team-management-overview", async (importOriginal) => {
  const echt = await importOriginal<typeof import("@/lib/foundation/team-management-overview")>();
  return {
    ...echt,
    buildTeamSeasonOverviewRows: (...args: Parameters<typeof echt.buildTeamSeasonOverviewRows>) => {
      const rows = echt.buildTeamSeasonOverviewRows(...args);
      const r = tabelle.rang;
      return r ? rows.map((x) => (x.teamId in r ? { ...x, rank: r[x.teamId] } : x)) : rows;
    },
  };
});

import { POST as chooseRoutePost } from "@/app/api/sponsor/choose/route";
import { POST as eventRoutePost } from "@/app/api/sponsor/event/route";
import { stempleFinanzenJeSpieltagBeimAnlegen, summeSpieltagBuchungen } from "@/lib/finance/finanzen-je-spieltag";
import { bucheSpieltagFinanzen } from "@/lib/finance/finanzen-je-spieltag-buchung";
import { erwarteterSponsorFuerKaufplanung, erwarteterSponsorFuerPlanung } from "@/lib/finance/sponsor-erwartung";
import { buildGameInboxItems } from "@/lib/foundation/game-inbox-service";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { stempleMedaillenBeimAnlegen } from "@/lib/medaillen/medaillen-regel";
import {
  sponsorRegelFuerNeueSaison,
  spiegleSponsorNotbremse,
  stempleSponsorRegelBeimAnlegen,
  stempleSponsorRegelNachLaden,
} from "@/lib/resolve/sponsor-regel";
import { SPONSOR_BRAND_PARENTS, pickSponsorBrandForOffer } from "@/lib/sponsor/sponsor-brand-catalog";
import { advanceSponsorContractsForNewSeason } from "@/lib/sponsor/sponsor-contract-lifecycle";
import { chooseSponsorOfferForAiTeams, ensureSeasonSponsorOffers, getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-service";
import { applySponsorSettlement, previewSponsorSettlement, sponsorBasisJahr } from "@/lib/sponsor/sponsor-settlement-service";
import { berechneTopf } from "@/lib/sponsors/sponsor-topf-modell";
import { leihVerzichtJahr, topfLeistungJetzt, topfStandFuer } from "@/lib/sponsors/sponsor-topf-buchung";
import { sammleTopfEingabe, treueSaisonsFuerMarke } from "@/lib/sponsors/sponsor-topf-eingaben";
import { topfPlanungSponsor } from "@/lib/sponsors/sponsor-topf-planung";
import { berechneVorlaeufig, sichereSponsorTopf, stempleVorlaeufig } from "@/lib/sponsors/sponsor-topf-stichtag";
import { baueSponsorUebersicht } from "@/lib/sponsors/sponsor-uebersicht";

vi.setConfig({ testTimeout: 240_000 });

afterEach(() => {
  tabelle.rang = null;
  delete process.env.OLY_SPONSOR_REGEL;
});

function battleSpiel(ligaAufteilung: [number, number] = [16, 16]): GameState {
  const gs = structuredClone(createSingleplayerGameState());
  gs.scenarioMeta = { ...(gs.scenarioMeta ?? {}), gameMode: "battle" } as GameState["scenarioMeta"];
  gs.seasonState.leagueByTeamId = Object.fromEntries(gs.teams.map((t, i) => [t.teamId, i < ligaAufteilung[0] ? "liga1" : "liga2"])) as never;
  return gs;
}

function topfSpiel(ligaAufteilung?: [number, number]): GameState {
  let gs = stempleSponsorRegelBeimAnlegen(stempleMedaillenBeimAnlegen(stempleFinanzenJeSpieltagBeimAnlegen(battleSpiel(ligaAufteilung))));
  gs = ensureSeasonSponsorOffers(gs);
  return chooseSponsorOfferForAiTeams(gs, Object.fromEntries(gs.teams.map((t) => [t.teamId, { controlMode: "ai" }])) as never);
}

function quelle(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");
}

const summe = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("Review 3: Notbremse friert den Leistungsteil ein", () => {
  it("die Saisonend-Zeile Leistungsteil ist genau der bereits je Spieltag gebuchte Abschlag, kein Ausgleich", () => {
    let gs = sichereSponsorTopf(topfSpiel());
    const stand = topfStandFuer(gs)!;
    const team = Object.values(stand.teams).find((t) => t.liga === 1)!.teamId;
    // Platz 1 gegen Erwartung: der Leistungsteil ist positiv, je Spieltag wird 80 % von L / N gebucht.
    tabelle.rang = { [team]: 1 };
    const ids = gs.season.matchdayIds;
    gs = bucheSpieltagFinanzen(gs, ids[0]!);
    gs = bucheSpieltagFinanzen(gs, ids[1]!);
    const gebucht = summeSpieltagBuchungen(gs, team).rangAbschlag;
    expect(gebucht).toBeGreaterThan(0);
    // Notbremse: Leistungsteil aus, Rang-Zeile = gebuchter Betrag
    process.env.OLY_SPONSOR_REGEL = "aus-sofort";
    const notbremse = spiegleSponsorNotbremse(gs);
    delete process.env.OLY_SPONSOR_REGEL;
    expect(Object.values(topfLeistungJetzt(notbremse)!.leistung).every((v) => v === 0)).toBe(true);
    const rang = previewSponsorSettlement(notbremse, "season_end").rows.find((r) => r.teamId === team && r.kind === "rank")!;
    expect(rang.cashDelta).toBeCloseTo(gebucht, 1);
  });
});

describe("Review 4: Verlaengerungs-Slot und Treue in Saisonen", () => {
  it("der Verlaengerungs-Slot traegt die Marke des auslaufenden Vertrags (renewalParentId)", () => {
    const gs = battleSpiel();
    const team = gs.teams[0]!;
    const archetype = "security" as const;
    const eigene = SPONSOR_BRAND_PARENTS[SPONSOR_BRAND_PARENTS.length - 1]!;
    const ohne = pickSponsorBrandForOffer({ seasonId: "s1", teamId: team.teamId, team, identity: null, profile: null, archetype, rarity: "magisch", slotIndex: 0 });
    const mit = pickSponsorBrandForOffer({ seasonId: "s1", teamId: team.teamId, team, identity: null, profile: null, archetype, rarity: "magisch", slotIndex: 0, renewalParentId: eigene.id });
    expect(mit.parent.id).toBe(eigene.id);
    // ohne renewalParentId entscheidet die Wahl wie bisher (nicht zwingend dieselbe Marke)
    expect(ohne.parent.id).toBeTruthy();
  });

  it("Treue zaehlt Saisonen: jede abgeschlossene Saison erhoeht den Zaehler der Dachmarke, gedeckelt bei 3", () => {
    const gs = topfSpiel();
    const team = gs.teams[0]!.teamId;
    const vertrag = getTeamSponsorContract(gs, team)!;
    const parent = vertrag.sponsorParentBrandId!;
    const mehrjaehrig = {
      ...gs,
      seasonState: {
        ...gs.seasonState,
        sponsorContractsByTeamId: { ...gs.seasonState.sponsorContractsByTeamId, [team]: { ...vertrag, seasonsRemaining: 3, termSeasons: 3, sponsorTopf: { ...vertrag.sponsorTopf!, laufzeit: 3 } } },
      },
    } as GameState;
    const eins = advanceSponsorContractsForNewSeason(mehrjaehrig, "season-2");
    expect(treueSaisonsFuerMarke(eins, team, parent)).toBe(1);
    const zwei = advanceSponsorContractsForNewSeason(eins, "season-3");
    expect(treueSaisonsFuerMarke(zwei, team, parent)).toBe(2);
    const viel = { ...zwei, seasonState: { ...zwei.seasonState, sponsorMarkenSaisonenByTeamId: { [team]: { [parent]: 7 } } } } as GameState;
    expect(treueSaisonsFuerMarke(viel, team, parent)).toBe(3);
  });
});

describe("Review 5: erste Topf-Saison eines migrierten Spielstands", () => {
  it("ohneBremse nur nach einem Vorgaenger ohne Topf; vorlaeufig rechnet mit den echten heutigen Kosten", () => {
    const alt = stempleSponsorRegelNachLaden(battleSpiel());
    const altStempel = alt.seasonState.sponsorRegel!;
    expect(altStempel.version).toBe("alt");
    const naechste = sponsorRegelFuerNeueSaison(alt.season.id, altStempel);
    expect(naechste.version).toBe("topf");
    expect(naechste.ohneBremse).toBe(true);
    // der Nachfolger eines Topf-Stempels traegt es nicht (dort gilt die Bremse gegen das Vorjahr)
    expect(sponsorRegelFuerNeueSaison(alt.season.id, naechste).ohneBremse).toBeUndefined();
    const gs = { ...alt, seasonState: { ...alt.seasonState, sponsorRegel: naechste } } as GameState;
    const eingabe = sammleTopfEingabe(gs).eingabe;
    expect(eingabe.ohneBremse).toBe(true);
    const mitRealen = berechneTopf({ ...eingabe, zusage: undefined });
    expect(berechneVorlaeufig(gs).topf).toBeCloseTo(mitRealen.topf, 6);
  });
});

describe("Review 6: Vorstand und Kredit rechnen mit der reinen Sponsor-Erwartung", () => {
  it("Planung = topfPlanungSponsor ohne verdraengte Einnahmen; die Kaufplanung der KI liegt darueber", () => {
    const gs = stempleVorlaeufig(topfSpiel());
    const team = gs.teams[0]!.teamId;
    const rein = erwarteterSponsorFuerPlanung(gs, team);
    expect(rein).toBeCloseTo(topfPlanungSponsor(gs, team)!, 6);
    expect(erwarteterSponsorFuerKaufplanung(gs, team)).toBeCloseTo(topfPlanungSponsor(gs, team, { mitVerdraengtem: true })!, 6);
    expect(erwarteterSponsorFuerKaufplanung(gs, team)).toBeGreaterThanOrEqual(rein);
  });

  it("Quelltext: Vorstand-Freigabe und Kreditpruefung rufen nie die Kaufplanung, nur der Draft-Adapter", () => {
    expect(quelle("lib/finance/vorstand-budgetfreigabe.ts")).not.toContain("erwarteterSponsorFuerKaufplanung");
    expect(quelle("lib/finance/vorstand-budgetfreigabe.ts")).not.toContain("topfPlanungSponsor");
    expect(quelle("lib/finance/kredit-pruefung.ts")).not.toContain("erwarteterSponsorFuerKaufplanung");
    expect(quelle("lib/finance/kredit-pruefung.ts")).not.toContain("topfPlanungSponsor");
    expect(quelle("lib/ai/organic-squad/draft-adapter.ts")).toContain("erwarteterSponsorFuerKaufplanung");
  });
});

describe("Review 8: Rang-Rueckfall nur auf ligalokale Plaetze 1 bis n", () => {
  it("ein Platz ausserhalb 1 bis n (z. B. der globale Budget-Rang) faellt auf den Erwartungsrang zurueck", () => {
    const gs = sichereSponsorTopf(topfSpiel());
    const stand = topfStandFuer(gs)!;
    const liga1 = Object.values(stand.teams).filter((t) => t.liga === 1);
    const a = liga1[0]!;
    const b = liga1[1]!;
    tabelle.rang = { [a.teamId]: 3, [b.teamId]: 25 };
    const l = topfLeistungJetzt({ ...gs })!;
    expect(l.rang[a.teamId]).toBe(3);
    expect(l.rang[b.teamId]).toBe(b.erwartungsrang);
    // Summe je Liga bleibt 0
    expect(Math.abs(summe(liga1.map((t) => l.leistung[t.teamId]!)))).toBeLessThan(0.11);
  });
});

describe("Review 9 und 10: Routen pruefen vor dem Lesen des Spielstands (400)", () => {
  const anfrage = (body: unknown) => new Request("http://test.local/api/sponsor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("Event-Route ohne gueltige antwort: 400 sponsor_antwort_ungueltig, nie eine stille Zusage", async () => {
    for (const antwort of [undefined, "vielleicht", 1]) {
      const res = await eventRoutePost(anfrage({ saveId: "s", terminId: "t1", antwort }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("sponsor_antwort_ungueltig");
    }
  });

  it("Choose-Route: ungueltige Vertragsart, Laufzeit oder Farben ergeben 400 mit eigenem Fehlercode", async () => {
    const basis = { saveId: "s", teamId: "t", offerId: "o" };
    const fall: Array<[Record<string, unknown>, string]> = [
      [{ vertragsart: "gold" }, "sponsor_vertragsart_ungueltig"],
      [{ laufzeit: 5 }, "sponsor_laufzeit_ungueltig"],
      [{ farben: ["pow"] }, "sponsor_farben_ungueltig"],
      [{ farben: ["pow", "pow"] }, "sponsor_farben_ungueltig"],
      [{ farben: "pow" }, "sponsor_farben_ungueltig"],
    ];
    for (const [extra, fehler] of fall) {
      const res = await chooseRoutePost(anfrage({ ...basis, ...extra }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe(fehler);
    }
  });
});

describe("Review 11: Leih-Verzicht wird vom Grundbetrag abgezogen", () => {
  it("sponsorBasisJahr, Saisonend-Zeile und Uebersicht ziehen denselben Verzicht ab", () => {
    const gs0 = sichereSponsorTopf(topfSpiel());
    const team = gs0.teams[0]!.teamId;
    const vorher = sponsorBasisJahr(gs0, team);
    const vertrag = getTeamSponsorContract(gs0, team)!;
    const mitLeihe = {
      ...gs0,
      seasonState: {
        ...gs0.seasonState,
        sponsorContractsByTeamId: { ...gs0.seasonState.sponsorContractsByTeamId, [team]: { ...vertrag, sponsorLeihe: { verzichtJeSaison: [3] } as never } },
      },
    } as GameState;
    expect(leihVerzichtJahr(mitLeihe.seasonState.sponsorContractsByTeamId![team])).toBe(3);
    expect(sponsorBasisJahr(mitLeihe, team)).toBeCloseTo(vorher - 3, 1);
    const basisZeile = previewSponsorSettlement(mitLeihe, "season_end").rows.find((r) => r.teamId === team && r.kind === "base")!;
    expect(basisZeile.cashDelta).toBeCloseTo(vorher - 3, 1);
    expect(baueSponsorUebersicht(mitLeihe, team)!.vertrag!.zeilen.grund.leihVerzicht).toBe(3);
  });
});

describe("Review 12: die Abrechnung sichert zuerst den Stichtag", () => {
  it("applySponsorSettlement friert den Topf ein, wenn er noch offen ist", () => {
    const gs = topfSpiel();
    expect(gs.seasonState.sponsorRegel!.eingefroren).toBeFalsy();
    const apply = applySponsorSettlement({ gameState: gs, saveId: "s", execute: true, deductSalary: false });
    expect(apply.gameState.seasonState.sponsorRegel!.eingefroren).toBeTruthy();
  });
});

describe("Review 15: Ligagroesse ungleich 16", () => {
  it("12 + 20 Teams: Erwartungsraenge 1 bis n je Liga, Leistungsteil-Summe je Liga 0, Uebersicht mit 12 Teams", () => {
    const gs = sichereSponsorTopf(topfSpiel([12, 20]));
    const stand = topfStandFuer(gs)!;
    for (const [liga, n] of [[1, 12], [2, 20]] as const) {
      const teams = Object.values(stand.teams).filter((t) => t.liga === liga);
      expect(teams).toHaveLength(n);
      const raenge = teams.map((t) => t.erwartungsrang).sort((x, y) => x - y);
      expect(raenge[0]).toBeGreaterThanOrEqual(1);
      expect(raenge[raenge.length - 1]).toBeLessThanOrEqual(n);
    }
    const l = topfLeistungJetzt(gs)!;
    for (const liga of [1, 2] as const) {
      const ids = Object.values(stand.teams).filter((t) => t.liga === liga).map((t) => t.teamId);
      expect(Math.abs(summe(ids.map((id) => l.leistung[id]!)))).toBeLessThan(0.11);
    }
    const eigenesLiga1 = Object.values(stand.teams).find((t) => t.liga === 1)!.teamId;
    expect(baueSponsorUebersicht(gs, eigenesLiga1)!.liga_vergleich).toHaveLength(12);
  });
});

describe("Review 16: Posteingang", () => {
  it("der Hinweis 'automatisch unterschrieben' steht nur im Postfach des betroffenen manuellen Teams", () => {
    const gs0 = sichereSponsorTopf(topfSpiel());
    const [manuell, ki] = [gs0.teams[0]!, gs0.teams[1]!];
    const setze = (id: string) => {
      const v = gs0.seasonState.sponsorContractsByTeamId![id]!;
      return { ...v, sponsorTopf: { ...v.sponsorTopf!, gewaehltVon: "auto" as const } };
    };
    const gs = {
      ...gs0,
      teams: gs0.teams.map((t) => (t.teamId === manuell.teamId ? { ...t, humanControlled: true } : t)),
      seasonState: {
        ...gs0.seasonState,
        sponsorContractsByTeamId: { ...gs0.seasonState.sponsorContractsByTeamId, [manuell.teamId]: setze(manuell.teamId), [ki.teamId]: setze(ki.teamId) },
        teamControlSettings: {
          ...(gs0.seasonState.teamControlSettings ?? {}),
          [manuell.teamId]: { ...(gs0.seasonState.teamControlSettings?.[manuell.teamId] ?? {}), teamId: manuell.teamId, controlMode: "manual" as const },
          [ki.teamId]: { ...(gs0.seasonState.teamControlSettings?.[ki.teamId] ?? {}), teamId: ki.teamId, controlMode: "ai" as const },
        } as never,
      },
    } as GameState;
    const items = buildGameInboxItems({ gameState: gs, saveId: "s", hostMode: true }).filter((i) => i.source === "sponsor_topf_auto_signed");
    expect(items.map((i) => i.teamId)).toEqual([manuell.teamId]);
    expect(items[0]!.itemId).toContain(manuell.teamId);
  });
});
