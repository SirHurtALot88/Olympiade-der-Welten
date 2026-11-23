/**
 * AUSRUESTUNG: NACH DEM SPIELTAG (Phase 1a, 22.11.). Ein Aufruf nach dem Buchen eines Spieltags
 * (`legacy-matchday-result-apply-service.ts`, hinter den Siegpraemien):
 *
 *   1. Ruhm und Holztruhen-Gutscheine aus den gebuchten Disziplin-Ergebnissen (`bucheRuhmFuerSpieltag`),
 *   2. Platzierungs-Gold zur Halbzeit und am Saisonende (`buchePlatzierungsGold`),
 *   3. eine KI-Runde fuer KI-Teams und delegierte Menschen (Truhen oeffnen, waehlen, Lager halten).
 *
 * Nur Battle-Spielstaende mit aktivem Besitz (Regel-Stempel). Ohne Regel, im Manager-Modus oder bei der Notbremse bleibt der
 * Spielstand EXAKT der, der hereinkam (dieselbe Referenz): Phase 1a veraendert die Wertung nicht.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { ausruestungRegelFuer } from "@/lib/ausruestung/ausruestung-regel";
import { kiAusruestungsRunde, ausruestungSpieltDieKi } from "@/lib/ausruestung/ausruestung-ki";
import { bucheRuhmFuerSpieltag, buchePlatzierungsGold } from "@/lib/ausruestung/ausruestung-ruhm";

export function bucheAusruestungNachSpieltag(gameState: GameState, matchdayResultId: string, env: Record<string, string | undefined> = process.env): GameState {
  const mr = (gameState.seasonState.matchdayResults ?? []).find((r) => r.id === matchdayResultId);
  if (!mr) return gameState;
  const regel = ausruestungRegelFuer(gameState, mr.matchdayId, env);
  if (!regel.besitz) return gameState;

  let aktuell = bucheRuhmFuerSpieltag(gameState, matchdayResultId);
  aktuell = buchePlatzierungsGold(aktuell);
  if (!aktuell.ausruestung) return aktuell;
  for (const team of aktuell.teams) {
    if (!ausruestungSpieltDieKi(aktuell, team.teamId)) continue;
    aktuell = kiAusruestungsRunde(aktuell, team.teamId, regel, team.humanControlled);
  }
  return aktuell;
}
