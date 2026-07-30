import type { GameState, SponsorOffer, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { isActiveSponsorContract } from "@/lib/sponsor/sponsor-contract-lifecycle";

/**
 * GEMELDET AUS DEM SPIEL: „ich sehe hier nicht mehr die sponsoren die die anderen teams haben also
 * mit namen und seltenheit etc."
 *
 * Hier lagen ZWEI Regeln dafuer vor, ob ein Vertrag aktuell ist — und sie waren verschieden:
 *
 *   Engine  (`isActiveSponsorContract`): seasonsRemaining > 0 UND (seasonId passt ODER
 *                                        seasonsRemaining > 1)
 *   Anzeige (hier, vorher):              null, sobald seasonId nicht EXAKT passt
 *
 * Ein Mehrjahresvertrag mit altem `seasonId` war damit fuer die Engine aktiv — er zahlte am
 * Saisonende aus — und fuer die Oberflaeche nicht vorhanden. Die Liga-Sponsorenuebersicht baut
 * ihre Zeilen ueber genau diese Funktion; betroffene Teams standen dort ohne Sponsor, ohne Namen,
 * ohne Seltenheit.
 *
 * Dass der Fall ueberhaupt eintritt, liegt am Neustempeln: `advanceSponsorContractsForNewSeason`
 * setzt beim Saisonwechsel `seasonId` neu, wird aber nur aus dem Preseason-Workflow gerufen. Jeder
 * Spielstand, der die Saison auf einem anderen Weg gewechselt hat (oder aus der Zeit vor dem
 * Neustempeln stammt), traegt Vertraege mit altem `seasonId` und `seasonsRemaining > 1`.
 *
 * Die urspruengliche Absicht des strengen Riegels bleibt gewahrt: ein VERBRAUCHTER
 * Einjahresvertrag der Vorsaison hat `seasonsRemaining <= 1` und faellt weiterhin raus — er wuerde
 * sonst faelschlich als aktueller Sponsor gelistet. Die gemeinsame Regel macht die Anzeige also
 * nicht laxer, sondern deckungsgleich mit dem, was die Wirtschaft ohnehin auszahlt.
 */
export function getTeamSponsorContract(gameState: GameState, teamId: string): TeamSponsorContract | null {
  const contract = gameState.seasonState.sponsorContractsByTeamId?.[teamId] ?? null;
  return isActiveSponsorContract(contract, gameState.season.id) ? contract : null;
}

export function getTeamSponsorOffers(gameState: GameState, teamId: string): SponsorOffer[] {
  const offers = gameState.seasonState.sponsorOffersByTeamId?.[teamId] ?? [];
  return offers.filter((offer) => offer.seasonId === gameState.season.id);
}
