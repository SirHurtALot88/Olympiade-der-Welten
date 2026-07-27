/**
 * P4/P5 — OLY_SPONSOR_V2 hinter dem Flag: Angebotserzeugung, Anzeige-Invariante, Settlement
 * und die Regression, dass BESTANDSVERTRAEGE unveraendert nach altem Recht abgerechnet werden.
 */
import { afterEach, describe, expect, it } from "vitest";

import type { GameState, SponsorOfferComponent, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { buildSponsorOffersForTeam, chooseSponsorOffer } from "@/lib/sponsor/sponsor-offer-service";
import { buildOfferRankPayoutLadderPreview, estimateExpectedPayout } from "@/lib/sponsor/sponsor-economy-calibration";
import { buildSponsorRankTierRows } from "@/lib/sponsor/sponsor-offer-presenter";
import {
  getSponsorV2Terms, isSponsorV2Enabled, resetSponsorV2KCache, sponsorV2GuaranteedLadder,
  sponsorV2Settle, sponsorV2SettlementParts,
} from "@/lib/sponsor/sponsor-v2-offer-service";

const withFlag = <T,>(value: "1" | undefined, fn: () => T): T => {
  const before = process.env.OLY_SPONSOR_V2;
  if (value === undefined) delete process.env.OLY_SPONSOR_V2; else process.env.OLY_SPONSOR_V2 = value;
  try { return fn(); } finally {
    if (before === undefined) delete process.env.OLY_SPONSOR_V2; else process.env.OLY_SPONSOR_V2 = before;
  }
};

afterEach(() => { resetSponsorV2KCache(); });

const firstTeamId = (gs: GameState) => gs.teams[0]!.teamId;

describe("sponsor v2 — Flag", () => {
  it("ist per Default AUS", () => {
    withFlag(undefined, () => expect(isSponsorV2Enabled()).toBe(false));
    withFlag("1", () => expect(isSponsorV2Enabled()).toBe(true));
  });

  it("ohne Flag traegt kein Angebot V2-Konditionen", { timeout: 120_000 }, () => {
    const gs = structuredClone(createSingleplayerGameState());
    const offers = withFlag(undefined, () => buildSponsorOffersForTeam({ gameState: gs, teamId: firstTeamId(gs) }));
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => getSponsorV2Terms(o) === null)).toBe(true);
  });
});

describe("sponsor v2 — Angebotserzeugung hinter dem Flag", () => {
  it("jedes Angebot traegt vollstaendige Konditionen", { timeout: 120_000 }, () => {
    const gs = structuredClone(createSingleplayerGameState());
    const offers = withFlag("1", () => buildSponsorOffersForTeam({ gameState: gs, teamId: firstTeamId(gs) }));
    expect(offers.length).toBeGreaterThan(1);
    for (const offer of offers) {
      const terms = getSponsorV2Terms(offer);
      expect(terms, `Angebot ${offer.offerId} ohne V2-Konditionen`).not.toBeNull();
      expect(terms!.rankLadder).toHaveLength(32);
      expect(terms!.rankLadder.every((v) => Number.isFinite(v))).toBe(true);
      expect(terms!.k).toBeGreaterThan(0);
      expect(terms!.clauseBonus).toBeGreaterThan(0);
      expect(terms!.clauseMalus).toBeGreaterThan(0);
      expect(terms!.goalPayout).toBeGreaterThan(0);
      // Sonderziel NACH SCHWIERIGKEIT bepreist: die Wahrscheinlichkeit liegt im bepreisbaren Band.
      expect(terms!.goalProbability).toBeGreaterThanOrEqual(0.15);
      expect(terms!.goalProbability).toBeLessThanOrEqual(0.72);
    }
  });

  it("ANGEBOTSREGEL: keine zwei gleichen Kurvenformen in einer Liste", { timeout: 120_000 }, () => {
    const gs = structuredClone(createSingleplayerGameState());
    // Ueber mehrere Teams pruefen — die Regel muss fuer jede erzeugte Liste halten, nicht nur fuer
    // eine gluecklich gezogene. Genau bei Paaren mit DERSELBEN Kurve sind frueher Fallen entstanden.
    for (const team of gs.teams.slice(0, 8)) {
      const offers = withFlag("1", () => buildSponsorOffersForTeam({ gameState: gs, teamId: team.teamId }));
      const curves = offers.map((o) => getSponsorV2Terms(o)!.curveName);
      expect(new Set(curves).size, `${team.teamId}: ${curves.join(", ")}`).toBe(curves.length);
    }
  });

  it("die KI bewertet V2-Angebote mit V2-Logik statt mit V1-Heuristik", { timeout: 120_000 }, () => {
    const gs = structuredClone(createSingleplayerGameState());
    const offers = withFlag("1", () => buildSponsorOffersForTeam({ gameState: gs, teamId: firstTeamId(gs) }));
    const evs = offers.map((o) => estimateExpectedPayout(o, 8));
    expect(evs.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
    // EV-PARITAET innerhalb einer Rarity: gleiche Rarity ⇒ praktisch gleicher Erwartungswert.
    // Ueber Rarities hinweg darf und soll er sich unterscheiden — das IST die Rarity-Achse.
    const byRarity = new Map<string, number[]>();
    offers.forEach((o, i) => {
      const key = getSponsorV2Terms(o)!.rarity;
      byRarity.set(key, [...(byRarity.get(key) ?? []), evs[i]!]);
    });
    for (const [rarity, list] of byRarity) {
      if (list.length < 2) continue;
      const spread = Math.max(...list) / Math.min(...list) - 1;
      expect(spread, `EV-Spread innerhalb ${rarity}: ${(spread * 100).toFixed(1)} %`).toBeLessThan(0.08);
    }
  });
});

describe("sponsor v2 — Anzeige == Settlement", () => {
  it("die angezeigte Gewinnstufen-Leiter ist zeichengleich die garantierte Settlement-Leiter", { timeout: 120_000 }, () => {
    const gs = structuredClone(createSingleplayerGameState());
    const offers = withFlag("1", () => buildSponsorOffersForTeam({ gameState: gs, teamId: firstTeamId(gs) }));
    const offer = offers[0]!;
    const terms = getSponsorV2Terms(offer)!;
    // 1) Die Preview-Leiter (Karte UND Sign lesen dieselbe Funktion) ist die V2-Leiter.
    const preview = buildOfferRankPayoutLadderPreview(gs, offer);
    const guaranteed = sponsorV2GuaranteedLadder(terms);
    preview.forEach((v, i) => expect(v).toBeCloseTo(guaranteed[i]!, 9));
    // 2) Die in der Karte gezeigten Stufen ergeben genau die Leiter-Werte.
    const baseCash = offer.components.find((c) => c.kind === "base")?.rewardCash ?? 0;
    const rows = buildSponsorRankTierRows({ baseCash, rankLadder: preview });
    for (const row of rows) {
      const atRank = guaranteed[Math.min(32, Math.max(1, row.rankAt)) - 1]!;
      expect(row.absolutePayout).toBeCloseTo(Math.round(atRank * 10) / 10, 1);
    }
  });

  it("die vier Settlement-Zeilen summieren sich exakt auf den Modellwert", { timeout: 120_000 }, () => {
    const gs = structuredClone(createSingleplayerGameState());
    const offers = withFlag("1", () => buildSponsorOffersForTeam({ gameState: gs, teamId: firstTeamId(gs) }));
    const terms = getSponsorV2Terms(offers[0]!)!;
    for (const finalRank of [1, 4, 9, 16, 23, 28, 32]) {
      for (const clauseMet of [true, false]) {
        for (const goalFraction of [0, 0.4, 1]) {
          const parts = sponsorV2SettlementParts({
            terms, finalRank, clauseMet, clauseAssumed: false, clauseMetric: 3, goalFraction,
          });
          const sum = parts.reduce((a, p) => a + p.cashDelta, 0);
          expect(sum).toBeCloseTo(Math.round(sponsorV2Settle(terms, finalRank, clauseMet, goalFraction) * 10) / 10, 0);
        }
      }
    }
  });

  it("die Auszahlung ist ueber alle Endraenge monoton nicht-fallend", { timeout: 120_000 }, () => {
    const gs = structuredClone(createSingleplayerGameState());
    const offers = withFlag("1", () => buildSponsorOffersForTeam({ gameState: gs, teamId: firstTeamId(gs) }));
    for (const offer of offers) {
      const terms = getSponsorV2Terms(offer)!;
      for (const clauseMet of [true, false]) {
        for (const goalFraction of [0, 1]) {
          const ladder = Array.from({ length: 32 }, (_, i) => sponsorV2Settle(terms, i + 1, clauseMet, goalFraction));
          for (let r = 1; r < 32; r += 1) {
            expect(ladder[r]!, `${terms.curveName}: Rang ${r + 1} zahlt mehr als Rang ${r}`)
              .toBeLessThanOrEqual(ladder[r - 1]! + 1e-6);
          }
        }
      }
    }
  });
});

describe("sponsor v2 — Settlement und Bestandsvertraege", () => {
  it("ein unterschriebener V2-Vertrag wird ueber die V2-Zeilen abgerechnet", { timeout: 180_000 }, () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = firstTeamId(gs);
    const result = withFlag("1", () => {
      const withOffers = {
        ...gs,
        seasonState: {
          ...gs.seasonState,
          sponsorOffersByTeamId: {
            ...(gs.seasonState.sponsorOffersByTeamId ?? {}),
            [teamId]: buildSponsorOffersForTeam({ gameState: gs, teamId }),
          },
        },
      } as GameState;
      const offerId = withOffers.seasonState.sponsorOffersByTeamId![teamId]![0]!.offerId;
      const signed = chooseSponsorOffer({ gameState: withOffers, teamId, offerId });
      return previewSponsorSettlement(signed.gameState, "season_end").rows.filter((r) => r.teamId === teamId);
    });
    const ids = result.map((r) => r.componentId);
    expect(ids.some((id) => id.includes(":v2:base"))).toBe(true);
    expect(ids.some((id) => id.includes(":v2:rank"))).toBe(true);
    expect(ids.some((id) => id.includes(":v2:clause"))).toBe(true);
    expect(ids.some((id) => id.includes(":v2:special"))).toBe(true);
    // Die Basis ist garantiert und muss immer fliessen.
    expect(result.find((r) => r.componentId.includes(":v2:base"))!.cashDelta).toBeGreaterThan(0);
  });

  it("REGRESSION: ein Bestandsvertrag ohne V2-Konditionen zahlt mit Flag AN exakt wie mit Flag AUS", { timeout: 180_000 }, () => {
    const teamId = firstTeamId(createSingleplayerGameState());
    const legacyComponents: SponsorOfferComponent[] = [
      { componentId: "legacy-base", kind: "base", label: "Basis", targetValue: 0, rewardCash: 40 },
      { componentId: "legacy-rank", kind: "rank", label: "Tabellenplatz", targetValue: 8, rewardCash: 18 },
      { componentId: "legacy-special", kind: "special", label: "Sonderziel", targetValue: 1, rewardCash: 12,
        specialKey: "fan_infrastructure" },
    ];
    const build = (): GameState => {
      const gs = structuredClone(createSingleplayerGameState());
      const contract: TeamSponsorContract = {
        seasonId: gs.season.id, teamId, offerId: "legacy-offer", archetype: "security",
        curveShape: "sicherheit", rarity: "magisch", name: "Bestandsvertrag",
        chosenAt: new Date().toISOString(), startRank: 16, components: legacyComponents,
        payouts: {}, teamQualityRankAtSign: 16,
        lockedRankPayoutLadder: Array.from({ length: 32 }, (_, i) => 80 - i),
        salaryFactorAtSign: 1,
      };
      gs.seasonState.sponsorContractsByTeamId = {
        ...(gs.seasonState.sponsorContractsByTeamId ?? {}), [teamId]: contract,
      };
      return gs;
    };
    const rowsOff = withFlag(undefined, () => previewSponsorSettlement(build(), "season_end").rows.filter((r) => r.teamId === teamId));
    const rowsOn = withFlag("1", () => previewSponsorSettlement(build(), "season_end").rows.filter((r) => r.teamId === teamId));
    expect(rowsOn.length).toBe(rowsOff.length);
    expect(rowsOn.map((r) => [r.componentId, r.kind, r.status, r.cashDelta]))
      .toEqual(rowsOff.map((r) => [r.componentId, r.kind, r.status, r.cashDelta]));
    // Und der Bestandsvertrag laeuft wirklich ueber den ALTEN Pfad, nicht zufaellig ueber den neuen.
    expect(rowsOn.every((r) => !r.componentId.includes(":v2:"))).toBe(true);
    expect(rowsOn.reduce((a, r) => a + r.cashDelta, 0)).toBeGreaterThan(0);
  });
});
