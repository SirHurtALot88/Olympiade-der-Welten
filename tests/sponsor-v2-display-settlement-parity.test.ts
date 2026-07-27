/**
 * DIE INVARIANTE "ANZEIGE == SETTLEMENT", VERIFIZIERT STATT BEHAUPTET.
 *
 * Dieser Test stellt fuer DIESELBE Karte und DENSELBEN Endstand den ANGEZEIGTEN Betrag gegen den
 * TATSAECHLICH GEBUCHTEN und prueft auf Gleichheit. Laufen die beiden auseinander, ist das der
 * wichtigste Bug des ganzen Umbaus: der Spieler waehlt dann nach Zahlen, die es nicht gibt.
 *
 * Geprueft werden alle vier Bildschirme, die Sponsorgeld zeigen:
 *   1. Angebotskarte  — Gewinnstufen-Leiter (buildSponsorRankTierRows ueber
 *                       buildOfferRankPayoutLadderPreview) und der V2-Block des Presenters.
 *   2. Finanzen-Detail — buildFinancesViewModel, Summe UND Aufschluesselung.
 *   3. Finanzen-Ligatabelle — buildFinancesLeagueTable.
 *   4. Settlement — previewSponsorSettlement, die Zeilen, die spaeter gebucht werden.
 *
 * ES WIRD NICHT MIT DEM MODELL GEGEN DAS MODELL GEPRUEFT. Die Referenz ist immer die
 * Settlement-Zeile — also das, was `applySponsorSettlement` der Kasse gutschreibt.
 */
import { afterEach, describe, expect, it } from "vitest";

import type { GameState, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildFinancesViewModel } from "@/lib/foundation/finances/use-finances-view-model";
import type { FinanceSponsorIncome } from "@/lib/foundation/finances/finances-types";
import { buildFinancesLeagueTable } from "@/lib/foundation/finances/use-finances-league-table";
import { buildLockedRankPayoutLadder, buildOfferRankPayoutLadderPreview } from "@/lib/sponsor/sponsor-economy-calibration";
import { buildSponsorOffersForTeam, chooseSponsorOffer } from "@/lib/sponsor/sponsor-offer-service";
import { buildSponsorOfferPresentation, buildSponsorRankTierRows } from "@/lib/sponsor/sponsor-offer-presenter";
import { applySponsorSettlement, previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import {
  getSponsorV2Terms, resetSponsorV2KCache, stampSponsorSystemVersion,
} from "@/lib/sponsor/sponsor-v2-offer-service";

afterEach(() => { resetSponsorV2KCache(); });

/**
 * Ein Spielstand mit einem unterschriebenen Sponsorvertrag fuer `teamId` nach NEUEM Recht.
 */
function signedState(): { gameState: GameState; teamId: string; offerId: string } {
  const fresh = structuredClone(createSingleplayerGameState());
  const base = stampSponsorSystemVersion(fresh, 2);
  const teamId = base.teams[0]!.teamId;
  const offers = buildSponsorOffersForTeam({ gameState: base, teamId });
  const withOffers = {
    ...base,
    seasonState: {
      ...base.seasonState,
      sponsorOffersByTeamId: { ...(base.seasonState.sponsorOffersByTeamId ?? {}), [teamId]: offers },
    },
  } as GameState;
  const signed = chooseSponsorOffer({ gameState: withOffers, teamId, offerId: offers[0]!.offerId });
  expect(signed.contract, "Vertrag konnte nicht unterschrieben werden").not.toBeNull();
  return { gameState: signed.gameState, teamId, offerId: offers[0]!.offerId };
}

/** Die Sponsor-Einnahme, wie die Finanzen-Detailansicht sie zeigt. */
/**
 * EIN ECHTER ALTVERTRAG, wie er in einem vor der Umstellung angelegten Spielstand liegt: keine
 * `sponsorV2`-Konditionen, dafuer die alten Komponenten (Basis, Gewinnstufen, Tabellenziel,
 * Ueberperformance, Sonderziel) und die beim Unterschreiben eingefrorene Kurven-Rangleiter.
 *
 * Er wird hier von Hand gebaut und NICHT mehr erzeugt: die Erzeugung nach altem Recht ist entfernt,
 * es gibt sie also nicht mehr. Gemessen wurden 64 solcher Vertraege in der lokalen Datenbank (zwei
 * archivierte Spielstaende, alle mit termSeasons 1). Genau die muessen weiter laden, anzeigen und
 * abrechnen — dieser Test ist die Zusage dafuer.
 */
function legacySignedState(): { gameState: GameState; teamId: string } {
  const base = structuredClone(createSingleplayerGameState());
  const teamId = base.teams[0]!.teamId;
  const lockedRankPayoutLadder = buildLockedRankPayoutLadder({
    salaryFactor: 1,
    leagueMinSalary: 32,
    rarity: "magisch",
    curveShape: "aufsteiger",
    teamQualityRank: 12,
    isGolden: false,
  });
  const contract: TeamSponsorContract = {
    seasonId: base.season.id,
    teamId,
    offerId: `${base.season.id}:${teamId}:identity:1:0`,
    archetype: "identity",
    curveShape: "aufsteiger",
    rarity: "magisch",
    name: "Altvertrag Testmarke",
    chosenAt: new Date(0).toISOString(),
    startRank: 14,
    components: [
      { componentId: "base-cash", kind: "base", label: "Basis-Saisonzahlung", targetValue: 42.9, rewardCash: 42.9 },
      { componentId: "rank-target", kind: "rank", label: "Gewinnstufen", targetValue: 12, rewardCash: 6.9, penaltyCash: 0.3 },
      {
        componentId: "improvement-target", kind: "improvement", label: "+1.5 C je verbessertem Platz · max 6",
        targetValue: 1, rewardCash: 9, ratePerUnitC: 1.5, maxUnits: 6,
      },
      {
        componentId: "overperformance", kind: "overperformance", label: "+0.6 C je Platz über Erwartungsrang #12 · max 5 C",
        targetValue: 12, rewardCash: 5, ratePerUnitC: 0.6,
      },
      {
        componentId: "special-fan-infrastructure", kind: "special", label: "Fan-Infrastruktur (Fan-Shop / Arena)",
        targetValue: 1, rewardCash: 2.5, specialKey: "fan_infrastructure",
      },
    ],
    payouts: {},
    commercialRating: 21,
    sponsorBrandId: "bertelsmann-content:regional_fan",
    sponsorParentBrandId: "bertelsmann-content",
    variantKey: "regional_fan",
    termSeasons: 1,
    seasonsRemaining: 1,
    demandProfile: "balanced",
    teamQualityRankAtSign: 12,
    lockedRankPayoutLadder,
    salaryFactorAtSign: 1,
  };
  return {
    gameState: {
      ...base,
      seasonState: {
        ...base.seasonState,
        sponsorContractsByTeamId: { ...(base.seasonState.sponsorContractsByTeamId ?? {}), [teamId]: contract },
      },
    } as GameState,
    teamId,
  };
}

function shownSponsor(gameState: GameState, teamId: string): FinanceSponsorIncome {
  const vm = buildFinancesViewModel(gameState, teamId);
  expect(vm.status, "Finanzen-ViewModel nicht bereit").toBe("ready");
  const sponsor = vm.status === "ready" ? vm.team.income.sponsor : null;
  expect(sponsor ?? null, "Finanzen zeigen keinen Sponsor").not.toBeNull();
  return sponsor!;
}

/** Der Betrag, den das Settlement diesem Team gutschreibt. */
function settledSponsorTotal(gameState: GameState, teamId: string): number {
  return previewSponsorSettlement(gameState, "season_end").rows
    .filter((r) => r.teamId === teamId)
    .reduce((a, r) => a + r.cashDelta, 0);
}

describe("ANZEIGE == SETTLEMENT im neuen Sponsorsystem", () => {
  it("Angebotskarte: jede angezeigte Gewinnstufe ist der Betrag, aus dem spaeter gezahlt wird", { timeout: 180_000 }, () => {
    const { gameState, teamId, offerId } = signedState();
    const offer = (gameState.seasonState.sponsorOffersByTeamId?.[teamId] ?? []).find((o) => o.offerId === offerId)!;
    const contract = gameState.seasonState.sponsorContractsByTeamId![teamId]!;
    const terms = getSponsorV2Terms(contract)!;
    // Die Karte zeigt die Stufen aus der Preview-Leiter …
    const preview = buildOfferRankPayoutLadderPreview(gameState, offer);
    const baseCash = offer.components.find((c) => c.kind === "base")?.rewardCash ?? 0;
    const shown = buildSponsorRankTierRows({ baseCash, rankLadder: preview, includeFloorRung: true });
    // … und der Vertrag zahlt aus der EINGEFRORENEN Leiter. Beide muessen dieselbe sein.
    expect(contract.lockedRankPayoutLadder).toBeDefined();
    contract.lockedRankPayoutLadder!.forEach((v, i) => expect(v).toBeCloseTo(preview[i]!, 9));
    // Und jede angezeigte Sprosse ist der Leiterwert an ihrem Rang.
    for (const row of shown) {
      const idx = Math.min(32, Math.max(1, row.rankAt)) - 1;
      expect(row.absolutePayout, `Sprosse "${row.label}"`).toBeCloseTo(Math.round(preview[idx]! * 10) / 10, 1);
    }
    expect(terms.rankLadder).toHaveLength(32);
  });

  it("Presenter-V2-Block: Untergrenze, Klausel und Sonderziel sind die Settlement-Betraege", { timeout: 180_000 }, () => {
    const { gameState, teamId, offerId } = signedState();
    const offer = (gameState.seasonState.sponsorOffersByTeamId?.[teamId] ?? []).find((o) => o.offerId === offerId)!;
    const v2 = buildSponsorOfferPresentation({ offer, gameState, teamId }).v2;
    expect(v2, "V2-Block fehlt in der Anzeige").not.toBeNull();
    const rows = previewSponsorSettlement(gameState, "season_end").rows.filter((r) => r.teamId === teamId);
    const baseRow = rows.find((r) => r.componentId.endsWith(":v2:base"))!;
    // Die angezeigte Untergrenze ist EXAKT die gebuchte Saisonbasis.
    expect(v2!.guaranteedFloor).toBeCloseTo(baseRow.cashDelta, 1);
    // Klausel und Sonderziel sind mit Bonus UND Malus ausgewiesen — kein Betrag ohne Bedingung.
    expect(v2!.clause.bonus).toBeGreaterThan(0);
    expect(v2!.clause.malus).toBeGreaterThan(0);
    expect(v2!.clause.thresholdText.length).toBeGreaterThan(0);
    expect(v2!.goal.payout).toBeGreaterThan(0);
    expect(["Leicht", "Mittel", "Hart"]).toContain(v2!.goal.difficultyLabel);
    // Die Spanne muss die tatsaechlich gebuchte Summe einschliessen.
    const booked = rows.reduce((a, r) => a + r.cashDelta, 0);
    expect(booked).toBeGreaterThanOrEqual(v2!.minPayout - 0.2);
    expect(booked).toBeLessThanOrEqual(v2!.maxPayout + 0.2);
  });

  it("Finanzen-Detail: Summe UND Aufschluesselung stimmen mit den Settlement-Zeilen ueberein", { timeout: 180_000 }, () => {
    const { gameState, teamId } = signedState();
    const settled = settledSponsorTotal(gameState, teamId);
    const sponsor = shownSponsor(gameState, teamId);
    expect(sponsor.total).toBeCloseTo(Math.round(settled * 10) / 10, 1);
    expect(sponsor.totalIsEstimate).toBe(false);
    // Die Aufschluesselung summiert sich auf denselben Betrag …
    const breakdown = sponsor.components.reduce((a, c) => a + c.rewardCash, 0);
    expect(breakdown).toBeCloseTo(sponsor.total, 1);
    // … und traegt die ECHTEN V2-Etiketten, nicht das gruppierte "Sonderziel" fuer Klausel+Ziel.
    const labels = sponsor.components.map((c) => c.label);
    const positiveRows = previewSponsorSettlement(gameState, "season_end").rows
      .filter((r) => r.teamId === teamId && r.cashDelta > 0);
    expect(labels).toEqual(positiveRows.map((r) => r.label));
  });

  it("Finanzen-Ligatabelle: dieselbe Sponsorsumme wie die Detailansicht und wie das Settlement", { timeout: 180_000 }, () => {
    const { gameState, teamId } = signedState();
    const settled = settledSponsorTotal(gameState, teamId);
    // Die Ligatabelle weist Sponsor nicht einzeln aus, sondern als `incomeAnnual = Sponsor +
    // Gebaeude-Einnahmen`. Geprueft wird deshalb genau diese Zerlegung gegen die Detailansicht —
    // dieselbe Paritaet, die tests/finances-league-table-sponsor-parity.test.ts fuer V1 sichert.
    const vm = buildFinancesViewModel(gameState, teamId);
    const detailSponsor = vm.status === "ready" ? (vm.team.income.sponsor?.total ?? 0) : 0;
    const detailFacility = vm.status === "ready" ? (vm.team.income.facilityIncome?.total ?? 0) : 0;
    const tableRow = buildFinancesLeagueTable(gameState).find((r) => r.teamId === teamId)!;
    expect(detailSponsor).toBeCloseTo(Math.round(settled * 10) / 10, 1);
    expect(tableRow.incomeAnnual).toBeCloseTo(Math.round((detailSponsor + detailFacility) * 10) / 10, 1);
  });

  it("GEBUCHT == ANGEZEIGT: die Kasse aendert sich um genau den angezeigten Betrag", { timeout: 180_000 }, () => {
    const { gameState, teamId } = signedState();
    const shownInFinances = shownSponsor(gameState, teamId).total;
    const cashBefore = gameState.teams.find((t) => t.teamId === teamId)!.cash;
    // Ohne Gehaltsabzug abrechnen — geprueft wird die SPONSOR-Buchung, nicht die Gehaltsseite.
    const applied = applySponsorSettlement({
      gameState, saveId: "parity-test", phase: "season_end", execute: true, deductSalary: false,
    });
    const cashAfter = applied.gameState.teams.find((t) => t.teamId === teamId)!.cash;
    expect(cashAfter - cashBefore).toBeCloseTo(shownInFinances, 1);
  });

  it("REGRESSION: ein ALTVERTRAG zeigt und bucht unveraendert die alten Betraege", { timeout: 180_000 }, () => {
    const legacy = (() => {
      const { gameState, teamId } = legacySignedState();
      const vm = buildFinancesViewModel(gameState, teamId);
      const sponsor = vm.status === "ready" ? (vm.team.income.sponsor?.total ?? 0) : 0;
      const facility = vm.status === "ready" ? (vm.team.income.facilityIncome?.total ?? 0) : 0;
      return {
        settled: settledSponsorTotal(gameState, teamId),
        detail: sponsor,
        table: buildFinancesLeagueTable(gameState).find((r) => r.teamId === teamId)?.incomeAnnual ?? 0,
        facility,
        hasV2: getSponsorV2Terms(gameState.seasonState.sponsorContractsByTeamId![teamId]!) != null,
        presenterV2: null as unknown,
      };
    })();
    expect(legacy.hasV2, "ein Altvertrag darf keine V2-Konditionen tragen").toBe(false);
    expect(legacy.settled, "der Altvertrag rechnet gar nicht mehr ab").toBeGreaterThan(0);
    expect(legacy.detail).toBeCloseTo(Math.round(legacy.settled * 10) / 10, 1);
    expect(legacy.table).toBeCloseTo(Math.round((legacy.detail + legacy.facility) * 10) / 10, 1);
  });
});
