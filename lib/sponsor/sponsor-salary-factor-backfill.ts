/**
 * DER LADE-BACKFILL FUER DEN GEHALTSFAKTOR EINES SPONSORVERTRAGS.
 *
 * Chris' Vorgabe: „ja salary factor muss bei allen sponsoren standardmäßig berücksichtigt werden."
 * „Standardmaessig" heisst: es darf keinen laufenden Vertrag geben, der still auf dem Faktor eines
 * frueheren Jahres sitzt, waehrend die Saison mit einem anderen abgerechnet wird.
 *
 * WARUM DAS UEBERHAUPT PASSIERT. Den Faktor bekommt eine Leiter an genau zwei Zeitpunkten:
 * bei der Unterschrift (`buildSponsorV3Terms`) und beim Saisonwechsel
 * (`advanceSponsorContractsForNewSeason` → `rerollSponsorV3TermsForNewSeason`). Zwischen zwei
 * Saisonwechseln fragt niemand nach. Faellt der Reroll fuer einen Vertrag aus, sitzt der Vertrag die
 * GANZE Saison auf dem alten Faktor und wird auch so ausgezahlt — und ein Vertrag in seiner LETZTEN
 * Saison bekommt nie wieder eine Gelegenheit, weil er beim naechsten Wechsel ausläuft.
 *
 * GEMESSEN am Live-Abbild (`pc.sqlite`, Save `new-game-1785823388048-1hf25q`, Saison 2, Faktor 1,19):
 * 10 von 32 Vertraegen standen auf 1,00. Alle zehn waren am 04.08. unterschrieben worden, also VOR
 * dem Ligaleiter-Umbau, und tragen deshalb keine `curveShape`. Der Saisonwechsel am 08.08. lief mit
 * einem Stand, in dem `rerollSponsorV3TermsForNewSeason` fuer genau diesen Fall die eingefrorene
 * Leiter unveraendert zurueckgab; die Umrechnung dafuer kam erst am 11.08. (6fa071d4). Die 22
 * uebrigen Vertraege wurden zum Wechsel neu unterschrieben und trugen 1,19 von Anfang an.
 *
 * Der Reroll koennte das heute — aber nur beim naechsten Wechsel, und nur fuer die vier Vertraege
 * mit Restlaufzeit > 1. Diese Datei schliesst die Luecke an der einen Stelle, durch die jeder
 * Spielstand kommt: dem Laden.
 *
 * EINE RECHENSTELLE. Hier wird nichts nachgebaut. Der Backfill ruft dieselbe Funktion, die auch der
 * Saisonwechsel ruft (`rerollSponsorV3TermsForNewSeason`), mit demselben Vertragsjahr aus derselben
 * Ableitung (`vertragsjahrAus`) und schreibt dieselbe Anzeige-Leiter nach
 * (`sponsorV3GuaranteedLadder` → `lockedRankPayoutLadder`, exakt wie sponsor-contract-lifecycle.ts).
 *
 * IDEMPOTENT — und zwar aus zwei voneinander unabhaengigen Gruenden, damit ein zweiter Durchlauf
 * einen Vertrag NICHT ein zweites Mal anhebt:
 *  1. Die Wache greift nur, wenn `terms.salaryFactor` vom Saisonfaktor abweicht. Nach dem ersten
 *     Durchlauf steht dort der Saisonfaktor — der zweite Durchlauf sieht den Vertrag gar nicht mehr.
 *  2. Selbst wenn er ihn saehe: `rerollSponsorV3TermsForNewSeason` rechnet NICHT inkrementell auf
 *     der vorhandenen Leiter weiter. Der Zweig MIT `curveShape` baut die Leiter vollstaendig neu aus
 *     (Startrang, Kurvenform, Raritaet, Verzicht, Faktor, Vertragsjahr); der Zweig OHNE `curveShape`
 *     skaliert mit `neuerFaktor / terms.salaryFactor` und setzt `salaryFactor` mit — bei gleichem
 *     Faktor ist die Skala 1 und er steigt ohnehin vorher aus. Beide sind damit Funktionen des
 *     ZIELZUSTANDS, nicht der Zahl der Durchlaeufe.
 *
 * WAS BEWUSST NICHT ANGEFASST WIRD: ein Vertrag, fuer den in DIESER Saison schon eine
 * `season_end`-Auszahlung gebucht ist. Dort ist das Geld geflossen; die Leiter danach noch zu heben
 * hiesse, die Karte zu etwas anderem zu machen als das, was im Auszahlungslog steht. Dieselbe Wache
 * benutzt Migration M1 (`sponsor-v3-migration.ts`).
 */
import type { GameState, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { vertragsjahrAus } from "@/lib/sponsor/sponsor-leih-lifecycle";
import { sponsorV3GuaranteedLadder } from "@/lib/sponsor/sponsor-v3-model";
import {
  getSponsorV3SalaryFactor,
  getSponsorV3Terms,
  rerollSponsorV3TermsForNewSeason,
} from "@/lib/sponsor/sponsor-v3-offer-service";

/** Faktoren sind auf 2 Stellen gewuerfelt; ein Rundungsrest ist keine Abweichung. */
const FAKTOR_EPSILON = 1e-9;

export type SponsorSalaryFactorBackfillResult = {
  gameState: GameState;
  /** Teams, deren Leiter auf den Saisonfaktor gezogen wurde. */
  angepassteTeamIds: string[];
  /** Teams, die abweichen, aber in dieser Saison schon abgerechnet sind — bewusst unberuehrt. */
  bereitsAbgerechneteTeamIds: string[];
};

function hatSeasonEndAuszahlung(gameState: GameState, seasonId: string, teamId: string): boolean {
  return (gameState.seasonState.sponsorPayoutLogs ?? []).some(
    (log) => log.seasonId === seasonId && log.teamId === teamId && log.phase === "season_end",
  );
}

export function applySponsorSalaryFactorOfCurrentSeason(gameState: GameState): SponsorSalaryFactorBackfillResult {
  const seasonState = gameState.seasonState;
  const contracts = seasonState?.sponsorContractsByTeamId ?? null;
  if (!seasonState || !contracts) {
    return { gameState, angepassteTeamIds: [], bereitsAbgerechneteTeamIds: [] };
  }
  const saisonFaktor = getSponsorV3SalaryFactor(gameState);
  const seasonId = gameState.season?.id ?? "";
  const angepassteTeamIds: string[] = [];
  const bereitsAbgerechneteTeamIds: string[] = [];
  const naechste: Record<string, TeamSponsorContract> = { ...contracts };

  for (const [teamId, contract] of Object.entries(contracts)) {
    if (!contract) continue;
    // `getSponsorV3Terms` prueft Version UND beide Leiterlaengen. Ein Vertrag ohne belastbare
    // V3-Konditionen bekommt sie von Migration M1 nachgetragen — dort mit dem Saisonfaktor gebaut —,
    // hier wird nichts erfunden.
    const terms = getSponsorV3Terms(contract);
    if (!terms) continue;
    const leiterFaktor = terms.salaryFactor;
    if (!Number.isFinite(leiterFaktor) || leiterFaktor <= 0) continue;
    if (Math.abs(leiterFaktor - saisonFaktor) < FAKTOR_EPSILON) continue;
    if (hatSeasonEndAuszahlung(gameState, contract.seasonId ?? seasonId, teamId)) {
      bereitsAbgerechneteTeamIds.push(teamId);
      continue;
    }
    const contractYear = vertragsjahrAus(contract);
    const gerollt = rerollSponsorV3TermsForNewSeason(terms, {
      newSalaryFactor: saisonFaktor,
      contractYear,
    });
    // Kam nichts zurueck, was den Faktor traegt (die Wachen im Reroll koennen aussteigen), bleibt der
    // Vertrag unveraendert stehen — eine halb umgeschriebene Leiter waere schlimmer als eine alte.
    if (Math.abs(gerollt.salaryFactor - saisonFaktor) >= FAKTOR_EPSILON) continue;
    naechste[teamId] = {
      ...contract,
      sponsorV3: gerollt,
      // Anzeige == Settlement: der Liga-Drilldown liest diese Leiter, das Settlement `contract.sponsorV3`.
      lockedRankPayoutLadder: sponsorV3GuaranteedLadder(gerollt),
    };
    angepassteTeamIds.push(teamId);
  }

  if (angepassteTeamIds.length === 0) {
    return { gameState, angepassteTeamIds, bereitsAbgerechneteTeamIds };
  }
  return {
    gameState: {
      ...gameState,
      seasonState: { ...seasonState, sponsorContractsByTeamId: naechste },
    },
    angepassteTeamIds,
    bereitsAbgerechneteTeamIds,
  };
}

/** Bequemlichkeits-Fassade fuer den Lade-Pfad, der nur den neuen Spielstand braucht. */
export function withSponsorSalaryFactorOfCurrentSeason(gameState: GameState): GameState {
  return applySponsorSalaryFactorOfCurrentSeason(gameState).gameState;
}
