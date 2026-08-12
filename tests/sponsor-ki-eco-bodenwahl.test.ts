/**
 * DIE KI-SPONSORWAHL MUSS KLAMMEN TEAMS DEN LEITERBODEN GEBEN, NICHT NUR DEN VORSCHUSS.
 *
 * `resolveAiSponsorArchetypePreference` (sponsor-offer-service.ts) gibt bei `cashPressure >= 7` bereits
 * "security" zurueck — der Sparwunsch existiert seit langem. Das Problem: `offer.archetype` kommt aus
 * `mapSponsorCardToArchetype(cardKey, axisKey)`, also aus Karte und Achse — NIE aus der Kurvenform. Die
 * Sicherheitspraeferenz erreicht die Leiter damit nicht; der frueher hier wirksame Vorschuss-Term
 * (+0,25 x Betrag bei `cashPressure >= 7`) waehlte zwar, welche Karte UEBERHAUPT einen Vorschuss trug,
 * aber nicht welche den hoechsten Boden hat.
 *
 * Dieser Test isoliert genau das fehlende Kriterium — der `ecoIntent01`-gewichtete
 * `sponsorV3DownsideShortfall`-Term — mit demselben Muster wie
 * `tests/sponsor-ki-kurvenform-passung.test.ts`: fuenf synthetische Angebote mit IDENTISCHEM Archetyp,
 * OHNE Achse, damit nur die Kurvenform ueber die Wahl entscheiden kann. (Den Vorschuss gibt es
 * inzwischen gar nicht mehr — sponsor-v3-model.ts —, die Aufbauten hier sind dadurch nur eindeutiger.)
 */
import { describe, expect, it } from "vitest";

import type { GameState, SponsorCurveShape, SponsorOffer } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { chooseSponsorOfferForAiTeams } from "@/lib/sponsor/sponsor-offer-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { applySponsorV3ToOffers, getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";
import { sponsorV3GuaranteedLadder } from "@/lib/sponsor/sponsor-v3-model";
import { buildSeasonStrategyState } from "@/lib/ai/ai-manager-doctrine-service";
import { getSponsorCurveFamily } from "@/lib/sponsor/sponsor-curve-shapes";
import {
  sponsorV3DownsideShortfall,
  sponsorV3ExpectedPayout,
  SPONSOR_V3_RANKS,
  type SponsorV3ContractTerms,
} from "@/lib/sponsor/sponsor-v3-model";

/** Fuenf Formen quer durch alle fuenf Familien — klar verschiedene Boeden (siehe sponsor-curve-shapes.ts:
 * "klassenerhalt" traegt den hoechsten garantierten Absolut-Boden im Pool, "titeljaeger" den niedrigsten). */
const ISOLATED_SHAPES: SponsorCurveShape[] = ["titeljaeger", "europapokal", "mittelfeld", "aufsteiger", "klassenerhalt"];

function buildBareOffer(input: { teamId: string; seasonId: string; curveShape: SponsorCurveShape; index: number }): SponsorOffer {
  return {
    offerId: `${input.seasonId}:${input.teamId}:eco-isolated:${input.index}`,
    seasonId: input.seasonId,
    teamId: input.teamId,
    // Identischer Archetyp fuer alle fuenf Angebote: der Markenpassungs-Term darf die Kurve nicht
    // entscheiden koennen — nur der neue Downside-Term darf das.
    archetype: "identity",
    curveShape: input.curveShape,
    rarity: "magisch",
    name: "Test-Sponsor",
    flavor: "Test",
    components: [
      { componentId: "base-cash", kind: "base", label: "Basis-Saisonzahlung", targetValue: 0, rewardCash: 0 },
      { componentId: "rank-target", kind: "rank", label: "Gewinnstufen nach Endrang", targetValue: 1, rewardCash: 0 },
    ],
    totalUpsideEstimate: 0,
  };
}

/**
 * Ersetzt die Angebote EINES Teams durch die fuenf isolierten Kurvenformen bei festem `startRank`, ohne
 * Achse (`basis`-Karten) — damit bleibt der Achsen-Term auf allen fuenf Angeboten exakt 0, und nur Kurvenform-Passung und
 * Eco-Downside-Term koennen die Wahl entscheiden.
 */
function withIsolatedCurveOffers(base: GameState, teamId: string, startRank: number): GameState {
  const bareOffers = ISOLATED_SHAPES.map((shape, index) =>
    buildBareOffer({ teamId, seasonId: base.season.id, curveShape: shape, index }),
  );
  const offers = applySponsorV3ToOffers({
    gameState: base,
    offers: bareOffers,
    cardKeys: ISOLATED_SHAPES.map(() => "basis"),
    axisKeys: ISOLATED_SHAPES.map(() => null),
    curveShapes: ISOLATED_SHAPES,
    teamId,
    startRank,
  });
  return {
    ...base,
    seasonState: {
      ...base.seasonState,
      sponsorOffersByTeamId: {
        ...(base.seasonState.sponsorOffersByTeamId ?? {}),
        [teamId]: offers,
      },
      // Ambition auf die neutrale Mitte fixieren: die Ambitions-Verschiebung des Zielrangs
      // (resolveAmbitionTargetRank) soll den Test nicht mit einer zweiten Ursache vermischen.
      teamStrategyProfiles: {
        ...(base.seasonState.teamStrategyProfiles ?? {}),
        [teamId]: {
          ...(base.seasonState.teamStrategyProfiles?.[teamId] ?? { teamId }),
          bias: {
            ...(base.seasonState.teamStrategyProfiles?.[teamId]?.bias ?? {}),
            starPriority: 5,
          },
        },
      },
    },
  };
}

/** Setzt die Kasse des Teams — treibt sowohl `cashPressure` (sponsor-offer-service.ts) als auch die
 * Saison-Doktrin (`buildSeasonStrategyState` → `cash_recovery` bei Kasse < 0) in dieselbe Richtung. */
function withTeamCash(gameState: GameState, teamId: string, cash: number): GameState {
  return {
    ...gameState,
    teams: gameState.teams.map((team) => (team.teamId === teamId ? { ...team, cash } : team)),
  };
}

/**
 * Ein KI-Team mit ausreichendem Kader. `buildSeasonStrategyState` prueft `roster_repair` VOR
 * `cash_recovery` in der Doktrin-Kaskade (lib/ai/ai-manager-doctrine-service.ts) — ein Team mit Kader
 * unter `playerMin` bekommt also unabhaengig von der Kasse `roster_repair`, `strategy01` bliebe damit
 * 0 und der Test wuerde nichts pruefen. `createSingleplayerGameState()` gibt manchen KI-Teams absichtlich
 * duenne Kader; wir wollen hier gezielt eines MIT ausreichendem Kader, damit eine negative Kasse
 * tatsaechlich `cash_recovery` ausloest.
 */
function findWellStockedAiTeam(gameState: GameState) {
  return gameState.teams.find((team) => {
    if (team.humanControlled) return false;
    const rosterCount = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    const playerMin = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId)?.playerMin ?? 8;
    return rosterCount >= playerMin + 2;
  });
}

function bestBodenShape(gameState: GameState, teamId: string): SponsorCurveShape {
  const offers = gameState.seasonState.sponsorOffersByTeamId?.[teamId] ?? [];
  let best: { shape: SponsorCurveShape; boden: number } | null = null;
  for (const offer of offers) {
    const terms = getSponsorV3Terms(offer);
    if (!terms) continue;
    const boden = Math.min(...sponsorV3GuaranteedLadder(terms));
    if (!best || boden > best.boden) {
      best = { shape: offer.curveShape, boden };
    }
  }
  if (!best) throw new Error("kein Angebot mit V3-Konditionen gefunden");
  return best.shape;
}

describe("KI-Sponsorwahl: klamme Teams nehmen den Leiterboden", () => {
  it("zahlungsunfaehiges Mittelfeldteam nimmt die Karte mit dem hoechsten Boden", () => {
    const base = createSingleplayerGameState();
    const aiTeam = findWellStockedAiTeam(base);
    expect(aiTeam, "kein ausreichend besetztes KI-Team im Spielstand gefunden").toBeDefined();

    let gameState = withIsolatedCurveOffers(base, aiTeam!.teamId, 16);
    gameState = withTeamCash(gameState, aiTeam!.teamId, -50);

    const expectedShape = bestBodenShape(gameState, aiTeam!.teamId);

    const after = chooseSponsorOfferForAiTeams(gameState);
    const contract = getTeamSponsorContract(after, aiTeam!.teamId);
    expect(contract, "zahlungsunfaehiges Team ohne Vertrag").not.toBeNull();
    expect(
      contract!.curveShape,
      `erwartet die bestbodige Form "${expectedShape}", gewaehlt wurde "${contract!.curveShape}" —` +
        " genau der Fehlgriff, den der Eco-Downside-Term beheben soll.",
    ).toBe(expectedShape);
  });

  it("gesundes Team mit neutraler Strategie bleibt unberuehrt (ecoIntent01 == 0)", () => {
    const base = createSingleplayerGameState();
    const aiTeam = findWellStockedAiTeam(base);
    expect(aiTeam, "kein ausreichend besetztes KI-Team im Spielstand gefunden").toBeDefined();

    let gameState = withIsolatedCurveOffers(base, aiTeam!.teamId, 16);
    // Hohe Kasse UND eine Identitaet/Profil, die keine cash_recovery- oder eco_round-Doktrin ausloest —
    // nur unter dieser doppelten Bedingung ist `ecoIntent01` nach der vorgegebenen Formel
    // (`0,6 * strategy01 + 0,4 * pressure01`) exakt 0.
    gameState = withTeamCash(gameState, aiTeam!.teamId, 200);
    gameState = {
      ...gameState,
      teamIdentities: gameState.teamIdentities.map((identity) =>
        identity.teamId === aiTeam!.teamId ? { ...identity, finances: 5, ambition: 5 } : identity,
      ),
      seasonState: {
        ...gameState.seasonState,
        teamStrategyProfiles: {
          ...(gameState.seasonState.teamStrategyProfiles ?? {}),
          [aiTeam!.teamId]: {
            ...(gameState.seasonState.teamStrategyProfiles?.[aiTeam!.teamId] ?? { teamId: aiTeam!.teamId }),
            bias: {
              ...(gameState.seasonState.teamStrategyProfiles?.[aiTeam!.teamId]?.bias ?? {}),
              starPriority: 5,
              cashPriority: 5,
              valuePriority: 5,
            },
          },
        },
      },
    };

    // BEWEIS DER VORBEDINGUNG statt Verhalten zu erraten: `buildSeasonStrategyState` ist dieselbe
    // reine Funktion, aus der `chooseSponsorOfferForAiTeams` `strategy01` ableitet. Ist die Doktrin
    // hier weder `cash_recovery` noch `eco_round`, ist `strategy01 = 0`; mit Kasse >= 20 ist auch
    // `pressure01 = 0` (`cashPressure`-Bucket 3, siehe `sponsor-offer-service.ts`). Beides zusammen
    // macht `ecoIntent01` nach der vorgegebenen Formel exakt 0 — der neue Term-Zweig
    // (`if (terms && (input.ecoIntent01 ?? 0) > 0)`) wird dann gar nicht erst betreten, die Bewertung
    // ist bit-identisch zu der ohne diesen PR.
    const strategy = buildSeasonStrategyState(gameState)[aiTeam!.teamId]?.seasonStrategy;
    expect(strategy, "Doktrin muss fuer diesen Test neutral sein").not.toBe("cash_recovery");
    expect(strategy).not.toBe("eco_round");

    const after = chooseSponsorOfferForAiTeams(gameState);
    const contract = getTeamSponsorContract(after, aiTeam!.teamId);
    expect(contract, "gesundes Team ohne Vertrag").not.toBeNull();
    // Waere der Eco-Downside-Term trotz `ecoIntent01 == 0` wirksam, zoege er die Wahl in Richtung der
    // bodenstaerksten Familie ("sicherheit" — hier "klassenerhalt", siehe Test 1). Bei einem Team ohne
    // Sparabsicht bleibt die Wahl bei der Kurvenform-Passung (bestehender Term aus PR #366): fuer einen
    // Zielrang 16 zahlt "sicherheit" am besten im Abstiegskampf (25.-28.), nicht in der Tabellenmitte.
    expect(
      getSponsorCurveFamily(contract!.curveShape),
      `gesundes Team hat "${contract!.curveShape}" gewaehlt — die Sicherheits-Familie waere der Fehlgriff,` +
        " den ein leckender Eco-Term hier verursachen wuerde.",
    ).not.toBe("sicherheit");
  });
});

/** Minimale, gueltige V3-Konditionen fuer die Unit-Tests von `sponsorV3DownsideShortfall` — ohne den
 * Umweg ueber `buildSponsorV3TermsCore`, da nur `rankLadder`, `floor`, `startRank`, `goalP`/`goalSize`
 * fuer die gemessene Funktion ueberhaupt gelesen werden. */
function buildTestTerms(input: { rankLadder: number[]; startRank: number }): SponsorV3ContractTerms {
  return {
    version: 3,
    rankLadder: input.rankLadder,
    baseLadder: input.rankLadder,
    anchor: 0,
    tilt: 0,
    cardKey: "basis",
    cardName: "Basis",
    rarity: "magisch",
    startRank: input.startRank,
    goalKey: null,
    goalP: 0,
    goalSize: 0,
    salaryFactor: 1,
    floor: 0,
  };
}

describe("sponsorV3DownsideShortfall", () => {
  const startRank = 16;
  // Steile Leiter: linear von 100 (Platz 1) auf 0 (Platz 32) fallend. Die Anker-Gewichte
  // (`sponsorV3AnchorWeights`) sind eine um `startRank` symmetrische Normalverteilung — bei einer
  // LINEAREN Leiter hebt sich die Symmetrie exakt auf, der Erwartungswert liegt also am Wert bei
  // `startRank` selbst (Platz 16 → ca. 51,6).
  const steepLadder = Array.from({ length: SPONSOR_V3_RANKS }, (_, index) => 100 - (100 / (SPONSOR_V3_RANKS - 1)) * index);
  const steepTerms = buildTestTerms({ rankLadder: steepLadder, startRank });

  // Flache Leiter auf demselben Wert wie die steile Leiter bei `startRank` — nahezu derselbe
  // Erwartungswert, aber ohne jede Streuung um ihn herum.
  const flatValue = steepLadder[startRank - 1]!;
  const flatLadder = Array.from({ length: SPONSOR_V3_RANKS }, () => flatValue);
  const flatTerms = buildTestTerms({ rankLadder: flatLadder, startRank });

  it("ist nie negativ", () => {
    expect(sponsorV3DownsideShortfall(steepTerms)).toBeGreaterThanOrEqual(0);
    expect(sponsorV3DownsideShortfall(flatTerms)).toBeGreaterThanOrEqual(0);
  });

  it("ist fuer eine voellig flache Leiter exakt 0 — es gibt keine Abweichung vom eigenen EV", () => {
    expect(sponsorV3DownsideShortfall(flatTerms)).toBeCloseTo(0, 9);
  });

  it("ist fuer eine flache Leiter kleiner als fuer eine steile mit (nahezu) gleichem Erwartungswert", () => {
    expect(sponsorV3ExpectedPayout(flatTerms)).toBeCloseTo(sponsorV3ExpectedPayout(steepTerms), 1);
    expect(sponsorV3DownsideShortfall(flatTerms)).toBeLessThan(sponsorV3DownsideShortfall(steepTerms));
  });
});
