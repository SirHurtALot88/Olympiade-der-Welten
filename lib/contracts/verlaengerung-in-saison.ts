import type { GameState, RosterEntry } from "@/lib/data/olyDataTypes";
import { ligaDraftDieserSaison } from "@/lib/draft/liga-draft-modell";
import { getCurrentSeasonNumber } from "@/lib/foundation/season-history-clamp";

/**
 * VERLAENGERN WAEHREND DER SAISON (Chris 21.11.: „gilt ab sofort, laufende Saison zaehlt mit“).
 *
 * Bis hierher oeffnete der Phasen-Riegel `renew_contract` nur im Saisonende-Fenster und im Setup vor Spieltag 1.
 * Jetzt geht es auch zwischen den Spieltagen, fuer Mensch und KI ueber denselben Dienst
 * (`previewContractRenewalAction` / `applyContractRenewalAction`). Dieses Modul haelt nur die Regeln, die den Fall
 * „mitten in der Saison“ von den beiden alten Fenstern unterscheiden:
 *
 *   - Schalter `OLY_VERLAENGERUNG_IN_SAISON=0` (Rueckweg: alles wie vorher);
 *   - Mindestlaufzeit 2 (Laufzeit 1 waere keine Verlaengerung: die laufende Saison zaehlt mit);
 *   - einmal je Spieler und Saison (Vermerk `inSaisonVerlaengerung`);
 *   - Saison 1: Draft-Picks sind feste 1-Jahres-Vertraege, verhandelt wird erst am Ende von Saison 1;
 *   - nicht mehr nach dem letzten Spieltag (dann gilt das Saisonende-Fenster).
 */

export function verlaengerungInSaisonAktiv(): boolean {
  const roh = (process.env.NEXT_PUBLIC_OLY_VERLAENGERUNG_IN_SAISON ?? process.env.OLY_VERLAENGERUNG_IN_SAISON ?? "").trim();
  return roh !== "0";
}

export const IN_SAISON_MINDEST_LAUFZEIT = 2;

/** Gebuchte (nicht ersetzte, nicht verworfene) Spieltage der laufenden Saison. */
export function gespielteSpieltage(gameState: GameState): number {
  const ids = new Set<string>();
  for (const result of gameState.seasonState?.matchdayResults ?? []) {
    if (result.seasonId !== gameState.season.id) continue;
    if (result.status === "superseded" || result.status === "voided") continue;
    ids.add(result.matchdayId);
  }
  return ids.size;
}

export function gesamtSpieltage(gameState: GameState): number {
  return Math.max(gameState.season.matchdayIds?.length ?? 0, gameState.season.totalMatchdays ?? 0);
}

/**
 * Laeuft gerade der Spielbetrieb mit mindestens einem gebuchten Spieltag? Nur dann ist eine Unterschrift eine
 * In-Saison-Verlaengerung (vor Spieltag 1 gilt unveraendert das Setup-Fenster, im Saisonende das Saisonende-Fenster).
 */
export function istInSaisonModus(gameState: GameState): boolean {
  if ((gameState.gamePhase ?? "season_active") !== "season_active") return false;
  return gespielteSpieltage(gameState) > 0;
}

/** Ist die Saison durchgespielt (alle Spieltage gebucht)? Dann gehoert die Entscheidung ins Saisonende-Fenster. */
export function istSaisonDurchgespielt(gameState: GameState): boolean {
  const gesamt = gesamtSpieltage(gameState);
  return gesamt > 0 && gespielteSpieltage(gameState) >= gesamt;
}

/** Saison-1-Draft-Pick dieses Teams? Feste Konditionen, verhandelt wird erst am Ende von Saison 1. */
export function istDraftPickFestkonditionen(gameState: GameState, entry: Pick<RosterEntry, "teamId" | "playerId">): boolean {
  if (getCurrentSeasonNumber(gameState) !== 1) return false;
  const draft = ligaDraftDieserSaison(gameState);
  if (!draft) return false;
  return draft.verlauf.some((eintrag) => eintrag.art === "pick" && eintrag.teamId === entry.teamId && eintrag.playerId === entry.playerId);
}

/** Die Sperrgruende einer In-Saison-Verlaengerung (leer = erlaubt, oder kein In-Saison-Fall). */
export function pruefeInSaisonVerlaengerung(gameState: GameState, entry: RosterEntry, laufzeit: number): string[] {
  if (!istInSaisonModus(gameState)) return [];
  const gruende: string[] = [];
  if (!verlaengerungInSaisonAktiv()) gruende.push("in_season_renewal_disabled");
  if (istSaisonDurchgespielt(gameState)) gruende.push("in_season_renewal_season_over");
  if (entry.inSaisonVerlaengerung?.seasonId === gameState.season.id) gruende.push("in_season_renewal_already_done");
  if (istDraftPickFestkonditionen(gameState, entry)) gruende.push("in_season_renewal_draft_s1");
  if (laufzeit < IN_SAISON_MINDEST_LAUFZEIT) gruende.push("in_season_renewal_min_length_2");
  return gruende;
}

/**
 * Gewichtetes Saisongehalt: alte Spieltage zum alten, restliche zum neuen Gehalt. Ohne passenden Vermerk (andere
 * Saison, oder das Gehalt wurde seither anders fortgeschrieben) gilt `aktuell` unveraendert.
 */
export function mischeSaisongehalt(
  entry: Pick<RosterEntry, "inSaisonVerlaengerung">,
  seasonId: string,
  aktuell: number,
): number {
  const v = entry.inSaisonVerlaengerung;
  if (!v || v.seasonId !== seasonId || v.spieltageGesamt <= 0) return aktuell;
  if (Math.abs(aktuell - v.neuesGehalt) > 0.05) return aktuell;
  const alt = Math.min(Math.max(v.spieltageAlt, 0), v.spieltageGesamt);
  return (v.altesGehalt * alt + v.neuesGehalt * (v.spieltageGesamt - alt)) / v.spieltageGesamt;
}

/** Deterministischer Spieltag (Anzahl gebuchter Spieltage), an dem die KI einen Spieler prueft: Verteilung ueber die Saison. */
export function kiPruefSpieltag(seasonId: string, teamId: string, playerId: string, gesamt: number): number {
  const text = `${seasonId}:${teamId}:${playerId}`;
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const von = 2;
  const bis = Math.max(von, gesamt - 3);
  return von + (h % (bis - von + 1));
}

/** Fuer die Oberflaeche: ist „Verlaengern“ gerade zwischen den Spieltagen offen (Schalter an, Spielbetrieb laeuft, nicht durchgespielt)? */
export function istVerlaengernInSaisonOffen(gameState: GameState): boolean {
  return verlaengerungInSaisonAktiv() && istInSaisonModus(gameState) && !istSaisonDurchgespielt(gameState);
}
