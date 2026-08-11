import type {
  GameState,
  SponsorLeihgabeRecord,
  SponsorTermSeasons,
  SponsorUebernahmeAngebot,
  TeamSponsorContract,
} from "@/lib/data/olyDataTypes";
import {
  baueUebernahmeAngebot,
  rolleLeihgabe,
} from "@/lib/sponsor/sponsor-leih-lifecycle";
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

  // DIE LEIHGABEN WANDERN MIT DEN VERTRAEGEN. Bis zu diesem Umbau tat das keine einzige Stelle:
  // eine unterschriebene Leihe blieb ewig auf ihrer Anfangsstufe stehen, waehrend der Verzicht jede
  // Saison neu faellig wurde. Hier wird sie gerollt (Stufe hoch, Zustand runter) oder — wenn der
  // Vertrag ausläuft — entfernt und durch ein Uebernahmeangebot ersetzt.
  const leihgaben: Record<string, SponsorLeihgabeRecord[]> = {
    ...(gameState.seasonState.sponsorLeihgabenByTeamId ?? {}),
  };
  const uebernahmen: Record<string, SponsorUebernahmeAngebot[]> = {};

  for (const team of gameState.teams) {
    const contract = contracts[team.teamId];
    if (!contract) {
      offers[team.teamId] = [];
      continue;
    }

    const remaining = contract.seasonsRemaining ?? 1;
    if (remaining <= 1) {
      // VERTRAGSENDE. Die Leihe faellt weg — genau deshalb stand sie nie in `teamFacilities`, der
      // Rueckfall auf den eigenen Bestand ist ein Weglassen und kein Loeschvorgang. Statt des
      // Gebaeudes bekommt das Team den Kaufpreis auf den Tisch.
      const laufende = leihgaben[team.teamId] ?? [];
      const eigene = laufende.filter((eintrag) => eintrag.offerId === contract.offerId);
      const uebernahmeAngebote = eigene
        .map((leihgabe) =>
          baueUebernahmeAngebot({ teamId: team.teamId, seasonId: nextSeasonId, contract, leihgabe }),
        )
        .filter((angebot): angebot is SponsorUebernahmeAngebot => angebot != null);
      if (uebernahmeAngebote.length > 0) {
        uebernahmen[team.teamId] = uebernahmeAngebote;
      }
      const rest = laufende.filter((eintrag) => eintrag.offerId !== contract.offerId);
      if (rest.length > 0) {
        leihgaben[team.teamId] = rest;
      } else {
        delete leihgaben[team.teamId];
      }

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

    // DIE LEIHE ROLLT MIT: eine Stufe weiter laut eingefrorener Reihe, eine Saison gealtert — und
    // der Verzicht waechst auf den Preis der NEUEN Stufe. Ohne diesen Nachtrag stiege das Gebaeude
    // jedes Jahr, waehrend der Preis der von Jahr 1 bliebe.
    let neuerVerzicht = terms?.leihVerzicht ?? 0;
    if (contract.sponsorLeihe) {
      const laufende = leihgaben[team.teamId] ?? [];
      const gerollt = laufende.map((leihgabe) => {
        if (leihgabe.offerId !== contract.offerId) return leihgabe;
        const ergebnis = rolleLeihgabe({
          leihgabe,
          leihe: contract.sponsorLeihe!,
          naechstesVertragsjahr: contractYear,
          naechsteSeasonId: nextSeasonId,
          verschleissSaat: `${nextSeasonId}:${team.teamId}:leihe`,
        });
        neuerVerzicht = ergebnis.verzicht;
        return ergebnis.leihgabe;
      });
      if (gerollt.length > 0) {
        leihgaben[team.teamId] = gerollt;
      }
    }

    const rerolledTerms = terms
      ? rerollSponsorV3TermsForNewSeason(
          { ...terms, ...(neuerVerzicht > 0 ? { leihVerzicht: neuerVerzicht } : {}) },
          {
            newSalaryFactor: getSponsorV3SalaryFactor(gameState),
            contractYear,
          },
        )
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
      sponsorLeihgabenByTeamId: leihgaben,
      // Nur setzen, wenn es welche gibt — ein leeres Objekt im Spielstand ist Rauschen, und ein
      // altes Angebot darf nicht ueber die Saison hinaus stehen bleiben.
      ...(Object.keys(uebernahmen).length > 0
        ? { sponsorUebernahmeAngeboteByTeamId: uebernahmen }
        : { sponsorUebernahmeAngeboteByTeamId: undefined }),
    },
  };

  return nextGameState;
}
