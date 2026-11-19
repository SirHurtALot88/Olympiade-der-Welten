/**
 * VERLÄNGERN ODER FREIGEBEN — die Pflichtentscheidung am Saisonende (Chris, 19.11.).
 *
 * Wörtlich: „es ist nicht gewollt, dass wenn du einen Vertrag nicht verlängerst, der Spieler dann bleibt. […] am Ende von
 * Season 1 […] muss man sich dann entscheiden, verlängere ich den Spieler oder geht er? Also im Endeffekt, du kannst gar nicht
 * einfach das aussitzen, sondern du musst entweder verlängern oder ihn freigeben. Wenn du ihn freigibst, dann wird er zu seinem
 * aktuellen Ablösesatz verkauft […]. Und wenn du ihn verlängerst, dann bleibt er halt noch länger da […]."
 *
 * Gefunden in der Abnahme 19.11. (docs/design/abnahme-saison-19-11.md): seit #618 (21.08.) altert der Vertrag beim Betreten der
 * Saisonende-Phase („Verträge öffnen“). Auslaufende Verträge menschlicher Teams stehen danach auf `renewal_pending` — die
 * Entscheidung liegt beim Menschen. Nur: nichts verlangte sie. „Neue Saison starten“ lief durch, und weil die Alterung je Saison
 * genau einmal läuft (`hasSeasonEndContractTickApplied`), wurde der Spieler auch im Saisonstart nicht mehr freigegeben — er
 * spielte die neue Saison ohne Vertrag weiter (Lauf A: alle 11 Spieler des Mensch-Teams; Live-Abbild `hwz8fk`: 12 bei C-C).
 *
 * Ein Ort für die Frage „welche Entscheidung ist offen?“ — Saisonwechsel-Sperre, Saisonfinale und Vertragsroute lesen dieselbe
 * Funktion. Die Entscheidung selbst laufen über die bestehenden Wege: Verlängern = Gehaltsverhandlung (`renew`), Freigeben =
 * Verkauf zum aktuellen Verkaufspreis (`release`, `buildContractExitValue`, Erlös gebucht).
 */
import type { GameState, RosterEntry } from "@/lib/data/olyDataTypes";
import { endSaisonNummer, laeuftMitDieserSaisonAus } from "@/lib/contracts/vertragslaufzeit";
import { getCurrentSeasonNumber } from "@/lib/foundation/season-history-clamp";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";

/** Sperrgrund des Saisonwechsels, solange ein Mensch noch nicht entschieden hat. */
export const VERTRAGSENTSCHEIDUNG_OFFEN = "vertragsentscheidung_offen";

export type OffeneVertragsentscheidung = {
  teamId: string;
  playerId: string;
  rosterId: string;
  /** `true`: der Vertrag ist schon in einer früheren Saison ausgelaufen (Altstand, Entscheidung wird nachgeholt). */
  nachzuholen: boolean;
};

/**
 * Ist über diesen Vertrag jetzt zu entscheiden?
 *  - Am Saisonende: wenn er mit der gerade gespielten Saison endet (vor und nach der Alterung gleich).
 *  - In der laufenden Saison: nur ein Altstand — der Vertrag endete schon in einer früheren Saison, die Entscheidung fiel nie.
 */
export function istVertragsentscheidungFaellig(
  entry: Pick<RosterEntry, "contractLength" | "contractEndSeasonNumber">,
  gameState: Pick<GameState, "season" | "gamePhase">,
): boolean {
  if (isSeasonEndPhase(gameState.gamePhase)) return laeuftMitDieserSaisonAus(entry, gameState);
  return istVertragsentscheidungNachzuholen(entry, gameState);
}

/** Altstand: Endsaison liegt vor der laufenden Saison (der Spieler spielt ohne Vertrag weiter). */
export function istVertragsentscheidungNachzuholen(
  entry: Pick<RosterEntry, "contractLength" | "contractEndSeasonNumber">,
  gameState: Pick<GameState, "season">,
): boolean {
  const laufend = getCurrentSeasonNumber(gameState as GameState);
  if (laufend == null) return false;
  const ende = endSaisonNummer(entry, gameState, { alterungBereitsGelaufen: false });
  return ende != null && ende < laufend;
}

/** Entscheidet der Mensch dieses Teams selbst über Verträge? (KI-Teams und delegierte „Käufe, Verkäufe und Verträge“: nein.) */
export function entscheidetMenschUeberVertraege(gameState: Pick<GameState, "teams" | "seasonState">, teamId: string): boolean {
  const settings = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings)[teamId];
  return settings?.controlMode === "manual" && !isBereichDelegiert(settings, "transfers");
}

/** Alle offenen Entscheidungen menschlicher Teams (ohne Delegation), optional nur für ein Team. */
export function offeneVertragsentscheidungen(gameState: GameState, teamId?: string | null): OffeneVertragsentscheidung[] {
  const mensch = new Map<string, boolean>();
  const offen: OffeneVertragsentscheidung[] = [];
  for (const entry of gameState.rosters) {
    if (teamId && entry.teamId !== teamId) continue;
    if (!mensch.has(entry.teamId)) mensch.set(entry.teamId, entscheidetMenschUeberVertraege(gameState, entry.teamId));
    if (!mensch.get(entry.teamId)) continue;
    if (!istVertragsentscheidungFaellig(entry, gameState)) continue;
    offen.push({
      teamId: entry.teamId,
      playerId: entry.playerId,
      rosterId: entry.id,
      nachzuholen: istVertragsentscheidungNachzuholen(entry, gameState),
    });
  }
  return offen;
}

/** Sperrgründe für den Saisonwechsel: einer je Team, mit Anzahl (`vertragsentscheidung_offen:M-M:11`). */
export function vertragsentscheidungSperrgruende(gameState: GameState): string[] {
  const jeTeam = new Map<string, number>();
  for (const eintrag of offeneVertragsentscheidungen(gameState)) jeTeam.set(eintrag.teamId, (jeTeam.get(eintrag.teamId) ?? 0) + 1);
  return [...jeTeam].map(([teamId, anzahl]) => `${VERTRAGSENTSCHEIDUNG_OFFEN}:${teamId}:${anzahl}`);
}
