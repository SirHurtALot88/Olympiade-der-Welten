/**
 * GEMELDET (mit Screenshot der Sponsoren-Seite):
 *   1. „hier ist noch n bug bei den seasons 1 - 2 - 3 da steht überall faktor 1.00"
 *   2. „Wenn man über das jahr drüber hovert würde ich dann auch erwarten dass die rangtabelle
 *       gezeigt wird wie viel cash pro rang man bekommt"
 *   3. „dann steht im mittleren bereich sehr viel ohne dass es wirklich mehr aussagt als das
 *       drumherum … Ich brauche nicht noch mal sehen was man als meister oder als letzter bekommt
 *       das sieht man ja!"
 *
 * ZU 1 — die Ursache, nachgemessen statt vermutet: `seasonEconomyFactors` ist in Season 1 LEER
 * (das Fenster wird erst beim Saisonuebergang geschrieben, preseason-workflow-service.ts). Der
 * Ausblick fiel damit fuer JEDE Vertragssaison auf denselben Unterschrifts-Faktor zurueck und
 * behauptete drei unabhaengige Prognosen, wo einmal derselbe Wert stand. In allen sechs
 * Spielstaenden dieses Containers war das Fenster leer, der abgeleitete Wert dagegen vorhanden
 * (z. B. 1.09 / 1.04 / 1.13) — die Zahl 1.00 war also nicht „der Faktor", sondern der Ersatzwert.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SponsorSeasonRankTable } from "@/components/foundation/sponsor/SponsorSeasonRankTable";
import { buildSponsorOfferTermForecast } from "@/lib/sponsor/sponsor-economy-calibration";
import type { GameState, SponsorOffer } from "@/lib/data/olyDataTypes";

/** 32 Raenge, monoton fallend — grob wie eine echte Leiter, aber nachrechenbar. */
const LEITER = Array.from({ length: 32 }, (_, index) => 70 - index * 0.6);

function angebot(termSeasons: number): SponsorOffer {
  return {
    offerId: "offer-1",
    teamId: "A-A",
    name: "Testsponsor",
    archetype: "security",
    flavor: "",
    components: [{ componentId: "c1", kind: "base", label: "Basis", rewardCash: 50 }],
    termSeasons,
    sponsorV3: {
      version: 3,
      rankLadder: [...LEITER],
      baseLadder: [...LEITER],
      anchor: 52,
      tilt: 0,
      cardKey: "basis",
      cardName: "Basis",
      rarity: "gewöhnlich",
      curveShape: "titeljaeger",
      startRank: 25,
      goalKey: null,
      goalP: 0,
      goalSize: 0,
      salaryFactor: 1,
      floor: 40,
    },
  } as unknown as SponsorOffer;
}

function zustand(fenster: Array<{ horizonIndex: number; factor: number }> | null): GameState {
  return {
    season: { id: "season-1" },
    seasonState: fenster
      ? {
          seasonEconomyFactors: fenster.map((eintrag) => ({
            seasonId: "season-1",
            seasonLabel: eintrag.horizonIndex === 0 ? "Aktuell" : `Season +${eintrag.horizonIndex}`,
            horizonIndex: eintrag.horizonIndex,
            factor: eintrag.factor,
            source: "rolled",
            rollSeed: null,
            carriedFromSeasonId: null,
            generatedAt: "2026-01-01T00:00:00.000Z",
          })),
        }
      : {},
  } as unknown as GameState;
}

describe("Der Laufzeit-Ausblick sagt, WOHER der Faktor kommt", () => {
  it("nimmt den vorausgewuerfelten Faktor je Saison, wenn das Fenster ihn hergibt", () => {
    const eintraege = buildSponsorOfferTermForecast(
      zustand([
        { horizonIndex: 0, factor: 1.09 },
        { horizonIndex: 1, factor: 0.9 },
        { horizonIndex: 2, factor: 1.2 },
      ]),
      angebot(3),
    );
    expect(eintraege).toHaveLength(3);
    expect(eintraege[0]!.salaryFactor).toBe(1.09);
    expect(eintraege[1]!.salaryFactor).toBe(0.9);
    expect(eintraege.slice(0, 2).every((e) => e.factorSource === "vorausgewuerfelt")).toBe(true);
  });

  /**
   * Der Kern der Meldung. Vorher war das Ergebnis „dreimal 1.00" — nicht falsch gerechnet, aber
   * als drei getrennte Prognosen praesentiert. Jetzt steht dieselbe Zahl weiter da, nur ist sie
   * als fortgeschrieben markiert und die Karte sagt es im Klartext.
   */
  it("markiert den Faktor als fortgeschrieben, wenn das Fenster leer ist (Season 1)", () => {
    const eintraege = buildSponsorOfferTermForecast(zustand(null), angebot(3));
    expect(eintraege).toHaveLength(3);
    expect(eintraege.every((e) => e.factorSource === "fortgeschrieben")).toBe(true);
    expect(eintraege.every((e) => e.salaryFactor === 1)).toBe(true);
  });

  it("mischt beides, wenn das Fenster kuerzer ist als die Laufzeit", () => {
    const eintraege = buildSponsorOfferTermForecast(zustand([{ horizonIndex: 0, factor: 1.15 }]), angebot(3));
    expect(eintraege.map((e) => e.factorSource)).toEqual([
      "vorausgewuerfelt",
      "fortgeschrieben",
      "fortgeschrieben",
    ]);
  });

  it("liefert je Saison eine vollstaendige Rangtabelle", () => {
    const eintraege = buildSponsorOfferTermForecast(zustand(null), angebot(2));
    for (const eintrag of eintraege) {
      expect(eintrag.rankPayouts).toHaveLength(32);
      expect(eintrag.rankPayouts.every((wert) => Number.isFinite(wert))).toBe(true);
    }
  });

  /**
   * Eine Quelle, nicht zwei: der Betrag der Zeile MUSS der Betrag der Tabelle am Startrang sein.
   * Waeren es zwei Rechnungen, koennten sie auseinanderlaufen — und der Spieler saehe beim
   * Aufklappen eine andere Zahl als zugeklappt.
   */
  it("zeigt in der Tabelle am Startrang exakt den Betrag der Zeile", () => {
    for (const eintrag of buildSponsorOfferTermForecast(zustand(null), angebot(3))) {
      expect(eintrag.rankPayouts[24]).toBe(eintrag.payoutAtCurrentRank);
    }
  });

  it("laesst spaetere Vertragsjahre gegen den Sockel abbauen (Laufzeit-Erosion)", () => {
    const eintraege = buildSponsorOfferTermForecast(zustand(null), angebot(3));
    expect(eintraege[1]!.payoutAtCurrentRank).toBeLessThan(eintraege[0]!.payoutAtCurrentRank);
    expect(eintraege[2]!.payoutAtCurrentRank).toBeLessThan(eintraege[1]!.payoutAtCurrentRank);
  });

  it("bleibt bei Einjahresvertraegen bei einer Saison", () => {
    expect(buildSponsorOfferTermForecast(zustand(null), angebot(1))).toHaveLength(1);
  });
});

describe("Die Rangtabelle einer Vertragssaison", () => {
  const zahlen = Array.from({ length: 32 }, (_, index) => 70 - index * 0.5);

  it("nennt Meister bis Platz 32 mit dem Betrag DIESER Saison", () => {
    const html = renderToStaticMarkup(
      <SponsorSeasonRankTable rankPayouts={zahlen} currentTeamRank={25} formatCash={(v) => v.toFixed(1)} />,
    );
    for (const label of ["Meister", "Top 4", "Top 8", "Top 12", "Top 16", "Top 20", "Top 24", "Top 28", "Platz 32"]) {
      expect(html).toContain(label);
    }
    // Meister = Rang 1 = 70,0; Platz 32 = 70 − 31·0,5 = 54,5.
    expect(html).toContain(">70.0<");
    expect(html).toContain(">54.5<");
  });

  it("hebt die Stufe hervor, die der aktuelle Rang gerade haelt", () => {
    // Rang 25 haelt „Top 28", nicht „Top 24".
    const html = renderToStaticMarkup(
      <SponsorSeasonRankTable rankPayouts={zahlen} currentTeamRank={25} formatCash={(v) => v.toFixed(1)} />,
    );
    const zeile = html.slice(html.indexOf('<tr class="is-current">'));
    expect(zeile.slice(0, 200)).toContain("Top 28");
  });

  it("kommt ohne bekannten Rang aus, statt eine Stufe zu erfinden", () => {
    const html = renderToStaticMarkup(
      <SponsorSeasonRankTable rankPayouts={zahlen} currentTeamRank={null} formatCash={(v) => v.toFixed(1)} />,
    );
    expect(html).not.toContain("is-current");
    expect(html).toContain("Meister");
  });

  it("rendert nichts, wenn keine Betraege vorliegen", () => {
    expect(
      renderToStaticMarkup(<SponsorSeasonRankTable rankPayouts={[]} currentTeamRank={4} formatCash={String} />),
    ).toBe("");
  });
});

/**
 * Diese Gruppe prueft den QUELLTEXT der Karte, nicht ihr Rendering — die Karte braucht einen
 * vollstaendigen `GameState` (Liga-Tabelle, Sponsor-Praesentation), und ein dafuer gebauter
 * Kunst-Zustand wuerde mehr ueber die Attrappe aussagen als ueber die Karte. Was hier festgehalten
 * wird, sind die drei Zusagen aus der Meldung, jede an einer Stelle, die man nicht versehentlich
 * zurueckdreht.
 */
describe("Der Mittelteil der Sponsorkarte wiederholt sich nicht mehr", () => {
  const quelle = readFileSync(join(process.cwd(), "components/foundation/sponsor/SponsorOfferCardNewLook.tsx"), "utf8");

  it("zeigt die volle Gewinnstufen-Leiter unter V3 nur noch auf Abruf", () => {
    expect(quelle).toContain('data-testid="sponsor-rank-ladder-disclosure"');
    expect(quelle).toContain("Alle Gewinnstufen");
    // Ohne V3-Block gibt es den Block darueber nicht — dort bleibt die Leiter die einzige Quelle
    // fuer Meister- und Letzter-Betrag und muss sichtbar bleiben.
    expect(quelle).toContain("presentation.v3 ? (");
  });

  it("laesst die BASIS-Kachel weg, wenn sie exakt den garantierten Boden wiederholt", () => {
    expect(quelle).toContain("const v3Floor = presentation.v3?.guaranteedFloor ?? null;");
    expect(quelle).toContain("Math.abs(component.rewardCash - v3Floor) < 0.05");
  });

  it("macht jede Vertragssaison aufklappbar und haengt die Rangtabelle daran", () => {
    expect(quelle).toContain("nl-sponsor-term-season-summary");
    expect(quelle).toContain("<SponsorSeasonRankTable");
    // Der Faktor steht im Aufklapp-Bereich, nicht mehr als „(Faktor 1.00)" hinter jeder Zeile.
    expect(quelle).not.toContain("(Faktor {entry.salaryFactor.toFixed(2)})");
  });

  it("sagt im Klartext, wenn der Faktor nur fortgeschrieben ist", () => {
    expect(quelle).toContain('entry.factorSource === "vorausgewuerfelt"');
    expect(quelle).toContain("noch nicht gewürfelt");
  });
});
