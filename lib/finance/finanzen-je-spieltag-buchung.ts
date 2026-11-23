/**
 * FINANZEN JE SPIELTAG — die BUCHUNG (22.11., docs/design/finanzen-je-spieltag-22-11.md).
 *
 * Vier Fluesse plus (22.11.) der Rang-Abschlag auf die Sponsor-Rangpraemie.
 * Laeuft beim Spieltagsabschluss (`lib/season/matchday-progress-service.ts`), nach dem gespielten Spieltag, fuer ALLE
 * Teams gleich — Mensch, KI und delegierte Teams (kein Zweig nach Besitzer). Gebucht wird nur in einer Saison mit
 * Stempel (`istJeSpieltagSaison`), sonst gibt die Funktion den Spielstand unveraendert zurueck.
 *
 * IDEMPOTENT je (Saison, Spieltag, Team): eine zweite Buchung desselben Spieltags findet ihre Zeile im Ledger
 * `seasonState.spieltagFinanzen` und tut nichts. Replay und Re-Apply buchen damit nie doppelt.
 *
 * KASSE = SUMME DER BUCHUNGEN: `team.cash` wird um genau `cashDelta` der Ledger-Zeile veraendert (beide auf 0,1 gerundet).
 * Es gibt keine Saisonpause-Buchung: die Pause nach Spieltag 10 ist kein Spieltag im Spielplan (`season.matchdayIds`).
 */
import type { GameState, SpieltagFinanzBuchung } from "@/lib/data/olyDataTypes";
import { berechneGebaeudeSaisonbetraege } from "@/lib/facilities/facility-season-end-service";
import {
  istJeSpieltagSaison,
  kaderJahresgehaltAmSpieltag,
  runde1,
  spieltageDerSaison,
  teileJahresbetrag,
} from "@/lib/finance/finanzen-je-spieltag";
import { marketingJahresbetrag } from "@/lib/marketing/marketing-team";
import { marketingAktiv } from "@/lib/marketing/marketing-regel";
import { buildMoraleLookupIndex, type MoraleLookupIndex } from "@/lib/morale/player-morale-service";
import { sponsorBasisJahr, sponsorRangAbschlag, sponsorRangFuerAbschlag } from "@/lib/sponsor/sponsor-settlement-service";

export function spieltagBuchungsId(seasonId: string, matchdayId: string, teamId: string): string {
  return `spieltag-finanz:${seasonId}:${matchdayId}:${teamId}`;
}

/** Die Jahresbetraege eines Teams zum heutigen Stand (Gehalt am Spieltag `matchdayIndex`); Marketing nur mit gueltiger Regel, sonst 0. */
export function jahresbetraegeEinesTeams(
  gameState: GameState,
  teamId: string,
  matchdayIndex: number | null,
  moralIndex?: MoraleLookupIndex,
): { gehalt: number; sponsorBasis: number; gebaeudeEinnahme: number; gebaeudeUnterhalt: number; marketing: number } {
  const gebaeude = berechneGebaeudeSaisonbetraege(gameState, teamId);
  return {
    gehalt: kaderJahresgehaltAmSpieltag(gameState, teamId, matchdayIndex),
    sponsorBasis: sponsorBasisJahr(gameState, teamId),
    gebaeudeEinnahme: gebaeude.income,
    gebaeudeUnterhalt: gebaeude.upkeep,
    marketing: marketingJahresbetrag(gameState, teamId, moralIndex),
  };
}

/**
 * Bucht den abgeschlossenen Spieltag `matchdayId` fuer alle Teams, die dafuer noch keine Zeile haben.
 * Gibt einen neuen Spielstand zurueck (Eingabe bleibt unveraendert).
 */
export function bucheSpieltagFinanzen(gameState: GameState, matchdayId: string, jetzt: string = new Date().toISOString()): GameState {
  if (!istJeSpieltagSaison(gameState)) return gameState;
  const seasonId = gameState.season.id;
  const ids = gameState.season.matchdayIds ?? [];
  const index = ids.indexOf(matchdayId) + 1;
  if (index <= 0) return gameState;
  const n = spieltageDerSaison(gameState);

  const ledger = gameState.seasonState.spieltagFinanzen ?? [];
  const jeTeam = new Map<string, SpieltagFinanzBuchung[]>();
  for (const zeile of ledger) {
    if (zeile.seasonId !== seasonId) continue;
    (jeTeam.get(zeile.teamId) ?? jeTeam.set(zeile.teamId, []).get(zeile.teamId)!).push(zeile);
  }

  const neue: SpieltagFinanzBuchung[] = [];
  const cashDelta = new Map<string, number>();
  // MARKETING (22.11.): der Moral-Index wird fuer alle Teams EINMAL gebaut (die Team-Anteile lesen die Moral je Spieler).
  const moralIndex = marketingAktiv(gameState) ? buildMoraleLookupIndex(gameState) : undefined;
  for (const team of gameState.teams) {
    const bisher = jeTeam.get(team.teamId) ?? [];
    if (bisher.some((zeile) => zeile.matchdayId === matchdayId)) continue;
    // Rundungsrest der letzten frueheren Buchung dieser Saison (Reihenfolge nach Spieltag, nicht nach Schreibzeit).
    const vorher = bisher.filter((zeile) => zeile.matchdayIndex < index).sort((a, b) => b.matchdayIndex - a.matchdayIndex)[0];
    const rest0 = vorher?.rest ?? { gehalt: 0, sponsorBasis: 0, gebaeudeEinnahme: 0, gebaeudeUnterhalt: 0, marketing: 0 };
    const j = jahresbetraegeEinesTeams(gameState, team.teamId, index, moralIndex);
    const gehalt = teileJahresbetrag(j.gehalt, n, rest0.gehalt);
    const sponsor = teileJahresbetrag(j.sponsorBasis, n, rest0.sponsorBasis);
    const einnahme = teileJahresbetrag(j.gebaeudeEinnahme, n, rest0.gebaeudeEinnahme);
    const unterhalt = teileJahresbetrag(j.gebaeudeUnterhalt, n, rest0.gebaeudeUnterhalt);
    // MARKETING (22.11.): Teammarke + Team-Anteile zu 1/N, immer >= 0. Ohne gueltige Regel 0 (die Zeile traegt dann kein Feld).
    const marketing = teileJahresbetrag(j.marketing, n, rest0.marketing ?? 0);
    // RANG-ABSCHLAG (Chris, 22.11.): 80 % der Rangpraemie bei heutigem Tabellenplatz, zu 1/N. Der Schlussausgleich am
    // Saisonende bucht Endrang-Praemie minus Summe der Abschlaege. Ohne Sponsorvertrag 0.
    const rang = sponsorRangFuerAbschlag(gameState, team.teamId);
    const rangAbschlag = sponsorRangAbschlag(gameState, team.teamId, rang, n).abschlag;
    const delta = runde1(-gehalt.betrag + sponsor.betrag + einnahme.betrag - unterhalt.betrag + rangAbschlag + marketing.betrag);
    neue.push({
      id: spieltagBuchungsId(seasonId, matchdayId, team.teamId),
      seasonId,
      matchdayId,
      matchdayIndex: index,
      matchdayCount: n,
      teamId: team.teamId,
      gehalt: gehalt.betrag === 0 ? 0 : -gehalt.betrag,
      sponsorBasis: sponsor.betrag,
      gebaeudeEinnahme: einnahme.betrag,
      gebaeudeUnterhalt: unterhalt.betrag === 0 ? 0 : -unterhalt.betrag,
      rangAbschlag,
      rang: rangAbschlag === 0 ? null : rang,
      ...(j.marketing > 0 || marketing.betrag !== 0 ? { marketing: marketing.betrag } : {}),
      cashDelta: delta,
      rest: {
        gehalt: gehalt.rest,
        sponsorBasis: sponsor.rest,
        gebaeudeEinnahme: einnahme.rest,
        gebaeudeUnterhalt: unterhalt.rest,
        ...(j.marketing > 0 || marketing.betrag !== 0 ? { marketing: marketing.rest } : {}),
      },
      createdAt: jetzt,
    });
    if (delta !== 0) cashDelta.set(team.teamId, delta);
  }
  if (neue.length === 0) return gameState;

  return {
    ...gameState,
    teams: gameState.teams.map((team) => {
      const delta = cashDelta.get(team.teamId);
      return delta == null ? team : { ...team, cash: runde1(team.cash + delta) };
    }),
    seasonState: {
      ...gameState.seasonState,
      spieltagFinanzen: [...ledger, ...neue],
    },
  };
}
