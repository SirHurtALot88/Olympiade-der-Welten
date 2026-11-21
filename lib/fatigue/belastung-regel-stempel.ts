/**
 * WELCHE BELASTUNGSREGEL RECHNET DIESE SAISON? — Saison-Stempel `seasonState.belastungsRegel`.
 *
 * Chris 21.11.: Belastung/Resistenz, Pause nach Spieltag 10 und aktive Erholung 4,0 gelten AB DER
 * FOLGENDEN SAISON für bestehende Spielstände und bei NEUEN Spielständen von Anfang an. Die laufende
 * Saison eines bestehenden Spielstands rechnet bit-identisch mit der alten Regel zu Ende.
 *
 * Muster wie die Wertungsskalen (`lib/resolve/wertungs-skalen.ts`): der Stempel steht IM SPIELSTAND und
 * wird genau zweimal gesetzt — beim Anlegen eines Spiels (`new-game-setup-service.ts`) und beim
 * Saisonwechsel (`preseason-workflow-service.ts`). KEIN Umgebungs-Schalter: jeder Aufruf liest den
 * Stempel des Spielstands, den er gerade rechnet (mehrspielertauglich, kein Prozesszustand).
 *
 * WER IHN BEKOMMT: Battle-Spielstände, deren Saison 20 Spieltage trägt (die Saisonform, an der der
 * Härtetest gemessen ist: aktive Erholung an, Pause nach Spieltag 10 sinnvoll). Ein Manager-Spielstand
 * oder eine Battle-Saison mit 10 Spieltagen (Alt-Save) bekommt keinen Stempel und bleibt bei der alten
 * Regel. Zusätzlich prüft `belastungsRegelFuer` beim Lesen, dass die Saison wirklich die doppelte Länge
 * trägt — ein Stempel allein schaltet nichts in eine 10-Spieltage-Saison.
 */
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";
import type { BelastungsRegelVersion } from "@/lib/fatigue/belastung-regel";
import { isBattleModeSave } from "@/lib/season/game-mode";
import { isDoubledBattleSeason } from "@/lib/season/season-discipline-schedule";

export type BelastungsRegelStempel = { seasonId: string; version: "v2" };

type RegelQuelle = Pick<GameState, "scenarioMeta" | "season" | "disciplines"> & {
  seasonState?: Pick<SeasonState, "seasonId" | "belastungsRegel"> | null;
};

/** Der gültige Stempel der laufenden Saison oder null (fehlt / gehört zu einer anderen Saison). */
export function gueltigerBelastungsStempel(gameState: RegelQuelle | null | undefined): BelastungsRegelStempel | null {
  const stempel = gameState?.seasonState?.belastungsRegel;
  if (!stempel || stempel.version !== "v2") return null;
  const seasonId = gameState?.seasonState?.seasonId ?? gameState?.season?.id;
  if (!seasonId || stempel.seasonId !== seasonId) return null;
  return stempel;
}

/** "v2" nur mit gültigem Stempel UND in einer echten 20-Spieltage-Battle-Saison, sonst "alt". */
export function belastungsRegelFuer(gameState: RegelQuelle | null | undefined): BelastungsRegelVersion {
  if (!gameState || !gueltigerBelastungsStempel(gameState)) return "alt";
  return isDoubledBattleSeason(gameState) ? "v2" : "alt";
}

/**
 * Stempel für eine NEU beginnende Saison. `matchdayCount` ist die Spieltagszahl der neuen Saison
 * (20 bei einer Battle-Doppelsaison). Manager-Saves und kürzere Saisons: kein Stempel (`undefined`).
 */
export function belastungsRegelFuerNeueSaison(
  gameState: Pick<GameState, "scenarioMeta" | "disciplines">,
  seasonId: string,
  matchdayCount: number,
): BelastungsRegelStempel | undefined {
  if (!isBattleModeSave(gameState)) return undefined;
  const doppelsaison = isDoubledBattleSeason({
    scenarioMeta: gameState.scenarioMeta,
    disciplines: gameState.disciplines,
    season: { matchdayIds: Array.from({ length: matchdayCount }, (_, i) => `md-${i + 1}`) } as GameState["season"],
  });
  return doppelsaison ? { seasonId, version: "v2" } : undefined;
}

/** Setzt den Stempel beim ANLEGEN eines Spiels. Idempotent: ein Stempel derselben Saison bleibt. */
export function stempleBelastungsRegelBeimAnlegen(gameState: GameState): GameState {
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  if (!seasonId || !gameState.seasonState) return gameState;
  if (gameState.seasonState.belastungsRegel?.seasonId === seasonId) return gameState;
  const stempel = belastungsRegelFuerNeueSaison(gameState, seasonId, gameState.season?.matchdayIds?.length ?? 0);
  if (!stempel) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, belastungsRegel: stempel } };
}
