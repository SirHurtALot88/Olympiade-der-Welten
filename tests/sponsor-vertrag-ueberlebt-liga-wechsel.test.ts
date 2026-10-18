/**
 * TASK #158/#161, Chris' Entscheidung vom 18.10. (liga-split-plan.md 10.6, Option (a) "Leiter
 * umbauen"): ein laufender Mehrjahres-Sponsorvertrag ÜBERLEBT einen Liga-Wechsel (Auf-/Abstieg) —
 * er wird NICHT beendet, sondern beim naechsten Reroll-Zeitpunkt auf die Parameter der NEUEN Liga
 * umgerechnet.
 *
 * KEIN NEUER CODE NOETIG: `rerollSponsorV3TermsForNewSeason` (sponsor-v3-offer-service.ts) baut die
 * Leiter beim Saisonwechsel ohnehin komplett aus `sponsorKurvenLeiter({..., leagueTier})` neu —
 * der einzige Hebel fuer "neue Liga" ist, WELCHES `leagueTier` ihr Aufrufer uebergibt. Und genau das
 * macht `advanceSponsorContractsForNewSeason` (sponsor-contract-lifecycle.ts) bereits richtig: es
 * liest `resolveSponsorLeagueTier(gameState, team.teamId)` aus dem GameState, das ihm der
 * Saisonwechsel uebergibt. Task #158s `league_movement`-Schritt schreibt die NEUE Liga-Zuordnung
 * bereits VOR diesem Saisonwechsel in `seasonState.leagueByTeamId` (season-completion-service.ts) —
 * sodass der Vertrag beim naechsten Reroll automatisch die neue Liga sieht, ohne dass diese Datei
 * (oder irgendein Contract-Code) etwas ueber Auf-/Abstieg wissen muss.
 *
 * Dieser Test beweist genau diese Kette: (1) die reine Leiter-Arithmetik reagiert korrekt auf einen
 * `leagueTier`-Wechsel zwischen zwei Rerolls desselben Vertrags, UND (2) der Lifecycle-Wrapper
 * liest den NEUEN Tier aus einem GameState, dessen `leagueByTeamId` sich zwischen den beiden
 * Saisons geaendert hat — der simulierte "vorher/nachher"-Zustand von `league_movement`.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SponsorCurveShape, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { SPONSOR_BODEN, SPONSOR_TOPF_FAKTOR_JE_LIGA, sponsorKurvenLeiter } from "@/lib/sponsor/sponsor-liga-leiter";
import { buildSponsorV3TermsCore, sponsorV3CardByKey, type SponsorV3ContractTerms } from "@/lib/sponsor/sponsor-v3-model";
import { rerollSponsorV3TermsForNewSeason, resolveSponsorLeagueTier } from "@/lib/sponsor/sponsor-v3-offer-service";
import { advanceSponsorContractsForNewSeason } from "@/lib/sponsor/sponsor-contract-lifecycle";

function buildTerms(startRank: number, shape: SponsorCurveShape, salaryFactor: number, leagueTier?: "liga1" | "liga2"): SponsorV3ContractTerms {
  const card = sponsorV3CardByKey("basis");
  const baseLadder = sponsorKurvenLeiter({ shape, startRank, salaryFactor, leagueTier });
  return buildSponsorV3TermsCore({
    baseLadder,
    startRank,
    rarity: "magisch",
    card,
    goalKey: null,
    curveShape: shape,
    salaryFactor,
    floor: SPONSOR_BODEN,
  });
}

const SHAPE: SponsorCurveShape = "titeljaeger";
const START_RANK = 9;

describe("rerollSponsorV3TermsForNewSeason — ueberlebt einen Liga-Wechsel (10.6)", () => {
  it("ein in Liga 1 unterschriebener Vertrag rollt bei Abstieg auf Liga-2-Parameter um, OHNE zu enden", () => {
    const signedInLiga1 = buildTerms(START_RANK, SHAPE, 1.0, "liga1");
    const rolledAfterRelegation = rerollSponsorV3TermsForNewSeason(signedInLiga1, {
      newSalaryFactor: 1.0,
      contractYear: 2,
      leagueTier: "liga2",
    });

    // Der Vertrag endet nicht — er liefert weiterhin eine vollstaendige, nicht-leere Leiter.
    expect(rolledAfterRelegation.baseLadder.length).toBe(signedInLiga1.baseLadder.length);
    expect(rolledAfterRelegation.baseLadder.every((value) => Number.isFinite(value))).toBe(true);

    // Gegenprobe, SELBER Reroll-Aufruf, nur mit `leagueTier: "liga1"` statt "liga2" — der einzige
    // Unterschied zwischen beiden Aufrufen ist die Liga. "Leiter umbauen" (10.6) heisst: das muss
    // einen nachweisbaren Unterschied machen, nicht "Leiter einfrieren" (identische Zahlen trotz
    // Ligawechsel).
    const stayedInLiga1 = rerollSponsorV3TermsForNewSeason(signedInLiga1, {
      newSalaryFactor: 1.0,
      contractYear: 2,
      leagueTier: "liga1",
    });
    expect(SPONSOR_TOPF_FAKTOR_JE_LIGA.liga2).toBeLessThan(SPONSOR_TOPF_FAKTOR_JE_LIGA.liga1);
    // Liga 2 bekommt einen kleineren Anteil des Wertungstopfs (0,4 statt 0,6) — der Anker (und
    // damit die tatsaechlich erwartete Auszahlung) des umgerechneten Vertrags muss ECHT niedriger
    // sein als haette er Liga-1-Parameter behalten.
    expect(rolledAfterRelegation.anchor).toBeLessThan(stayedInLiga1.anchor);
    // Die Differenz ist kein Rundungsrauschen.
    expect(stayedInLiga1.anchor - rolledAfterRelegation.anchor).toBeGreaterThan(1);
  });

  it("derselbe Vertrag rollt symmetrisch auf Liga-1-Parameter um, wenn das Team aufsteigt", () => {
    const signedInLiga2 = buildTerms(START_RANK, SHAPE, 1.0, "liga2");
    const rolledAfterPromotion = rerollSponsorV3TermsForNewSeason(signedInLiga2, {
      newSalaryFactor: 1.0,
      contractYear: 2,
      leagueTier: "liga1",
    });
    const stayedInLiga2 = rerollSponsorV3TermsForNewSeason(signedInLiga2, {
      newSalaryFactor: 1.0,
      contractYear: 2,
      leagueTier: "liga2",
    });
    expect(rolledAfterPromotion.baseLadder.length).toBe(signedInLiga2.baseLadder.length);
    // Aufstieg: GRÖSSERER Topf-Anteil (0,6 statt 0,4) — der Anker nach dem Aufstieg muss hoeher
    // sein, als waere der Vertrag in Liga 2 geblieben.
    expect(rolledAfterPromotion.anchor).toBeGreaterThan(stayedInLiga2.anchor);
    expect(rolledAfterPromotion.anchor - stayedInLiga2.anchor).toBeGreaterThan(1);
  });
});

describe("advanceSponsorContractsForNewSeason — liest die NEUE Liga aus seasonState.leagueByTeamId", () => {
  function buildGameStateWithContract(input: {
    teamId: string;
    leagueByTeamId: Record<string, "liga1" | "liga2">;
    terms: SponsorV3ContractTerms;
    seasonsRemaining: number;
  }): GameState {
    const contract: TeamSponsorContract = {
      seasonId: "season-5",
      teamId: input.teamId,
      offerId: "offer-1",
      archetype: "cash",
      curveShape: SHAPE,
      name: "Testsponsor",
      chosenAt: "2026-10-01T00:00:00.000Z",
      startRank: START_RANK,
      components: [],
      payouts: {},
      termSeasons: 3,
      seasonsRemaining: input.seasonsRemaining,
      sponsorV3: input.terms,
    } as unknown as TeamSponsorContract;

    return {
      season: { id: "season-5" },
      teams: [{ teamId: input.teamId, name: input.teamId, shortCode: input.teamId }],
      seasonState: {
        leagueByTeamId: input.leagueByTeamId,
        sponsorContractsByTeamId: { [input.teamId]: contract },
        sponsorOffersByTeamId: {},
        sponsorLeihgabenByTeamId: {},
      },
    } as unknown as GameState;
  }

  it("league_movement hat Liga 1 -> Liga 2 geschrieben, BEVOR der Saisonwechsel laeuft: der Reroll sieht sofort Liga 2", () => {
    const signedInLiga1 = buildTerms(START_RANK, SHAPE, 1.0, "liga1");
    // Simuliert exakt den Zustand NACH dem `league_movement`-Schritt (season-completion-service.ts):
    // `leagueByTeamId` zeigt schon auf die NEUE Saison, bevor `advanceSponsorContractsForNewSeason`
    // (Teil des Saisonwechsels in preseason-workflow-service.ts) ueberhaupt laeuft.
    const gameStateAfterRelegation = buildGameStateWithContract({
      teamId: "L1-14",
      leagueByTeamId: { "L1-14": "liga2" },
      terms: signedInLiga1,
      seasonsRemaining: 2,
    });

    expect(resolveSponsorLeagueTier(gameStateAfterRelegation, "L1-14")).toBe("liga2");

    const nextGameState = advanceSponsorContractsForNewSeason(gameStateAfterRelegation, "season-6");
    const rolledContract = nextGameState.seasonState.sponsorContractsByTeamId?.["L1-14"];
    expect(rolledContract).toBeDefined();
    // Der Vertrag lebt weiter (Mehrjahresvertrag rollt, wird nicht beendet) ...
    expect(rolledContract!.seasonsRemaining).toBe(1);
    // ... und sein neu gebauter Anker liegt niedriger als haette der Lifecycle-Wrapper (faelschlich)
    // noch Liga 1 gesehen — der Beweis, dass er tatsaechlich die NEUE, in `leagueByTeamId` bereits
    // umgeschriebene Liga liest, statt auf der alten (eingefrorenen) Zuordnung sitzen zu bleiben.
    const rolledAnchor = (rolledContract!.sponsorV3 as SponsorV3ContractTerms).anchor;
    const hadStayedInLiga1 = rerollSponsorV3TermsForNewSeason(signedInLiga1, {
      newSalaryFactor: 1.0,
      contractYear: 2,
      leagueTier: "liga1",
    });
    expect(rolledAnchor).toBeLessThan(hadStayedInLiga1.anchor);
  });
});
