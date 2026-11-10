/**
 * DAS VERTRAGSMODELL RECHNET BEI LIGA-SPLIT MIT 16 SPROSSEN, NICHT MIT 32.
 *
 * PR #1377 hat die Sponsor-ANZEIGE auf 16 Teams umgestellt; das Vertragsmodell darunter baute aber
 * weiter 32er-Leitern. Bei aktivem Liga-Split zaehlen Start- und Endrang liga-lokal 1..16 — ein Team
 * landete damit nur auf den oberen 16 Sprossen einer 32-stufigen Kurve:
 *   - der Sockel erreichte auf Platz 16 nur die Mitte (statt des Max-Sockels),
 *   - Anker, Erwartungswert und Risiko waren ueber unerreichbare Raenge 17..32 gemittelt,
 *   - der Wertungstopf (60/40 je Liga) wurde ueber 32 Sprossen verteilt, von denen nur 16 zahlen,
 *   - die Abstiegszone des Zonen-Terms (letzte 3 Raenge = 30..32) wurde nie erreicht.
 *
 * Diese Datei haelt fest: bei Liga-Split deckt die Leiter genau 1..16 ab — inklusive Abstiegszone —,
 * bestehende 32er-Vertraege bleiben gueltig und rechnen unveraendert, und erst der Saisonwechsel
 * baut eine Mehrjahresleiter auf 16 Sprossen um.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SponsorCurveShape, SponsorOffer, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { LEAGUE_SIZE } from "@/lib/season/league-split";
import { SPONSOR_CURVE_SHAPE_KEYS, SPONSOR_CURVE_SHAPES, sponsorKurvenReferenz } from "@/lib/sponsor/sponsor-curve-shapes";
import {
  SPONSOR_BODEN,
  SPONSOR_SOCKEL_MAX,
  SPONSOR_SOCKEL_MIN,
  SPONSOR_TOPF_FAKTOR_JE_LIGA,
  SPONSOR_WERTUNGSTOPF,
  SPONSOR_ZONE_ABSTIEG_MALUS,
  sponsorKurvenLeiter,
  sponsorLigaLeiter,
  sponsorSockelFuerStartrang,
} from "@/lib/sponsor/sponsor-liga-leiter";
import {
  SPONSOR_V3_ANCHOR_SIGMA,
  buildSponsorV3TermsCore,
  sponsorV3AnchorSigmaFor,
  sponsorV3AnchorWeights,
  sponsorV3CardByKey,
  sponsorV3ExpectedPayout,
  sponsorV3IsMonotone,
  type SponsorV3ContractTerms,
} from "@/lib/sponsor/sponsor-v3-model";
import {
  buildSponsorV3Terms,
  getSponsorV3Terms,
  rerollSponsorV3TermsForNewSeason,
  sponsorV3EingefrorenerSockel,
  sponsorV3SettlementParts,
  sponsorV3WertFaktorFuerKarte,
} from "@/lib/sponsor/sponsor-v3-offer-service";
import { advanceSponsorContractsForNewSeason } from "@/lib/sponsor/sponsor-contract-lifecycle";

const sum = (values: readonly number[]) => values.reduce((acc, value) => acc + value, 0);

/** Minimaler Spielstand: Liga-Split aktiv (16 + 16), Saison mit Faktor 1. */
function splitGameState(extra: Partial<GameState["seasonState"]> = {}): GameState {
  const leagueByTeamId: Record<string, "liga1" | "liga2"> = {};
  for (let index = 1; index <= 32; index += 1) {
    leagueByTeamId[`T${index}`] = index <= 16 ? "liga1" : "liga2";
  }
  return {
    season: { id: "season-2" },
    teams: Object.keys(leagueByTeamId).map((teamId) => ({ teamId, name: teamId, shortCode: teamId })),
    players: [],
    rosters: [],
    seasonState: {
      leagueByTeamId,
      seasonEconomyFactors: [{ horizonIndex: 0, factor: 1 }],
      sponsorContractsByTeamId: {},
      sponsorOffersByTeamId: {},
      sponsorLeihgabenByTeamId: {},
      ...extra,
    },
  } as unknown as GameState;
}

/** Derselbe Spielstand OHNE Liga-Split (Legacy / Manager Mode). */
function legacyGameState(): GameState {
  const state = splitGameState();
  return { ...state, seasonState: { ...state.seasonState, leagueByTeamId: {} } } as GameState;
}

function offerFor(teamId: string, shape: SponsorCurveShape): SponsorOffer {
  return {
    offerId: `${teamId}-offer`,
    seasonId: "season-2",
    teamId,
    archetype: "cash",
    curveShape: shape,
    rarity: "magisch",
    components: [],
  } as unknown as SponsorOffer;
}

function baueVertrag(gameState: GameState, teamId: string, startRank: number, shape: SponsorCurveShape) {
  return buildSponsorV3Terms({
    gameState,
    offer: offerFor(teamId, shape),
    startRank,
    cardKey: "basis",
    curveShape: shape,
    teamId,
  });
}

describe("16er-Referenzkurven — flaechentreu aus den 32er-Formen abgeleitet", () => {
  it("bei 32 Plaetzen exakt die Original-Referenz, bei 16 der Mittelwert je Platzpaar", () => {
    for (const shape of SPONSOR_CURVE_SHAPE_KEYS) {
      const original = SPONSOR_CURVE_SHAPES[shape].reference;
      expect(sponsorKurvenReferenz(shape, 32)).toBe(original);
      const sechzehn = sponsorKurvenReferenz(shape, 16);
      expect(sechzehn).toHaveLength(16);
      sechzehn.forEach((wert, index) => {
        expect(wert).toBeCloseTo((original[2 * index]! + original[2 * index + 1]!) / 2, 10);
      });
    }
  });

  it("jede Form behaelt gleiche Flaeche (je Platz) und bleibt monoton nicht-steigend", () => {
    const flaechen = SPONSOR_CURVE_SHAPE_KEYS.map((shape) => sum(sponsorKurvenReferenz(shape, 16)) / 16);
    const original = SPONSOR_CURVE_SHAPE_KEYS.map((shape) => sum(SPONSOR_CURVE_SHAPES[shape].reference) / 32);
    flaechen.forEach((flaeche, index) => expect(flaeche).toBeCloseTo(original[index]!, 10));
    for (const shape of SPONSOR_CURVE_SHAPE_KEYS) {
      const kurve = sponsorKurvenReferenz(shape, 16);
      for (let index = 1; index < kurve.length; index += 1) {
        expect(kurve[index]!).toBeLessThanOrEqual(kurve[index - 1]! + 1e-9);
      }
    }
  });
});

describe("Anker-Sigma — proportional zum Rangraum", () => {
  it("32 Plaetze: unveraendert 4; 16 Plaetze: 2; die Gewichte decken genau 1..16 ab", () => {
    expect(sponsorV3AnchorSigmaFor(32)).toBe(SPONSOR_V3_ANCHOR_SIGMA);
    expect(sponsorV3AnchorSigmaFor(16)).toBe(SPONSOR_V3_ANCHOR_SIGMA / 2);
    const gewichte = sponsorV3AnchorWeights(16, undefined, 16);
    expect(gewichte).toHaveLength(16);
    expect(sum(gewichte)).toBeCloseTo(1, 12);
    // Ohne Sigma-Angabe bei 32 Raengen bit-identisch zum frueheren Default-Aufruf.
    expect(sponsorV3AnchorWeights(9)).toEqual(sponsorV3AnchorWeights(9, SPONSOR_V3_ANCHOR_SIGMA, 32));
  });
});

describe("sponsorKurvenLeiter mit leagueSize 16", () => {
  it("16 Sprossen, monoton, und jede Form trifft exakt den Anker der neutralen 16er-Leiter (EV-Neutralitaet)", () => {
    for (const leagueTier of ["liga1", "liga2"] as const) {
      for (const startRank of [1, 6, 11, 16]) {
        const gewichte = sponsorV3AnchorWeights(startRank, undefined, 16);
        // Zonen-Term rausrechnen: er wird nach der Ankernormierung aufgetragen.
        const neutral = sponsorLigaLeiter({ startRank, salaryFactor: 1, leagueSize: 16, leagueTier });
        const neutralOhneZone = sponsorLigaLeiter({ startRank, salaryFactor: 1, leagueSize: 16, leagueTier: undefined })
          .map((wert) => {
            const sockel = sponsorSockelFuerStartrang(startRank, 16);
            return sockel + (wert - sockel) * SPONSOR_TOPF_FAKTOR_JE_LIGA[leagueTier];
          });
        const zone = neutral.map((wert, index) => wert - neutralOhneZone[index]!);
        const anspruch = sum(neutralOhneZone.map((wert, index) => wert * gewichte[index]!));
        for (const shape of SPONSOR_CURVE_SHAPE_KEYS) {
          const leiter = sponsorKurvenLeiter({ shape, startRank, salaryFactor: 1, leagueTier, leagueSize: 16 });
          expect(leiter).toHaveLength(16);
          const ohneZone = leiter.map((wert, index) => wert - zone[index]!);
          expect(sum(ohneZone.map((wert, index) => wert * gewichte[index]!))).toBeCloseTo(anspruch, 9);
          for (let index = 1; index < leiter.length; index += 1) {
            expect(leiter[index]!).toBeLessThanOrEqual(leiter[index - 1]! + 1e-9);
          }
        }
      }
    }
  });

  it("der Sockel spannt die volle Liga: Startrang 1 → Min-Sockel, Startrang 16 → Max-Sockel", () => {
    expect(sponsorSockelFuerStartrang(1, 16)).toBeCloseTo(SPONSOR_SOCKEL_MIN, 12);
    expect(sponsorSockelFuerStartrang(16, 16)).toBeCloseTo(SPONSOR_SOCKEL_MAX, 12);
    // Vorher (32er-Rangraum) erreichte liga-lokal Platz 16 nur knapp die Mitte.
    expect(sponsorSockelFuerStartrang(16)).toBeLessThan((SPONSOR_SOCKEL_MIN + SPONSOR_SOCKEL_MAX) / 2);
  });

  it("der Wertungstopf ist ueber genau 16 Sprossen verteilt: beide Ligen zusammen ziehen den einen Topf", () => {
    const wertungsanteil = (leagueTier: "liga1" | "liga2") => {
      const sockel = sponsorSockelFuerStartrang(8, 16);
      const leiter = sponsorLigaLeiter({ startRank: 8, salaryFactor: 1, leagueSize: 16 });
      return sum(leiter.map((wert) => wert - sockel)) * SPONSOR_TOPF_FAKTOR_JE_LIGA[leagueTier];
    };
    expect(wertungsanteil("liga1") + wertungsanteil("liga2")).toBeCloseTo(SPONSOR_WERTUNGSTOPF, 9);
  });
});

describe("buildSponsorV3Terms — der Live-Pfad baut bei Liga-Split eine 16er-Leiter", () => {
  it("Split-Spielstand: 16 Sprossen; ohne Split (Legacy): unveraendert 32", () => {
    const split = baueVertrag(splitGameState(), "T3", 3, "titeljaeger");
    expect(split.rankLadder).toHaveLength(LEAGUE_SIZE);
    expect(split.baseLadder).toHaveLength(LEAGUE_SIZE);
    expect(sponsorV3IsMonotone(split)).toBe(true);
    expect(getSponsorV3Terms({ sponsorV3: split } as unknown as SponsorOffer)).toBe(split);

    const legacy = baueVertrag(legacyGameState(), "T3", 3, "titeljaeger");
    expect(legacy.rankLadder).toHaveLength(32);
  });

  it("ein Team erreicht die VOLLE Spanne 1..16 — inklusive Abstiegszone (Liga 1, Plaetze 14..16)", () => {
    const gameState = splitGameState();
    const vertrag = baueVertrag(gameState, "T16", 16, "mittelfeld");
    // Die Abstiegszone sitzt auf den letzten drei Plaetzen DER LIGA: Platz 14..16, nicht 30..32.
    const ohneZone = sponsorKurvenLeiter({ shape: "mittelfeld", startRank: 16, salaryFactor: 1, leagueSize: 16 })
      .map((wert) => {
        const sockel = sponsorSockelFuerStartrang(16, 16);
        return sockel + (wert - sockel) * SPONSOR_TOPF_FAKTOR_JE_LIGA.liga1;
      });
    const mitZone = sponsorKurvenLeiter({
      shape: "mittelfeld", startRank: 16, salaryFactor: 1, leagueSize: 16, leagueTier: "liga1",
    });
    for (let rank = 1; rank <= 16; rank += 1) {
      const differenz = mitZone[rank - 1]! - ohneZone[rank - 1]!;
      if (rank >= 14) expect(differenz).toBeCloseTo(-SPONSOR_ZONE_ABSTIEG_MALUS, 9);
      else expect(differenz).toBeCloseTo(0, 9);
    }

    // Platz 16 IST die letzte Sprosse: Saisonbasis == Auszahlung, kein Tabellenplatz-Anteil mehr.
    const teile = sponsorV3SettlementParts({ terms: vertrag, finalRank: 16, goalFraction: 0 });
    const basis = teile.find((teil) => teil.key === "base")!;
    const rang = teile.find((teil) => teil.key === "rank")!;
    expect(rang.cashDelta).toBe(0);
    expect(basis.cashDelta).toBeCloseTo(Math.round(Math.max(vertrag.floor, vertrag.rankLadder[15]!) * 10) / 10, 9);
    // Und Platz 1 zahlt den Titel — die Leiter steigt ueber die ganze Liga.
    expect(vertrag.rankLadder[0]!).toBeGreaterThan(vertrag.rankLadder[15]!);
  });

  it("der Erwartungswert ist nur ueber erreichbare Plaetze gemittelt", () => {
    const vertrag = baueVertrag(splitGameState(), "T16", 16, "stetig");
    const gewichte = sponsorV3AnchorWeights(16, undefined, 16);
    const ev = sum(vertrag.rankLadder.map((wert, index) => Math.max(vertrag.floor, wert) * gewichte[index]!));
    expect(sponsorV3ExpectedPayout(vertrag)).toBeCloseTo(ev, 9);
    // Der eingefrorene Sockel der Karte liest den Startrang im 16er-Rangraum (Max-Sockel auf Platz 16).
    expect(sponsorV3EingefrorenerSockel(vertrag)).toBeCloseTo(
      SPONSOR_SOCKEL_MAX * sponsorV3WertFaktorFuerKarte({ rarity: vertrag.rarity }),
      9,
    );
  });
});

describe("Bestandsvertraege — 32er-Leitern brechen nicht", () => {
  function terms32(startRank: number, shape: SponsorCurveShape): SponsorV3ContractTerms {
    return buildSponsorV3TermsCore({
      baseLadder: sponsorKurvenLeiter({ shape, startRank, salaryFactor: 1, leagueTier: "liga1" }),
      startRank,
      rarity: "magisch",
      card: sponsorV3CardByKey("basis"),
      goalKey: null,
      curveShape: shape,
      salaryFactor: 1,
      floor: SPONSOR_BODEN,
    });
  }

  it("getSponsorV3Terms nimmt 32 und 16 an, lehnt kaputte Laengen ab", () => {
    const alt = terms32(9, "europapokal");
    expect(getSponsorV3Terms({ sponsorV3: alt } as unknown as SponsorOffer)).toBe(alt);
    const kaputt = { ...alt, rankLadder: alt.rankLadder.slice(0, 31), baseLadder: alt.baseLadder.slice(0, 31) };
    expect(getSponsorV3Terms({ sponsorV3: kaputt } as unknown as SponsorOffer)).toBeNull();
    const gemischt = { ...alt, baseLadder: alt.baseLadder.slice(0, 16) };
    expect(getSponsorV3Terms({ sponsorV3: gemischt } as unknown as SponsorOffer)).toBeNull();
  });

  it("Reroll OHNE leagueSize (Gehaltsfaktor-Nachtrag, Vorschau) bleibt im Rangraum des Vertrags", () => {
    const alt = terms32(9, "europapokal");
    const gleich = rerollSponsorV3TermsForNewSeason(alt, { newSalaryFactor: 1, contractYear: 1, leagueTier: "liga1" });
    expect(gleich.rankLadder).toHaveLength(32);
    gleich.rankLadder.forEach((wert, index) => expect(wert).toBeCloseTo(alt.rankLadder[index]!, 9));
  });

  it("der Saisonwechsel baut eine 32er-Mehrjahresleiter im Split-Spielstand auf 16 Sprossen um", () => {
    const alt = terms32(14, "titeljaeger");
    const contract = {
      seasonId: "season-2",
      teamId: "T14",
      offerId: "offer-1",
      archetype: "cash",
      curveShape: "titeljaeger",
      name: "Testsponsor",
      chosenAt: "2026-10-01T00:00:00.000Z",
      startRank: 14,
      components: [],
      payouts: {},
      termSeasons: 3,
      seasonsRemaining: 3,
      sponsorV3: alt,
    } as unknown as TeamSponsorContract;
    const gameState = splitGameState({ sponsorContractsByTeamId: { T14: contract } });
    const next = advanceSponsorContractsForNewSeason(gameState, "season-3");
    const gerollt = next.seasonState.sponsorContractsByTeamId?.T14;
    const terms = getSponsorV3Terms(gerollt);
    expect(terms).not.toBeNull();
    expect(terms!.rankLadder).toHaveLength(16);
    expect(terms!.startRank).toBe(14);
    expect(gerollt!.lockedRankPayoutLadder).toHaveLength(16);
    expect(sponsorV3IsMonotone(terms!)).toBe(true);
    // Abstiegszone wirkt jetzt: Platz 14 (Zone) zahlt sichtbar weniger als Platz 13.
    expect(terms!.rankLadder[13]!).toBeLessThan(terms!.rankLadder[12]!);

    // Ohne Liga-Split rollt derselbe Vertrag wie bisher auf 32 Sprossen.
    const legacy = advanceSponsorContractsForNewSeason(
      { ...legacyGameState(), seasonState: { ...legacyGameState().seasonState, sponsorContractsByTeamId: { T14: contract } } } as GameState,
      "season-3",
    );
    expect(getSponsorV3Terms(legacy.seasonState.sponsorContractsByTeamId?.T14)!.rankLadder).toHaveLength(32);
  });

  it("Altvertrag ohne Kurvenform: eine 16er-Leiter wird skaliert statt verworfen", () => {
    const basis = sponsorKurvenLeiter({ shape: "stetig", startRank: 5, salaryFactor: 1, leagueSize: 16 });
    const alt = buildSponsorV3TermsCore({
      baseLadder: basis,
      startRank: 5,
      rarity: "magisch",
      card: sponsorV3CardByKey("basis"),
      goalKey: null,
      salaryFactor: 1,
      floor: SPONSOR_BODEN,
    });
    const gerollt = rerollSponsorV3TermsForNewSeason(alt, { newSalaryFactor: 1.2, contractYear: 2 });
    expect(gerollt.rankLadder).toHaveLength(16);
    expect(gerollt.salaryFactor).toBe(1.2);
    const sockel = sponsorSockelFuerStartrang(5, 16);
    gerollt.baseLadder.forEach((wert, index) => {
      expect(wert).toBeCloseTo(sockel + (alt.baseLadder[index]! - sockel) * 1.2, 9);
    });
  });
});
