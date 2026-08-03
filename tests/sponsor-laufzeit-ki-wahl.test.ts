/**
 * KI UND DIE LAUFZEIT (Umsetzungsplan D, Messpunkt 5) — `scoreOfferForAi` kannte `termSeasons` vor
 * diesem Patch gar nicht. Bei einer Erosion, die einen Mehrjahresvertrag ueber seine Laufzeit
 * systematisch schlechter macht als eine Folge gleichwertiger Einjahresvertraege, muss die KI ihn
 * SELTENER waehlen als einen gleichwertigen Einjaehrigen — sonst schadet sie sich systematisch.
 *
 * Gemessen ueber MEHRERE unabhaengige Ligen (verschiedene seasonId → unabhaengige Slate-Wuerfe, siehe
 * sponsor-tier-pool.ts): der Anteil mehrjaehriger Angebote UNTER DEN TATSAECHLICH GEWAEHLTEN
 * Vertraegen der KI muss klar unter dem Anteil mehrjaehriger Angebote UNTER ALLEN ANGEBOTENEN Karten
 * liegen. `scoreOfferForAi` ist privat — dieser Test misst also am oeffentlichen Verhalten
 * (`chooseSponsorOfferForAiTeams`), nicht an der internen Formel.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { chooseSponsorOfferForAiTeams, ensureSeasonSponsorOffers, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";

function withSeasonId(base: GameState, seasonId: string): GameState {
  return {
    ...base,
    season: { ...base.season, id: seasonId },
    seasonState: {
      ...base.seasonState,
      seasonId,
      sponsorOffersByTeamId: {},
      sponsorContractsByTeamId: {},
    },
  };
}

describe("KI-Sponsorwahl bewertet die Laufzeit (Erosion gegen Versicherungswert)", () => {
  it("waehlt mehrjaehrige Angebote SELTENER, als sie im Slate vorkommen — ueber mehrere unabhaengige Ligen gemessen", () => {
    // 8 volle Ligen (32 Teams x 5 Angebote je Saison) brauchen laenger als das Default-Timeout.
    const base = createSingleplayerGameState();
    const seasonIds = Array.from({ length: 8 }, (_, index) => `season-ki-laufzeit-${index}`);

    let offeredMultiYear = 0;
    let offeredTotal = 0;
    let chosenMultiYear = 0;
    let chosenTotal = 0;

    for (const seasonId of seasonIds) {
      const withOffers = ensureSeasonSponsorOffers(withSeasonId(base, seasonId));
      for (const team of withOffers.teams) {
        for (const offer of getTeamSponsorOffers(withOffers, team.teamId)) {
          offeredTotal += 1;
          if ((offer.termSeasons ?? 1) > 1) offeredMultiYear += 1;
        }
      }

      const after = chooseSponsorOfferForAiTeams(withOffers);
      for (const team of after.teams) {
        const contract = getTeamSponsorContract(after, team.teamId);
        if (!contract) continue;
        chosenTotal += 1;
        if ((contract.termSeasons ?? 1) > 1) chosenMultiYear += 1;
      }
    }

    const offeredShare = offeredMultiYear / offeredTotal;
    const chosenShare = chosenMultiYear / chosenTotal;
    // Basis-Erwartung aus dem Slate-Wurf (Gewichte 3:1:1): ~40 % der ANGEBOTE sind mehrjaehrig.
    expect(offeredShare).toBeGreaterThan(0.3);
    expect(offeredShare).toBeLessThan(0.5);
    // Die KI muss klar UNTER diesem Anteil landen — der Laufzeit-Term in scoreOfferForAi drueckt
    // erodierte Mehrjahresvertraege systematisch nach unten.
    expect(chosenShare, `angeboten ${offeredShare.toFixed(3)} vs. gewaehlt ${chosenShare.toFixed(3)} (n=${chosenTotal})`).toBeLessThan(offeredShare);
  }, 30000);
});
