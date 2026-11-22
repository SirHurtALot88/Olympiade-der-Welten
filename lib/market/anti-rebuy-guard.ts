import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { wirtschaftsRegel } from "@/lib/resolve/wirtschafts-regeln";
import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";

export const RECENTLY_SOLD_SAME_PRESEASON_BLOCKER = "recently_sold_same_preseason";
export const RECENTLY_SOLD_SAME_PRESEASON_OVERRIDE_WARNING = "recently_sold_same_preseason_override";

export type RecentlySoldPlayer = {
  playerId: string;
  teamId: string;
  seasonId: string;
  transferId: string;
  happenedAt: string;
  source: string | null;
};

function isCurrentPreseasonSale(entry: TransferHistoryEntry, seasonId: string) {
  return (
    entry.transferType === "sell" &&
    entry.seasonId === seasonId &&
    entry.phase === LOCAL_TRANSFER_WINDOW_PHASE &&
    entry.fromTeamId != null
  );
}

function saisonNummerAusId(seasonId: string): number | null {
  const m = /(\d+)\s*$/.exec(seasonId);
  return m ? Number(m[1]) : null;
}

/**
 * Review 22.11. (Chris: „Vertrag auslaufen lassen ist dasselbe wie ein Verkauf“): ein Abgang durch Vertragsende gilt fuer die
 * Rueckkauf-Sperre wie ein Verkauf. Er traegt die Saison, in der der Vertrag endete (also die Vorsaison des Kauffensters), und
 * zaehlt nur, solange danach niemand den Spieler verpflichtet hat (sonst gaebe es ihn nicht mehr im freien Pool). Ablauf am
 * Ende von Saison N sperrt den Rueckkauf im Kauffenster von Saison N+1 — vorher kauften KI-Teams ihre ausgelaufenen Spieler fuer
 * die volle Ablöse zurueck (11 Faelle, 267,7 C), statt zu verlaengern.
 */
function isRecentContractEndExit(entry: TransferHistoryEntry, seasonId: string, regelNeu: boolean, letzterKauf: ReadonlyMap<string, number>) {
  if (!regelNeu) return false;
  if ((entry.transferType !== "contract_exit" && entry.transferType !== "sell") || entry.fromTeamId == null) return false;
  if (entry.seasonId === seasonId) return entry.transferType === "contract_exit";
  const aktuell = saisonNummerAusId(seasonId);
  const eintrag = saisonNummerAusId(entry.seasonId);
  if (aktuell == null || eintrag == null || eintrag !== aktuell - 1) return false;
  // Nur, wenn der Spieler seither bei niemandem unter Vertrag war (vorab gebaute Karte statt Suche je Eintrag).
  return (letzterKauf.get(entry.playerId) ?? -Infinity) <= Date.parse(entry.happenedAt);
}

/** Je Verlaufs-Array, Saison und Regel einmal gebaut (Review Runde 2, Punkt 8: 1,2 s je Teamzyklus bei Neubau je Kandidat). */
const SPERRE_CACHE = new WeakMap<object, Map<string, Map<string, Map<string, RecentlySoldPlayer>>>>();

export function buildRecentlySoldByTeam(gameState: GameState, seasonId = gameState.season.id) {
  const regelNeu = wirtschaftsRegel(gameState, "rueckkauf") === "neu";
  const schluessel = `${seasonId}|${regelNeu ? "neu" : "alt"}`;
  const cacheTraeger = gameState.transferHistory as unknown as object;
  const zwischen = SPERRE_CACHE.get(cacheTraeger);
  const treffer = zwischen?.get(schluessel);
  if (treffer) return treffer;
  const byTeam = new Map<string, Map<string, RecentlySoldPlayer>>();
  const letzterKauf = new Map<string, number>();
  if (regelNeu) {
    for (const e of gameState.transferHistory) {
      if (e.transferType !== "buy") continue;
      const t = Date.parse(e.happenedAt);
      if (t > (letzterKauf.get(e.playerId) ?? -Infinity)) letzterKauf.set(e.playerId, t);
    }
  }

  for (const entry of gameState.transferHistory) {
    if ((!isCurrentPreseasonSale(entry, seasonId) && !isRecentContractEndExit(entry, seasonId, regelNeu, letzterKauf)) || !entry.fromTeamId) {
      continue;
    }

    const teamSales = byTeam.get(entry.fromTeamId) ?? new Map<string, RecentlySoldPlayer>();
    const previous = teamSales.get(entry.playerId);
    if (!previous || Date.parse(entry.happenedAt) >= Date.parse(previous.happenedAt)) {
      teamSales.set(entry.playerId, {
        playerId: entry.playerId,
        teamId: entry.fromTeamId,
        seasonId: entry.seasonId,
        transferId: entry.id,
        happenedAt: entry.happenedAt,
        source: entry.source ?? null,
      });
    }
    byTeam.set(entry.fromTeamId, teamSales);
  }

  (zwischen ?? SPERRE_CACHE.set(cacheTraeger, new Map()).get(cacheTraeger)!).set(schluessel, byTeam);
  return byTeam;
}

export function getRecentlySoldBySameTeam(input: {
  gameState: GameState;
  seasonId?: string;
  teamId: string;
  playerId: string;
}) {
  return buildRecentlySoldByTeam(input.gameState, input.seasonId ?? input.gameState.season.id)
    .get(input.teamId)
    ?.get(input.playerId) ?? null;
}

export function isRecentlySoldBySameTeam(input: {
  gameState: GameState;
  seasonId?: string;
  teamId: string;
  playerId: string;
}) {
  return getRecentlySoldBySameTeam(input) != null;
}
