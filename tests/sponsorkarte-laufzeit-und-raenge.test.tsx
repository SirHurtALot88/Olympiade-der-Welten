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
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SponsorOfferCardNewLook } from "@/components/foundation/sponsor/SponsorOfferCardNewLook";
import { SponsorSeasonRankTable } from "@/components/foundation/sponsor/SponsorSeasonRankTable";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { SPONSOR_ANGEBOTE_JE_TEAM } from "@/lib/sponsor/sponsor-offer-service";
import {
  buildOfferRankPayoutLadderPreview,
  buildSponsorOfferTermForecast,
} from "@/lib/sponsor/sponsor-economy-calibration";
import { buildSponsorOfferPresentation, buildSponsorRankTierRows } from "@/lib/sponsor/sponsor-offer-presenter";
import { ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";
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
 * DIESE GRUPPE HAT FRUEHER DEN QUELLTEXT DER KARTE GELESEN (`readFileSync` + `toContain`) — mit der
 * Begruendung, ein Kunst-`GameState` sage mehr ueber die Attrappe aus als ueber die Karte. Die
 * Begruendung war richtig, die Schlussfolgerung falsch: es braucht keine Attrappe, sondern einen
 * ECHTEN Spielstand (`createSingleplayerGameState` + `ensureSeasonSponsorOffers`) — genau den, aus
 * dem der Browser die Karte auch fuellt.
 *
 * Warum die Umstellung noetig war: ein Quelltext-Test bleibt gruen ueber toter Anzeige. Er haette
 * nicht gemerkt, wenn die Leiter im Aufklapper andere Betraege zeigt als die Abrechnung, wenn der
 * Ausblick eine andere Zahl rendert als `buildSponsorOfferTermForecast` liefert, oder wenn die
 * Rangtabelle gar nicht mehr im Aufklapper landet. Hier wird jetzt GERENDERT und die ZAHL
 * verglichen — dieselbe Bauart wie `tests/kaderkarte-vk-definitionsgleichheit.test.tsx`.
 */
describe("Der Mittelteil der Sponsorkarte zeigt die Zahlen, die die lib liefert", () => {
  /** Ein echter Spielstand mit echten Angeboten — kein Kunst-Zustand. */
  const gameState = ensureSeasonSponsorOffers(createSingleplayerGameState());
  const alleAngebote = Object.values(gameState.seasonState.sponsorOffersByTeamId ?? {}).flat();
  /** Die Karte formatiert mit einer Nachkommastelle; hier dieselbe Regel, damit Text == Zahl. */
  const formatCash = (value: number) => value.toFixed(1);

  function rendere(offer: SponsorOffer): string {
    return renderToStaticMarkup(
      <SponsorOfferCardNewLook
        offer={offer}
        gameState={gameState}
        chooseBusy={false}
        canManage={false}
        onChoose={() => {}}
        formatCash={formatCash}
      />,
    );
  }

  /** Text ohne Tags — so lassen sich gerenderte Betraege als Zahlen wiederfinden. */
  function nurText(html: string): string {
    return html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
  }

  it("die Fixture traegt echte V3-Angebote — sonst prueft der Test nichts", () => {
    // Die frueher hier stehende 100 stammte aus der Zeit mit FUENF Angeboten je Team
    // (32 x 5 = 160). Seit „nur 3 Sponsoren statt 5" sind es 96 — die Wache schlug an, obwohl an
    // der Fixture nichts fehlte. Abgeleitet ist sie strenger: jedes Team braucht ein volles Slate.
    expect(alleAngebote.length).toBeGreaterThanOrEqual(gameState.teams.length * SPONSOR_ANGEBOTE_JE_TEAM);
    expect(alleAngebote.every((offer) => getSponsorV3Terms(offer) != null)).toBe(true);
  });

  it("die Gewinnstufen im Aufklapper sind die Betraege der Abrechnungsleiter — Stufe fuer Stufe", () => {
    let geprueft = 0;
    for (const offer of alleAngebote.slice(0, 12)) {
      const html = rendere(offer);
      const aufklapper = html.slice(html.indexOf('data-testid="sponsor-rank-ladder-disclosure"'));
      expect(aufklapper, "die Leiter steht unter V3 nur noch auf Abruf").not.toBe("");
      expect(aufklapper).toContain("Alle Gewinnstufen");

      // Die Wahrheit: dieselbe Leiter, aus der das Settlement zahlt.
      const stufen = buildSponsorRankTierRows({
        baseCash: offer.components.find((component) => component.kind === "base")?.rewardCash ?? 0,
        rankLadder: buildOfferRankPayoutLadderPreview(gameState, offer),
        includeFloorRung: true,
      });
      expect(stufen.length).toBeGreaterThan(5);
      const text = nurText(aufklapper);
      for (const stufe of stufen) {
        expect(text, `Stufe "${stufe.label}" fehlt mit ${formatCash(stufe.absolutePayout)}`).toContain(
          formatCash(stufe.absolutePayout),
        );
        geprueft += 1;
      }
    }
    expect(geprueft).toBeGreaterThan(50);
  }, 120_000);

  /**
   * „Basis braucht auch keine sau, man sieht ja platz 32 waere ja die basis!" — unter V3 faellt die
   * Basis-Kachel weg. Als WERT geprueft: es gibt genau so viele Kacheln wie Nicht-Basis-Komponenten,
   * und der Basisbetrag steht stattdessen als „Garantiert auf jedem Platz" im V3-Block.
   */
  it("zeigt unter V3 keine BASIS-Kachel — der Betrag steht als Garantie im V3-Block", () => {
    let geprueft = 0;
    for (const offer of alleAngebote.slice(0, 12)) {
      const html = rendere(offer);
      // Kacheln zaehlen: die Standard-Kacheln der Komponenten plus die Sonderziel-Kachel, die
      // ausserhalb der Liste gerendert wird. Die Basis-Komponente darf KEINE Kachel bekommen.
      const kacheln = (html.match(/class="nl-sponsor-reward-tile is-/g) ?? []).length;
      const praesentation = buildSponsorOfferPresentation({ offer, gameState, teamId: offer.teamId });
      const erwartet =
        offer.components.filter(
          (component) =>
            component.kind !== "special" && component.kind !== "overperformance" && component.kind !== "base",
        ).length +
        (!praesentation.isChallenge && offer.components.some((component) => component.kind === "special") ? 1 : 0);
      expect(kacheln).toBe(erwartet);
      expect(html).not.toContain('class="nl-sponsor-reward-tile is-base');

      const garantie = nurText(html.slice(html.indexOf('data-testid="sponsor-v3-floor"')));
      const leiter = buildOfferRankPayoutLadderPreview(gameState, offer);
      expect(garantie).toContain(formatCash(Math.round(leiter[31]! * 10) / 10));
      geprueft += 1;
    }
    expect(geprueft).toBe(12);
  }, 120_000);

  it("jede Vertragssaison ist aufklappbar und traegt IHRE Rangtabelle mit IHREN Betraegen", () => {
    const mehrjaehrig = alleAngebote.filter((offer) => (offer.termSeasons ?? 1) > 1).slice(0, 8);
    expect(mehrjaehrig.length).toBeGreaterThan(0);

    let geprueft = 0;
    for (const offer of mehrjaehrig) {
      const html = rendere(offer);
      const ausblick = html.slice(html.indexOf('data-testid="sponsor-term-outlook"'));
      const prognose = buildSponsorOfferTermForecast(gameState, offer);
      expect(prognose.length).toBe(offer.termSeasons ?? 1);
      // Eine aufklappbare Zeile je Vertragssaison.
      expect(ausblick.split("nl-sponsor-term-season-summary").length - 1).toBe(prognose.length);

      const text = nurText(ausblick);
      for (const [index, eintrag] of prognose.entries()) {
        expect(text).toContain(`Saison ${index + 1}/${offer.termSeasons}`);
        // Der Betrag der Zeile …
        expect(text).toContain(formatCash(eintrag.payoutAtCurrentRank));
        // … und die Rangtabelle DIESER Saison: Meister- und Letzter-Betrag stehen darin.
        expect(text).toContain(formatCash(eintrag.rankPayouts[0]!));
        expect(text).toContain(formatCash(eintrag.rankPayouts[31]!));
        geprueft += 1;
      }
    }
    expect(geprueft).toBeGreaterThan(1);
  }, 120_000);

  it("sagt im Klartext, wenn der Faktor nur fortgeschrieben ist — und nennt ihn", () => {
    // Season 1: `seasonEconomyFactors` ist leer, jede Vertragssaison ist "fortgeschrieben".
    const offer = alleAngebote.find((entry) => (entry.termSeasons ?? 1) > 1)!;
    const prognose = buildSponsorOfferTermForecast(gameState, offer);
    expect(prognose.every((eintrag) => eintrag.factorSource === "fortgeschrieben")).toBe(true);

    const text = nurText(rendere(offer));
    expect(text).toContain("noch nicht gewürfelt");
    expect(text).toContain(prognose[0]!.salaryFactor.toFixed(2));
    // Die alte, irrefuehrende Form („(Faktor 1.00)" hinter jeder Zeile) darf nicht zurueckkommen.
    expect(text).not.toContain(`(Faktor ${prognose[0]!.salaryFactor.toFixed(2)})`);
  }, 120_000);
});
