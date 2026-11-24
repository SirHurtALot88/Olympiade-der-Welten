/**
 * VERKAUFSABSICHT DER KI AM SAISONENDE (24.11., docs/design/verkauf-restgehalt-24-11.md).
 *
 * GEMELDET (Chris, 24.11.): „In Saison 1 haben die Spieler Ein-Jahres-Vertraege. Wenn sie nach Saison 1 gehen, gibt es
 * keinen Restvertrag mehr abzuloesen" — und trotzdem trugen 50 KI-Verkaeufe im Fenster vor Saison 2 zusammen 330,73 C
 * Restgehalt-Abloese bei 704,65 C Erloes.
 *
 * DER GRUND war keine falsche Buyout-Rechnung, sondern die Reihenfolge zweier Entscheidungen, die nichts voneinander
 * wussten:
 *   1. Der Vertrags-Tick (`computeSeasonEndContractTick`, Schritt `player_development`) verlaengerte 339 auslaufende
 *      Saison-1-Vertraege um 1 bis 4 Jahre (`tco_prefers_renew`).
 *   2. Die Verkaufsrunde des Fensters vor Saison 2 (`planOrganicSellsForTeam`, `fenster_verkauf`) verkaufte danach 50
 *      genau dieser Spieler — mit dem vollen Restgehalt des GERADE unterschriebenen Vertrags als Buyout.
 * Verlaengern und sofort verkaufen heisst: N Jahre Gehalt zusagen und sie sofort als Abloese bezahlen. Haette der Tick den
 * Spieler auslaufen lassen, waere der Abgang ein abloesefreier Verkauf gewesen (`buildContractExitValue`, CLAUDE.md
 * „Vertragsende ist ein Verkauf") — ohne einen Cent Restgehalt.
 *
 * DIESES MODUL stellt die Frage der Verkaufsrunde VOR dem Tick: welche Spieler wuerde die KI im naechsten Fenster
 * verkaufen? Derselbe Planer, dieselben Eingaben, dieselbe Saat wie `runOrganicSellCycle` in
 * `ai-transfer-window-session-service.ts`. Der Tick verlaengert diese Spieler dann nicht (ihr Vertrag endet) und nimmt fuer
 * sie eine angebotene Vertragsaufloesung an (Teilverzicht auf den Rest-Buyout statt vollem Buyout beim Verkauf).
 *
 * Eigenes Modul, weil der Planer ueber die Transferfenster-Sitzung wieder am Vertragsdienst haengt — der Vertragsdienst
 * bekommt nur das Ergebnis (`SeasonEndContractTickOptionen.kiVerkaufsabsicht`), keinen Import.
 *
 * Regel-Stempel: `seasonState.wirtschaftsRegeln.restgehalt` der ENDENDEN Saison (Abfrage `wirtschaftsRegel`). Ohne Stempel
 * "neu" bleibt die Absicht leer, und der Tick entscheidet wie vorher. Rueckweg `OLY_KI_RESTGEHALT=aus` (neue Saisons).
 */
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import {
  applySeasonEndContractTick,
  computeSeasonEndContractTick,
  type ContractSeasonEndPreview,
  type KiVerkaufsabsicht,
} from "@/lib/contracts/contract-renewal-service";
import { hasSeasonEndContractTickApplied } from "@/lib/contracts/saisonende-alterung-marke";
import { planOrganicSellsForTeam } from "@/lib/ai/organic-squad/draft-adapter";
import { saltOrganicSeed } from "@/lib/ai/ai-transfer-window-session-service";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";
import { istFensterAufOpt, istTransferfensterGemeinsam } from "@/lib/market/transferfenster-gemeinsam";
import { wirtschaftsRegel } from "@/lib/resolve/wirtschafts-regeln";

/** Dieselbe Steuerungs-Frage wie die Vertrags-Vorschau (`buildPreviewRow`): entscheidet die KI ueber die Vertraege dieses Teams? */
function entscheidetKi(gameState: GameState, teamId: string): boolean {
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const teamSettings = getTeamControlSettings(gameState, teamId);
  const grundModus = teamSettings?.controlMode ?? (team?.humanControlled ? "manual" : "ai");
  const modus = grundModus === "manual" && teamSettings && isBereichDelegiert(teamSettings, "transfers") ? "ai" : grundModus;
  return modus === "ai";
}

/**
 * Je KI-Team die Spieler, die die organische Verkaufsrunde des naechsten Fensters abgeben wuerde. Leer, wenn die Regel nicht
 * gilt, der organische Planer abgeschaltet ist oder die Alterung dieser Saison schon lief.
 */
export function ermittleKiVerkaufsabsichtAmSaisonende(save: PersistedSaveGame): KiVerkaufsabsicht {
  const gameState = save.gameState;
  const absicht = new Map<string, Set<string>>();
  if (wirtschaftsRegel(gameState, "restgehalt") !== "neu") return absicht;
  // Die Verkaufsrunde laeuft nur mit dem organischen Planer (Standard); ohne ihn gibt es keine Absicht zu spiegeln.
  if (process.env.OLY_ORGANIC_SQUAD_BUILDER === "0") return absicht;
  if (hasSeasonEndContractTickApplied(gameState)) return absicht;

  const playersById = new Map<string, Player>(gameState.players.map((player) => [player.id, player]));
  for (const team of gameState.teams) {
    if (!entscheidetKi(gameState, team.teamId)) continue;
    const kader = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const roster: Player[] = [];
    const purchasePriceByPlayerId: Record<string, number> = {};
    for (const entry of kader) {
      const player = playersById.get(entry.playerId);
      if (!player) continue;
      roster.push(player);
      if (typeof entry.purchasePrice === "number" && Number.isFinite(entry.purchasePrice)) {
        purchasePriceByPlayerId[player.id] = entry.purchasePrice;
      }
    }
    if (roster.length === 0) continue;
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
    // Wie `runOrganicSellCycle`: allowBelowMin, Saat aus Spielstand und Team.
    const plan = planOrganicSellsForTeam({
      gameState,
      team,
      identity,
      roster,
      purchasePriceByPlayerId,
      allowBelowMin: true,
      draftSeed: saltOrganicSeed(`${save.saveId}:${team.teamId}`),
      // Entscheidung am Vertragsende (24.11., Stempel `verkaufSchwellen`): es geht nur, wer sich nach seinem Wert lohnt
      // (Gewinnmitnahme, klar schwach, Ueberschuss ueber Opt); ohne den Stempel ist das der unveraenderte Plan der Verkaufsrunde.
      vertragsende: true,
    });
    // Wie die Verkaufsrunde im gemeinsamen Fenster: ohne „Fenster auf Opt" nur bis max(8, playerMin) — aber nur im alten Stand.
    // Mit Stempel `verkaufSchwellen` gibt es keine Kadergroessen-Bremse auf Abgaenge (Chris 24.11., „fuer immer“); wer unter das
    // Minimum geht, kauft im Fenster nach.
    let spielraum = Number.POSITIVE_INFINITY;
    if (istTransferfensterGemeinsam() && !istFensterAufOpt() && wirtschaftsRegel(gameState, "verkaufSchwellen") !== "neu") {
      spielraum = Math.max(0, roster.length - Math.max(8, identity?.playerMin ?? 0));
    }
    const geplant = plan.decisions.slice(0, Number.isFinite(spielraum) ? spielraum : undefined).map((d) => d.playerId);
    if (geplant.length > 0) absicht.set(team.teamId, new Set(geplant));
  }
  return absicht;
}

/** Der Vertrags-Tick mit der Verkaufsabsicht der KI — der Weg fuer alle produktiven Aufrufer. */
export function computeSeasonEndContractTickMitVerkaufsabsicht(
  save: PersistedSaveGame,
  previewOverride?: ContractSeasonEndPreview,
) {
  return computeSeasonEndContractTick(save, previewOverride, {
    kiVerkaufsabsicht: ermittleKiVerkaufsabsichtAmSaisonende(save),
  });
}

/** Wie `applySeasonEndContractTick`, mit der Verkaufsabsicht der KI (Route `contract_renewal`, Sim-Lauf). */
export function applySeasonEndContractTickMitVerkaufsabsicht(
  save: PersistedSaveGame,
  confirmToken: string | null | undefined,
  persistence: PersistenceService,
  previewOverride?: ContractSeasonEndPreview,
) {
  return applySeasonEndContractTick(save, confirmToken, persistence, previewOverride, {
    kiVerkaufsabsicht: ermittleKiVerkaufsabsichtAmSaisonende(save),
  });
}
