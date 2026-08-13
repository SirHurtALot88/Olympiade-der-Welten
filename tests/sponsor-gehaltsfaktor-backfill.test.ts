/**
 * DER GEHALTSFAKTOR GILT FUER JEDEN LAUFENDEN SPONSORVERTRAG.
 *
 * Chris: „ja salary factor muss bei allen sponsoren standardmäßig berücksichtigt werden."
 *
 * GEMESSENE LUECKE (Live-Abbild `pc.sqlite`, Save `new-game-1785823388048-1hf25q`, Saison 2,
 * Saisonfaktor 1,19): 10 von 32 Vertraegen standen auf 1,00. Alle zehn stammten vom 04.08. und
 * tragen deshalb keine `curveShape`; der Saisonwechsel am 08.08. lief mit einem Stand, in dem
 * `rerollSponsorV3TermsForNewSeason` fuer genau diesen Fall die eingefrorene Leiter unveraendert
 * zurueckgab. Den Faktor bekommt eine Leiter nur bei Unterschrift und beim Saisonwechsel — faellt
 * beides aus, sitzt der Vertrag die ganze Saison auf dem alten Faktor und wird auch so ausgezahlt.
 *
 * Geprueft wird an ZAHLEN, nicht an Quelltext: dass die Leiter sich bewegt, in welche Richtung, um
 * wie viel — und dass ein zweiter Durchlauf nichts weiter bewegt.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SponsorCurveShape, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { advanceSponsorContractsForNewSeason } from "@/lib/sponsor/sponsor-contract-lifecycle";
import { vertragsjahrAus } from "@/lib/sponsor/sponsor-leih-lifecycle";
import {
  SPONSOR_BODEN,
  sponsorKurvenLeiter,
  sponsorLigaLeiter,
  sponsorSockelFuerStartrang,
} from "@/lib/sponsor/sponsor-liga-leiter";
import { applySponsorSalaryFactorOfCurrentSeason } from "@/lib/sponsor/sponsor-salary-factor-backfill";
import {
  buildSponsorV3TermsCore,
  sponsorV3CardByKey,
  sponsorV3GuaranteedLadder,
  sponsorV3LadderValue,
  type SponsorV3ContractTerms,
} from "@/lib/sponsor/sponsor-v3-model";
import { rerollSponsorV3TermsForNewSeason } from "@/lib/sponsor/sponsor-v3-offer-service";

const SHAPE: SponsorCurveShape = "titeljaeger";
const START_RANK = 16;

/** Eingefrorene V3-Konditionen wie bei einer Unterschrift — reine Funktion, ohne GameState. */
function baueTerms(input: {
  startRank: number;
  salaryFactor: number;
  shape?: SponsorCurveShape | null;
}): SponsorV3ContractTerms {
  const shape = input.shape === null ? undefined : (input.shape ?? SHAPE);
  const baseLadder = sponsorKurvenLeiter({
    shape: shape ?? SHAPE,
    startRank: input.startRank,
    salaryFactor: input.salaryFactor,
  });
  const terms = buildSponsorV3TermsCore({
    baseLadder,
    startRank: input.startRank,
    rarity: "magisch",
    card: sponsorV3CardByKey("basis"),
    goalKey: null,
    ...(shape ? { curveShape: shape } : {}),
    salaryFactor: input.salaryFactor,
    floor: SPONSOR_BODEN,
  });
  // ALTVERTRAG: die Vertraege vom 04.08. tragen keine Kurvenform. `buildSponsorV3TermsCore` setzt
  // das Feld nur, wenn es hereingereicht wird — hier wird es zur Sicherheit entfernt, damit der
  // Testfall genau der gemessene ist und nicht von einem Vorgabewert abhaengt.
  if (!shape) {
    const { curveShape: _ohne, ...rest } = terms as SponsorV3ContractTerms & { curveShape?: SponsorCurveShape };
    return rest as SponsorV3ContractTerms;
  }
  return terms;
}

function baueSpielstand(input: {
  seasonFactor: number;
  terms: SponsorV3ContractTerms;
  termSeasons?: 1 | 2 | 3;
  seasonsRemaining?: number;
  abgerechnet?: boolean;
  endrang?: number;
}): GameState {
  const contract: TeamSponsorContract = {
    seasonId: "season-2",
    teamId: "Z-H",
    offerId: "angebot-1",
    archetype: "identity",
    name: "Testsponsor",
    chosenAt: "2026-08-04T06:03:11.862Z",
    startRank: input.terms.startRank,
    components: [],
    payouts: {},
    termSeasons: input.termSeasons ?? 2,
    seasonsRemaining: input.seasonsRemaining ?? 1,
    sponsorV3: input.terms,
    lockedRankPayoutLadder: sponsorV3GuaranteedLadder(input.terms),
  } as unknown as TeamSponsorContract;

  return {
    season: { id: "season-2" },
    teams: [{ teamId: "Z-H", name: "Zero Hour", shortCode: "Z-H", cash: 60 }],
    seasonState: {
      seasonId: "season-2",
      seasonEconomyFactors: [{ seasonId: "season-2", horizonIndex: 0, factor: input.seasonFactor }],
      standings: { "Z-H": { rank: input.endrang ?? 1 } },
      sponsorContractsByTeamId: { "Z-H": contract },
      sponsorOffersByTeamId: {},
      sponsorPayoutLogs: input.abgerechnet
        ? [{ logId: "log-1", seasonId: "season-2", teamId: "Z-H", phase: "season_end", componentId: "x", cashDelta: 93.1 }]
        : [],
    },
  } as unknown as GameState;
}

/**
 * DIE RICHTUNG DES FAKTORS, an Zahlen festgenagelt, damit niemand den Backfill verkehrt herum baut.
 * `topf = SPONSOR_WERTUNGSTOPF * salaryFactor` (sponsor-liga-leiter.ts): ein hoeherer Faktor ist MEHR
 * Geld, und er hebt ausschliesslich den Wertungsanteil OBERHALB des Sockels.
 *
 * Der DREHPUNKT ist immer der Sockel — aber nur in der NEUTRALEN Leiter faellt der letzte Rang mit
 * ihm zusammen (Rang 32 hat im Wertungstopf das Gewicht 0). Eine geshapete Leiter legt auch auf
 * Rang 32 noch etwas ab (`leiter[i] = sockel + c·ref[i]`, ref[31] > 0), deshalb steigt dort mit dem
 * Faktor ebenfalls etwas — nur viel weniger als an der Spitze. Beides steht hier nebeneinander,
 * damit niemand die eine Aussage fuer die andere haelt.
 */
describe("Richtung des Gehaltsfaktors", () => {
  it("neutrale Leiter: hoeherer Faktor hebt die Spitze, Rang 32 bleibt exakt auf dem Sockel stehen", () => {
    const bei100 = sponsorLigaLeiter({ startRank: START_RANK, salaryFactor: 1.0 });
    const bei119 = sponsorLigaLeiter({ startRank: START_RANK, salaryFactor: 1.19 });

    expect(bei119[0]!).toBeGreaterThan(bei100[0]!);
    expect(bei100[0]!).toBeCloseTo(118.5, 1);
    expect(bei119[0]!).toBeCloseTo(134.2, 1);
    expect(bei119[31]!).toBeCloseTo(bei100[31]!, 6);
    expect(bei119[31]!).toBeCloseTo(sponsorSockelFuerStartrang(START_RANK), 6);
  });

  it("geshapete Leiter: die Spitze legt vielfach mehr zu als das Tabellenende", () => {
    const bei100 = sponsorKurvenLeiter({ shape: SHAPE, startRank: START_RANK, salaryFactor: 1.0 });
    const bei119 = sponsorKurvenLeiter({ shape: SHAPE, startRank: START_RANK, salaryFactor: 1.19 });

    const obenPlus = bei119[0]! - bei100[0]!;
    const untenPlus = bei119[31]! - bei100[31]!;
    expect(obenPlus).toBeGreaterThan(0);
    expect(untenPlus).toBeGreaterThan(0);
    expect(obenPlus).toBeGreaterThan(untenPlus * 2);
  });
});

describe("Lade-Backfill zieht laufende Vertraege auf den Saisonfaktor", () => {
  it("Altvertrag OHNE Kurvenform (der gemessene Fall) wandert von 1,00 auf 1,19 — und zahlt mehr", () => {
    const terms = baueTerms({ startRank: 2, salaryFactor: 1.0, shape: null });
    const zustand = baueSpielstand({ seasonFactor: 1.19, terms, endrang: 1 });

    const vorher = sponsorV3LadderValue(terms, 1);
    const ergebnis = applySponsorSalaryFactorOfCurrentSeason(zustand);
    const neu = ergebnis.gameState.seasonState.sponsorContractsByTeamId!["Z-H"]!.sponsorV3!;

    expect(ergebnis.angepassteTeamIds).toEqual(["Z-H"]);
    expect(neu.salaryFactor).toBe(1.19);
    expect(sponsorV3LadderValue(neu as SponsorV3ContractTerms, 1)).toBeGreaterThan(vorher);
    // Der Sockel des Startrangs bleibt unberuehrt — der Faktor hebt nur den Wertungsanteil.
    expect(neu.startRank).toBe(2);
  });

  it("Anzeige == Settlement: `lockedRankPayoutLadder` wird mitgezogen, nicht stehen gelassen", () => {
    const terms = baueTerms({ startRank: 2, salaryFactor: 1.0, shape: null });
    const zustand = baueSpielstand({ seasonFactor: 1.19, terms });
    const vertragVorher = zustand.seasonState.sponsorContractsByTeamId!["Z-H"]!;

    const vertrag = applySponsorSalaryFactorOfCurrentSeason(zustand).gameState.seasonState
      .sponsorContractsByTeamId!["Z-H"]!;

    expect(vertrag.lockedRankPayoutLadder).toEqual(
      sponsorV3GuaranteedLadder(vertrag.sponsorV3 as SponsorV3ContractTerms),
    );
    expect(vertrag.lockedRankPayoutLadder).not.toEqual(vertragVorher.lockedRankPayoutLadder);
  });

  it("EINE RECHENSTELLE: das Ergebnis ist zeichengleich dem, was der Saisonwechsel bauen wuerde", () => {
    const terms = baueTerms({ startRank: 9, salaryFactor: 1.0 });
    const zustand = baueSpielstand({ seasonFactor: 1.19, terms, termSeasons: 3, seasonsRemaining: 2 });

    const ausBackfill = applySponsorSalaryFactorOfCurrentSeason(zustand).gameState.seasonState
      .sponsorContractsByTeamId!["Z-H"]!.sponsorV3!;
    const ausSaisonwechsel = rerollSponsorV3TermsForNewSeason(terms, {
      newSalaryFactor: 1.19,
      // dasselbe erreichte Vertragsjahr, aus derselben Ableitung
      contractYear: vertragsjahrAus({ termSeasons: 3, seasonsRemaining: 2 }),
    });

    expect(ausBackfill).toEqual(ausSaisonwechsel);
  });

  it("ein Vertrag, der den Saisonfaktor schon traegt, wird nicht einmal angefasst", () => {
    const terms = baueTerms({ startRank: 9, salaryFactor: 1.19 });
    const zustand = baueSpielstand({ seasonFactor: 1.19, terms });

    const ergebnis = applySponsorSalaryFactorOfCurrentSeason(zustand);

    expect(ergebnis.angepassteTeamIds).toEqual([]);
    // Kein neues Objekt: der Spielstand darf ohne Grund nicht wackeln (Save-Signatur).
    expect(ergebnis.gameState).toBe(zustand);
  });
});

describe("Der Backfill ist idempotent", () => {
  it("dritter Durchlauf liefert exakt den Zustand des ersten — kein zweites Anheben", () => {
    const terms = baueTerms({ startRank: 2, salaryFactor: 1.0, shape: null });
    const zustand = baueSpielstand({ seasonFactor: 1.19, terms });

    const lauf1 = applySponsorSalaryFactorOfCurrentSeason(zustand);
    const lauf2 = applySponsorSalaryFactorOfCurrentSeason(lauf1.gameState);
    const lauf3 = applySponsorSalaryFactorOfCurrentSeason(lauf2.gameState);

    expect(lauf2.angepassteTeamIds).toEqual([]);
    expect(lauf3.angepassteTeamIds).toEqual([]);
    expect(lauf3.gameState.seasonState.sponsorContractsByTeamId).toEqual(
      lauf1.gameState.seasonState.sponsorContractsByTeamId,
    );
  });

  it("auch mit Kurvenform: der Neubau haengt am Zielzustand, nicht an der Zahl der Durchlaeufe", () => {
    const terms = baueTerms({ startRank: 9, salaryFactor: 0.85 });
    const zustand = baueSpielstand({ seasonFactor: 1.24, terms, termSeasons: 3, seasonsRemaining: 2 });

    const lauf1 = applySponsorSalaryFactorOfCurrentSeason(zustand);
    const lauf2 = applySponsorSalaryFactorOfCurrentSeason(lauf1.gameState);

    expect(lauf2.gameState.seasonState.sponsorContractsByTeamId).toEqual(
      lauf1.gameState.seasonState.sponsorContractsByTeamId,
    );
  });
});

describe("Der Backfill fasst Abgerechnetes nicht an", () => {
  it("liegt fuer Team und Saison eine season_end-Auszahlung vor, bleibt die Leiter stehen", () => {
    const terms = baueTerms({ startRank: 2, salaryFactor: 1.0, shape: null });
    const zustand = baueSpielstand({ seasonFactor: 1.19, terms, abgerechnet: true });

    const ergebnis = applySponsorSalaryFactorOfCurrentSeason(zustand);

    expect(ergebnis.angepassteTeamIds).toEqual([]);
    expect(ergebnis.bereitsAbgerechneteTeamIds).toEqual(["Z-H"]);
    expect(ergebnis.gameState.seasonState.sponsorContractsByTeamId!["Z-H"]!.sponsorV3!.salaryFactor).toBe(1.0);
  });
});

describe("Vertragsjahr — die eine Ableitung", () => {
  it("zaehlt von der Unterschrift an und bleibt in der Erosions-Tabelle (1..3)", () => {
    expect(vertragsjahrAus({ termSeasons: 3, seasonsRemaining: 3 })).toBe(1);
    expect(vertragsjahrAus({ termSeasons: 3, seasonsRemaining: 2 })).toBe(2);
    expect(vertragsjahrAus({ termSeasons: 3, seasonsRemaining: 1 })).toBe(3);
    expect(vertragsjahrAus({ termSeasons: 2, seasonsRemaining: 1 })).toBe(2);
    // Rest 0 (ausgelaufener Vertrag im Spielstand) waere ungeklammert Jahr 4 — und
    // `getSponsorTermMultiplier(4)` gaebe `undefined` in die Leiter.
    expect(vertragsjahrAus({ termSeasons: 3, seasonsRemaining: 0 })).toBe(3);
  });

  it("der Saisonwechsel benutzt dieselbe Ableitung — Jahr 2 nach dem ersten Rollen", () => {
    const terms = baueTerms({ startRank: 9, salaryFactor: 1.0 });
    const zustand = baueSpielstand({ seasonFactor: 1.19, terms, termSeasons: 3, seasonsRemaining: 3 });

    const gerollt = advanceSponsorContractsForNewSeason(zustand, "season-3");
    const vertrag = gerollt.seasonState.sponsorContractsByTeamId!["Z-H"]!;

    expect(vertrag.seasonsRemaining).toBe(2);
    expect(vertrag.sponsorV3).toEqual(
      rerollSponsorV3TermsForNewSeason(terms, { newSalaryFactor: 1.19, contractYear: 2 }),
    );
  });
});
