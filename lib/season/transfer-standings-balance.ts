import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import {
  isMarketBuyTransferEntry,
  isSeasonOneDraftBuySource,
  SEASON_ONE_DRAFT_BUY_SOURCES,
} from "@/lib/season/transfer-season-policy";

/**
 * DIE EIGENEN TRANSFERS ZAEHLTEN NICHT MIT — gemeldet als `ls9jfg`:
 * „Transfer im Saisonstand und in der historie sind immernoch falsch berechnet, die Käufe aus S2
 *  müssen gegen die Verkäufe aus S1 gerechnet werden! so wären dann ein paar Teams positiv und ein
 *  paar negativ. Hier sind alle 0 oder schlechter weil nur die Käufe drin sind!"
 *
 * Die Rechenregel darunter war schon richtig (S2+ = Verkaeufe der Vorsaison minus Kaeufe der
 * laufenden). Falsch waren diese beiden Listen: sie kannten nur KI-Quellen. Was Chris SELBST tut —
 * `manual_transfermarkt_sell` und `manual_transfermarkt_buy` — fiel in beiden Richtungen heraus.
 *
 * NACHGEMESSEN an `swnjlk` (Saison 2):
 *
 *   S1-Verkaeufe   ai_preseason_market_sell    0 Eintraege        (die einzige gezaehlte Quelle!)
 *                  manual_transfermarkt_sell   5 Eintraege, 101,5  ← fielen heraus
 *   S2-Kaeufe      ai_preseason_market_buy    33 Eintraege, 774,9
 *                  manual_transfermarkt_buy    7 Eintraege, 145,3  ← fielen heraus
 *
 * Es gab also ueberhaupt keine gezaehlten Verkaeufe, waehrend die Kaeufe zaehlten — genau deshalb
 * standen alle 32 Teams bei „0 oder schlechter". Beide Listen werden symmetrisch ergaenzt; nur
 * eine Seite zu oeffnen haette die Schieflage bloss umgedreht.
 *
 * BEWUSST NICHT AUFGENOMMEN: `ai_roster_fill` (16 Kaeufe, 249,3 in derselben Saison). Das ist
 * laufende Kaderpflege beziehungsweise der organische Erst-Draft, keine Marktbewegung der
 * Vorsaison-Phase — und es war nicht gemeldet. Wenn diese Zeilen mitzaehlen sollen, ist das eine
 * eigene Entscheidung.
 */
export const SEASON_END_MARKET_SELL_SOURCES = [
  "ai_preseason_market_sell",
  "manual_transfermarkt_sell",
] as const;
export const PRESEASON_MARKET_BUY_SOURCES = [
  "preseason_roster_repair_buy",
  "ai_preseason_market_buy",
  "manual_transfermarkt_buy",
] as const;
export const DRAFT_BUY_SOURCES = SEASON_ONE_DRAFT_BUY_SOURCES;

export type StandingsTransferBalance = {
  transferCount: number;
  transferBuyCount: number;
  transferSellCount: number;
  transferBuyTotal: number;
  transferSellTotal: number;
  transferNet: number;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function transferFee(entry: TransferHistoryEntry) {
  return typeof entry.fee === "number" && Number.isFinite(entry.fee) ? entry.fee : 0;
}

export function parseSeasonNumber(seasonId: string): number {
  const match = seasonId.match(/season-(\d+)/i);
  return match ? Number(match[1]) : 1;
}

export function previousSeasonId(seasonId: string): string | null {
  const seasonNumber = parseSeasonNumber(seasonId);
  return seasonNumber <= 1 ? null : `season-${seasonNumber - 1}`;
}

export function isDraftBuySource(source: string | null | undefined): boolean {
  return isSeasonOneDraftBuySource(source);
}

export { isMarketBuyTransferEntry };

export function isSeasonEndMarketSell(entry: TransferHistoryEntry): boolean {
  return (
    entry.transferType === "sell" &&
    (SEASON_END_MARKET_SELL_SOURCES as readonly string[]).includes(entry.source ?? "")
  );
}

export function isPreseasonMarketBuy(entry: TransferHistoryEntry): boolean {
  return entry.transferType === "buy" && (PRESEASON_MARKET_BUY_SOURCES as readonly string[]).includes(entry.source ?? "");
}

/**
 * Saisonstand-Transferbilanz:
 * - S1: nur Markt-Verkäufe am S1-Ende (Draft-Käufe zählen nicht).
 * - S2+: Verkäufe am Ende der Vorsaison minus Käufe zu Beginn der aktuellen Saison.
 */
export function buildStandingsTransferBalanceForTeam(
  gameState: GameState,
  seasonId: string,
  teamId: string,
): StandingsTransferBalance {
  const history = gameState.transferHistory ?? [];
  const seasonNumber = parseSeasonNumber(seasonId);
  let transferBuyTotal = 0;
  let transferSellTotal = 0;
  let transferBuyCount = 0;
  let transferSellCount = 0;

  if (seasonNumber === 1) {
    for (const entry of history) {
      if (entry.seasonId !== seasonId || entry.fromTeamId !== teamId || !isSeasonEndMarketSell(entry)) {
        continue;
      }
      transferSellCount += 1;
      transferSellTotal = roundValue(transferSellTotal + transferFee(entry));
    }
  } else {
    const priorSeasonId = previousSeasonId(seasonId);
    if (priorSeasonId) {
      for (const entry of history) {
        if (entry.seasonId !== priorSeasonId || entry.fromTeamId !== teamId || !isSeasonEndMarketSell(entry)) {
          continue;
        }
        transferSellCount += 1;
        transferSellTotal = roundValue(transferSellTotal + transferFee(entry));
      }
    }
    for (const entry of history) {
      if (entry.seasonId !== seasonId || entry.toTeamId !== teamId || !isPreseasonMarketBuy(entry)) {
        continue;
      }
      transferBuyCount += 1;
      transferBuyTotal = roundValue(transferBuyTotal + transferFee(entry));
    }
  }

  return {
    transferCount: transferBuyCount + transferSellCount,
    transferBuyCount,
    transferSellCount,
    transferBuyTotal,
    transferSellTotal,
    transferNet: roundValue(transferSellTotal - transferBuyTotal),
  };
}

export function buildStandingsTransferBalanceByTeamId(gameState: GameState, seasonId: string) {
  return Object.fromEntries(
    gameState.teams.map((team) => [team.teamId, buildStandingsTransferBalanceForTeam(gameState, seasonId, team.teamId)] as const),
  );
}
