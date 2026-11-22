import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { ermittleFensterSaisonId } from "@/lib/foundation/transfer-window-zuordnung";

export const SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER = "player_sold_this_season_unavailable";
export const SOLD_PLAYER_SEASON_COOLDOWN_OVERRIDE_WARNING = "player_sold_this_season_cooldown_override";

/**
 * Der Sperrcode MIT Parametern (Chris 22.11.: „Verkauft (Vertragsende) in Saison X — erst wieder ab Transferfenster Saison Y verfuegbar“):
 * `player_sold_this_season_unavailable:<art>:<saisonX>:<saisonY>` mit art `sell` oder `contract_exit`. Der Grundcode bleibt Praefix,
 * Pruefungen vergleichen mit `istSoldCooldownBlocker`.
 */
export function baueSoldCooldownBlocker(ban: Pick<SoldPlayerSeasonBan, "art" | "verkauftInSaison" | "freiAbSaison">): string {
  return `${SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER}:${ban.art}:${ban.verkauftInSaison}:${ban.freiAbSaison}`;
}
export function istSoldCooldownBlocker(grund: string): boolean {
  return grund === SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER || grund.startsWith(`${SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER}:`);
}

export type SoldPlayerSeasonBan = {
  playerId: string;
  seasonId: string;
  fromTeamId: string;
  transferId: string;
  happenedAt: string;
  source: string | null;
  fee: number | null;
  /** "sell" oder "contract_exit": Vertragsende ist ein Verkauf (Chris 22.11.). */
  art: "sell" | "contract_exit";
  /** Saison, in der verkauft wurde bzw. der Vertrag endete (Anzeige). */
  verkauftInSaison: string;
  /** Erste Saison, in deren Transferfenster der Spieler wieder kaufbar ist. */
  freiAbSaison: string;
};

function saisonNr(id: string): number | null {
  const m = /(\d+)\s*$/.exec(id);
  return m ? Number(m[1]) : null;
}

function naechsteSaisonId(id: string): string {
  const n = saisonNr(id);
  return n == null ? id : id.replace(/(\d+)\s*$/, String(n + 1));
}

/**
 * GLOBALE VERKAUFS-SPERRE (Chris 22.11.: „wenn ein Spieler verkauft wurde, dann ist er fuer ALLE Teams eine Season geblockt, erst wieder im
 * naechsten Transferfenster verfuegbar“; „Vertrag auslaufen lassen ist dasselbe wie ein Verkauf“). Gesperrt ist ein Spieler fuer jedes Team
 * (Mensch wie KI), solange das Transferfenster, dem sein Abgang gehoert, das laufende ist:
 *   - Verkauf oder Vertragsende in der laufenden Saison (Fenster und Spieltage dieser Saison): gesperrt bis zum Fenster der naechsten Saison;
 *   - Verkauf am Saisonende der Vorsaison (gehoert laut `ermittleFensterSaisonId` ins laufende Fenster) und Vertragsende der Vorsaison:
 *     gesperrt im laufenden Fenster, im uebernaechsten wieder frei.
 * Es gilt sofort fuer jeden Spielstand (bestehende Spielregel, kein Stempel). Der Satz „solange niemand sonst ihn verpflichtet hat“
 * gilt nicht: die Sperre ist global.
 */
const BAN_CACHE = new WeakMap<object, Map<string, Map<string, SoldPlayerSeasonBan>>>();

export function buildSoldPlayerSeasonBans(gameState: GameState, seasonId = gameState.season.id) {
  const history = gameState.transferHistory as unknown as object;
  const cache = BAN_CACHE.get(history);
  const hit = cache?.get(seasonId);
  if (hit) return hit;
  const bans = new Map<string, SoldPlayerSeasonBan>();
  const letzteSpieltage = new Map<string, number>();
  for (const e of gameState.transferHistory) {
    const m = /(\d+)\s*$/.exec(e.matchdayId ?? "");
    const n = m ? Number(m[1]) : null;
    if (n != null && n > (letzteSpieltage.get(e.seasonId) ?? 0)) letzteSpieltage.set(e.seasonId, n);
  }
  const proSaison = gameState.season?.matchdayIds?.length ?? null;
  const aktuell = saisonNr(seasonId);
  for (const entry of gameState.transferHistory as TransferHistoryEntry[]) {
    if ((entry.transferType !== "sell" && entry.transferType !== "contract_exit") || entry.fromTeamId == null) continue;
    let gesperrt = false;
    if (entry.seasonId === seasonId) {
      gesperrt = true;
    } else if (aktuell != null && saisonNr(entry.seasonId) === aktuell - 1) {
      gesperrt =
        entry.transferType === "contract_exit" ||
        ermittleFensterSaisonId(entry, letzteSpieltage, proSaison) === seasonId;
    }
    if (!gesperrt) continue;
    const previous = bans.get(entry.playerId);
    if (previous && Date.parse(entry.happenedAt) < Date.parse(previous.happenedAt)) continue;
    bans.set(entry.playerId, {
      playerId: entry.playerId,
      seasonId: entry.seasonId,
      fromTeamId: entry.fromTeamId,
      transferId: entry.id,
      happenedAt: entry.happenedAt,
      source: entry.source ?? null,
      fee: entry.fee ?? null,
      art: entry.transferType,
      verkauftInSaison: entry.seasonId,
      freiAbSaison: naechsteSaisonId(seasonId),
    });
  }
  (cache ?? BAN_CACHE.set(history, new Map()).get(history)!).set(seasonId, bans);
  return bans;
}

export function getSoldPlayerSeasonBan(input: { gameState: GameState; playerId: string; seasonId?: string }) {
  return buildSoldPlayerSeasonBans(input.gameState, input.seasonId ?? input.gameState.season.id).get(input.playerId) ?? null;
}

export function isPlayerSoldThisSeason(input: { gameState: GameState; playerId: string; seasonId?: string }) {
  return getSoldPlayerSeasonBan(input) != null;
}

export function isPlayerTransferBuyBlocked(input: { gameState: GameState; playerId: string; seasonId?: string }) {
  return isPlayerSoldThisSeason(input);
}
