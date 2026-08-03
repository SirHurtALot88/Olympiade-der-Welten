import type { GameState, SponsorTermSeasons, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import {
  getSponsorV3SalaryFactor,
  getSponsorV3Terms,
  rerollSponsorV3TermsForNewSeason,
  sponsorV3GuaranteedLadder,
} from "@/lib/sponsor/sponsor-v3-offer-service";

const BRAND_HISTORY_LIMIT = 4;

export function getRecentSponsorParentIds(gameState: GameState, teamId: string): string[] {
  return gameState.seasonState.sponsorBrandHistoryByTeamId?.[teamId] ?? [];
}

export function appendSponsorBrandHistory(gameState: GameState, teamId: string, parentBrandId: string | undefined): GameState {
  if (!parentBrandId) {
    return gameState;
  }
  const current = gameState.seasonState.sponsorBrandHistoryByTeamId?.[teamId] ?? [];
  const nextHistory = [...current, parentBrandId].slice(-BRAND_HISTORY_LIMIT);
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorBrandHistoryByTeamId: {
        ...(gameState.seasonState.sponsorBrandHistoryByTeamId ?? {}),
        [teamId]: nextHistory,
      },
    },
  };
}

export function isActiveSponsorContract(contract: TeamSponsorContract | null | undefined, seasonId: string) {
  if (!contract) {
    return false;
  }
  if ((contract.seasonsRemaining ?? 1) <= 0) {
    return false;
  }
  // Contract is active when it belongs to the current season or still has remaining terms.
  // The seasonsRemaining > 0 guard above already covers the multi-season case;
  // require seasonId match here to avoid carrying a stale single-season contract forward.
  return contract.seasonId === seasonId || (contract.seasonsRemaining ?? 0) > 1;
}

export function advanceSponsorContractsForNewSeason(gameState: GameState, nextSeasonId: string): GameState {
  const contracts = { ...(gameState.seasonState.sponsorContractsByTeamId ?? {}) };
  const offers = { ...(gameState.seasonState.sponsorOffersByTeamId ?? {}) };
  // Golden-Cooldown (Abschnitt 2.2): festhalten, welche Teams in der ABGESCHLOSSENEN Saison einen golden
  // Vertrag hatten (aus den Verträgen VOR der Mutation gelesen), damit rollGoldenLuck ihnen im Folgejahr den
  // COOLDOWN_PENALTY gibt und kein Team dauerhaft golden bleibt. Ohne diesen Writer war hadGoldenLastSeason
  // immer false und der Cooldown wirkungslos.
  const goldenSponsorHistoryByTeamId: Record<string, boolean> = {};
  for (const [teamId, contract] of Object.entries(gameState.seasonState.sponsorContractsByTeamId ?? {})) {
    if (contract?.isGolden === true) {
      goldenSponsorHistoryByTeamId[teamId] = true;
    }
  }
  let nextGameState = gameState;

  for (const team of gameState.teams) {
    const contract = contracts[team.teamId];
    if (!contract) {
      offers[team.teamId] = [];
      continue;
    }

    const remaining = contract.seasonsRemaining ?? 1;
    if (remaining <= 1) {
      delete contracts[team.teamId];
      offers[team.teamId] = [];
      continue;
    }

    // MEHRJAHRESVERTRAG ROLLT (Umsetzungsplan D): eingefrorener Startrang + eingefrorene Kurvenform
    // bleiben stehen, aber der Salary Factor der NEUEN Saison und die Rendite-Erosion des ERREICHTEN
    // Vertragsjahres muessen neu einfliessen — sonst zahlt ein in einem starken Jahr unterschriebener
    // Mehrjahresvertrag ueber seine ganze Laufzeit auf dem eingefrorenen Konjunktur-Niveau weiter (die
    // Luecke, die die Kopplung an den Salary Factor schliessen soll). `gameState` traegt an dieser
    // Stelle bereits das `seasonEconomyFactors`-Fenster der neuen Saison (siehe Aufrufer in
    // preseason-workflow-service.ts) — `getSponsorV3SalaryFactor` liest daraus den neuen Faktor.
    //
    // ALTVERTRAEGE: `rerollSponsorV3TermsForNewSeason` gibt ohne `curveShape` (Vertraege aus der Zeit
    // vor dem Ligaleiter-Umbau) die eingefrorene Leiter unveraendert zurueck — kein Wurf, kein Absturz.
    const newRemaining = remaining - 1;
    const terms = getSponsorV3Terms(contract);
    const termSeasons: SponsorTermSeasons = contract.termSeasons ?? ((remaining <= 3 ? remaining : 3) as SponsorTermSeasons);
    const contractYear = Math.max(1, Math.min(3, termSeasons - newRemaining + 1)) as SponsorTermSeasons;
    const rerolledTerms = terms
      ? rerollSponsorV3TermsForNewSeason(terms, {
          newSalaryFactor: getSponsorV3SalaryFactor(gameState),
          contractYear,
        })
      : null;

    const rolledContract: TeamSponsorContract = {
      ...contract,
      seasonId: nextSeasonId,
      seasonsRemaining: newRemaining,
      payouts: {},
      chosenAt: contract.chosenAt,
      ...(rerolledTerms
        ? {
            sponsorV3: rerolledTerms,
            // Anzeige == Settlement: die league-detail-Drilldown liest diese Leiter direkt
            // (FoundationSponsorsNewLook.tsx), die Settlement-Rechnung `contract.sponsorV3` — ohne
            // diesen Nachtrag zeigte der Drilldown die eingefrorene Jahr-1-Leiter weiter, waehrend das
            // Settlement bereits aus der neu gebauten, erodierten Leiter zahlt.
            lockedRankPayoutLadder: sponsorV3GuaranteedLadder(rerolledTerms),
          }
        : {}),
    };
    contracts[team.teamId] = rolledContract;
    offers[team.teamId] = [];
  }

  nextGameState = {
    ...nextGameState,
    seasonState: {
      ...nextGameState.seasonState,
      sponsorContractsByTeamId: contracts,
      sponsorOffersByTeamId: offers,
      goldenSponsorHistoryByTeamId,
    },
  };

  return nextGameState;
}
